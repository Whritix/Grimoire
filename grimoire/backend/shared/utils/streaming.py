"""
Streaming Utilities for AI responses using Server-Sent Events (SSE).
Provides real-time token streaming from LLM APIs.
"""

import json
import asyncio
from typing import AsyncGenerator, Any
from fastapi.responses import StreamingResponse


async def stream_sse_response(
    content_generator: AsyncGenerator[str, None],
    model: str = "doubt-v1"
) -> StreamingResponse:
    """
    Convert an async generator of text chunks to SSE format.
    
    SSE Format:
    data: {"chunk": "text piece", "done": false}
    data: {"chunk": "", "done": true, "model": "doubt-v1"}
    """
    
    async def generate_sse():
        try:
            async for chunk in content_generator:
                if chunk:
                    event = {
                        "chunk": chunk,
                        "done": False
                    }
                    yield f"data: {json.dumps(event)}\n\n"
                    await asyncio.sleep(0)  # Allow other tasks to run
            
            # Send completion event
            final_event = {
                "chunk": "",
                "done": True,
                "model": model
            }
            yield f"data: {json.dumps(final_event)}\n\n"
            
        except Exception as e:
            error_event = {
                "chunk": "",
                "done": True,
                "error": str(e)
            }
            yield f"data: {json.dumps(error_event)}\n\n"
    
    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


async def simulate_streaming_from_text(
    text: str,
    chunk_size: int = 20,
    delay_ms: int = 30
) -> AsyncGenerator[str, None]:
    """
    Simulate streaming by chunking finished text.
    Used when actual streaming is not available from the model.
    
    Args:
        text: Complete text to stream
        chunk_size: Approximate characters per chunk  
        delay_ms: Delay between chunks in milliseconds
    """
    words = text.split()
    current_chunk = []
    current_length = 0
    
    for word in words:
        current_chunk.append(word)
        current_length += len(word) + 1
        
        if current_length >= chunk_size:
            yield " ".join(current_chunk) + " "
            current_chunk = []
            current_length = 0
            await asyncio.sleep(delay_ms / 1000)
    
    # Yield remaining words
    if current_chunk:
        yield " ".join(current_chunk)


class StreamingContentBuilder:
    """Helper to build content from streamed chunks."""
    
    def __init__(self):
        self.chunks: list[str] = []
    
    def add_chunk(self, chunk: str):
        self.chunks.append(chunk)
    
    @property
    def content(self) -> str:
        return "".join(self.chunks)
    
    def __str__(self) -> str:
        return self.content
