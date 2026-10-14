
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.podcast.service import PodcastService
import json

router = APIRouter(prefix="/podcast", tags=["podcast"])
service = PodcastService()

class GenerateRequest(BaseModel):
    content: str
    source_id: str = None

class GenerateResponse(BaseModel):
    audio_url: str

@router.post("/generate", response_model=GenerateResponse)
async def generate_podcast(req: GenerateRequest):
    try:
        # Generate audio
        # Note: In production this should be a background task or return a job ID.
        # For this MVP, we'll await it (it might take 10-20s).
        audio_path = await service.create_podcast(req.content)
        
        # Assuming we serve 'assets' statically. 
        # Need to ensure the backend mounts /assets directory.
        # Construct a URL. Ideally this comes from config.
        # path is like "assets/podcast_audio/xyz.mp3"
        
        # We need to make sure the path is accessible via API.
        # If backend mounts static "assets", then url is /assets/...
        
        # Normalize and force leading slash for browser-safe URLs
        web_path = audio_path.replace("\\", "/")
        if not web_path.startswith("/"):
            web_path = f"/{web_path.lstrip('/')}"
        
        return GenerateResponse(audio_url=web_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream_podcast(req: GenerateRequest):
    """
    SSE endpoint for streaming audio generation.
    Returns audio segments as Server-Sent Events as they're generated.
    """
    async def event_generator():
        try:
            async for event in service.create_podcast_stream(req.content):
                # Format as SSE
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
