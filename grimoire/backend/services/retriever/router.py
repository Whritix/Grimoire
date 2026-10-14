"""
Retriever Agent - Fetches and ranks external learning resources.
"""

from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from shared.middleware import AuthenticatedUser, default_limit
from shared.models import get_model_router, AgentType
from shared.utils import create_response, get_logger
from shared.config import get_settings

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()


class RetrieverRequest(BaseModel):
    """Retriever agent request."""
    model: str = "retriever-v1"
    query: str
    filters: dict[str, Any] | None = None
    max_results: int = 10
    include_transcripts: bool = False
    schema_version: str = "1.0"


class Document(BaseModel):
    """Retrieved document."""
    id: str
    title: str
    url: str
    snippet: str
    source_type: str
    published_at: str | None = None
    duration: int | None = None  # For videos, in seconds
    credibility_score: float = 0.8
    transcript: str | None = None
    metadata: dict[str, Any] = {}


class RetrieverResponse(BaseModel):
    """Retriever response with documents."""
    documents: list[Document]
    query: str
    total_found: int


async def search_youtube(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search YouTube for relevant videos."""
    results = []
    
    # If YouTube API key is configured, use it
    if settings.youtube_api_key:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "videoDuration": "medium",  # Filter out Shorts (<4 mins)
                        "maxResults": max_results,
                        "key": settings.youtube_api_key,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get("items", []):
                        results.append({
                            "id": f"yt_{item['id']['videoId']}",
                            "title": item["snippet"]["title"],
                            "url": f"https://youtube.com/watch?v={item['id']['videoId']}",
                            "snippet": item["snippet"]["description"][:200],
                            "source_type": "youtube",
                            "published_at": item["snippet"]["publishedAt"],
                            "credibility_score": 0.75,
                            "metadata": {
                                "channel_title": item["snippet"]["channelTitle"],
                                "thumbnail": item["snippet"]["thumbnails"]["medium"]["url"]
                            }
                        })
        except Exception as e:
            logger.warning("YouTube API error", error=str(e))
    
    # Fallback: return mock results for demo
    if not results:
        results = [
            {
                "id": f"yt_demo_{i}",
                "title": f"{query} - Tutorial Part {i+1}",
                "url": f"https://youtube.com/watch?v=demo{i}",
                "snippet": f"Learn about {query} in this comprehensive tutorial...",
                "source_type": "youtube",
                "credibility_score": 0.7,
            }
            for i in range(min(3, max_results))
        ]
    
    return results


async def search_web(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search web for relevant articles using DuckDuckGo."""
    results = []
    try:
        from duckduckgo_search import DDGS
        
        # Use sync DDGS in a thread-safe way or async if supported
        # For simplicity and reliability, we'll use the sync context manager
        with DDGS() as ddgs:
            # Fetch results
            ddgs_results = list(ddgs.text(query, max_results=max_results))
            
            for i, res in enumerate(ddgs_results):
                results.append({
                    "id": f"web_{i}_{abs(hash(res['href']))}",
                    "title": res.get("title", "No Title"),
                    "url": res.get("href", ""),
                    "snippet": res.get("body", "")[:300],
                    "source_type": "web",
                    "credibility_score": 0.85,  # Slightly higher for real search
                })
                
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")
        # Fallback to a single generic result if search totally fails
        return [{
            "id": "web_fallback",
            "title": f"Search Results for {query}",
            "url": f"https://duckduckgo.com/?q={query}",
            "snippet": f"We couldn't fetch direct results right now. Click here to search for '{query}' manually.",
            "source_type": "web",
            "credibility_score": 0.5,
        }]

    return results


async def get_youtube_transcript(video_id: str) -> str | None:
    """Fetch YouTube video transcript."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        
        # Extract video ID from full ID
        vid = video_id.replace("yt_", "")
        
        transcript_list = YouTubeTranscriptApi.get_transcript(vid)
        transcript = " ".join([t["text"] for t in transcript_list])
        return transcript
    except Exception as e:
        logger.warning("Transcript fetch failed", video_id=video_id, error=str(e))
        return None


@router.post("/retriever")
# @default_limit
async def retrieve_resources(
    request: RetrieverRequest,
    api_key: AuthenticatedUser,
):
    """
    Retrieve and rank external learning resources.
    
    Searches YouTube, articles, and tutorials for relevant content.
    """
    logger.info("Retriever request", query=request.query)
    
    # Gather results from different sources (request full count from both to ensure variety)
    youtube_results = await search_youtube(request.query, request.max_results)
    web_results = await search_web(request.query, request.max_results)
    
    all_results = youtube_results + web_results
    
    # Fetch transcripts if requested
    if request.include_transcripts:
        for result in all_results:
            if result["source_type"] == "youtube":
                transcript = await get_youtube_transcript(result["id"])
                if transcript:
                    result["transcript"] = transcript
    
    # Convert to Document models
    documents = [
        Document(**{k: v for k, v in doc.items() if k in Document.model_fields})
        for doc in all_results
    ]
    
    return create_response(
        model=request.model,
        payload={
            "documents": [d.model_dump() for d in documents],
            "query": request.query,
            "total_found": len(documents),
        },
        payload_type="documents",
        human_summary=f"Found {len(documents)} resources for '{request.query}'",
        confidence=0.85,
    )
