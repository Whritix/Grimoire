"""
YouTube Integration - Transcript fetching with caching.
"""

import hashlib
import json
from typing import Any
from dataclasses import dataclass

from shared.config import get_settings
from shared.utils import get_logger

logger = get_logger(__name__)
settings = get_settings()

# Simple in-memory cache (use Redis in production)
_transcript_cache: dict[str, dict] = {}


@dataclass
class TranscriptResult:
    """Result from transcript fetch."""
    video_id: str
    text: str | None
    language: str
    segments: list[dict]
    duration_seconds: float
    error: str | None = None
    cached: bool = False


def get_cache_key(video_id: str, language: str) -> str:
    """Generate cache key for transcript."""
    return hashlib.md5(f"{video_id}:{language}".encode()).hexdigest()


async def fetch_youtube_transcript(
    video_id: str,
    language: str = "en",
    use_cache: bool = True
) -> TranscriptResult:
    """
    Fetch transcript from a YouTube video with caching.
    
    Args:
        video_id: YouTube video ID (can include 'yt_' prefix)
        language: Preferred language code
        use_cache: Whether to use cached result
        
    Returns:
        TranscriptResult with transcript text and metadata
    """
    # Clean video ID
    vid = video_id.replace("yt_", "").replace("yt-", "").strip()
    
    # Check if it's a URL and extract ID
    if "youtube.com" in vid or "youtu.be" in vid:
        vid = extract_video_id(vid)
    
    if not vid:
        return TranscriptResult(
            video_id=video_id,
            text=None,
            language=language,
            segments=[],
            duration_seconds=0,
            error="Invalid video ID"
        )
    
    # Check cache
    cache_key = get_cache_key(vid, language)
    if use_cache and cache_key in _transcript_cache:
        cached = _transcript_cache[cache_key]
        logger.info("Transcript cache hit", video_id=vid)
        return TranscriptResult(
            video_id=vid,
            text=cached["text"],
            language=cached["language"],
            segments=cached["segments"],
            duration_seconds=cached["duration"],
            cached=True
        )
    
    try:
        from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
        
        # Try to get transcript list
        transcript_list = YouTubeTranscriptApi.list_transcripts(vid)
        
        # Try to find the requested language
        transcript = None
        try:
            transcript = transcript_list.find_transcript([language])
        except:
            logger.info(f"No transcript found for {language}, trying English fallback for {vid}")
            try:
                transcript = transcript_list.find_transcript(['en'])
            except:
                # Get any available transcript
                for t in transcript_list:
                    transcript = t
                    break
        
        if not transcript:
            return TranscriptResult(
                video_id=vid,
                text=None,
                language=language,
                segments=[],
                duration_seconds=0,
                error="No transcript available"
            )
        
        # Fetch transcript data
        transcript_data = transcript.fetch()
        
        # Combine transcript entries
        full_text = " ".join([t["text"] for t in transcript_data])
        
        # Calculate duration
        duration = 0
        if transcript_data:
            last_segment = transcript_data[-1]
            duration = last_segment["start"] + last_segment.get("duration", 0)
        
        # Processing segments for better format
        segments = [
            {
                "start": t["start"],
                "duration": t.get("duration", 0),
                "text": t["text"]
            }
            for t in transcript_data
        ]
        
        result = TranscriptResult(
            video_id=vid,
            text=full_text,
            language=transcript.language_code,
            segments=segments,
            duration_seconds=duration
        )
        
        # Cache the result
        _transcript_cache[cache_key] = {
            "text": full_text,
            "language": transcript.language_code,
            "segments": segments,
            "duration": duration
        }
        
        logger.info(
            "Transcript fetched",
            video_id=vid,
            language=transcript.language_code,
            length=len(full_text)
        )
        
        return result
        
    except Exception as e:
        logger.warning("Transcript fetch failed", video_id=vid, error=str(e))
        return TranscriptResult(
            video_id=vid,
            text=None,
            language=language,
            segments=[],
            duration_seconds=0,
            error=str(e)
        )


def extract_video_id(url: str) -> str | None:
    """Extract video ID from YouTube URL."""
    import re
    
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    # If it looks like a video ID directly
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
        return url
    
    return None


async def get_video_metadata(video_id: str) -> dict[str, Any]:
    """
    Get video metadata from YouTube API.
    Requires YOUTUBE_API_KEY to be set.
    """
    vid = video_id.replace("yt_", "").strip()
    
    if not settings.youtube_api_key:
        return {"error": "YouTube API key not configured"}
    
    try:
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "part": "snippet,contentDetails,statistics",
                    "id": vid,
                    "key": settings.youtube_api_key,
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("items"):
                    item = data["items"][0]
                    return {
                        "video_id": vid,
                        "title": item["snippet"]["title"],
                        "description": item["snippet"]["description"][:500],
                        "channel": item["snippet"]["channelTitle"],
                        "published_at": item["snippet"]["publishedAt"],
                        "duration": item["contentDetails"]["duration"],
                        "view_count": item["statistics"].get("viewCount", 0),
                        "like_count": item["statistics"].get("likeCount", 0),
                    }
            
            return {"error": f"API error: {response.status_code}"}
            
    except Exception as e:
        return {"error": str(e)}


def clear_transcript_cache():
    """Clear the transcript cache."""
    _transcript_cache.clear()
    logger.info("Transcript cache cleared")
