"""
Summarize Utility Agent - Fast, lightweight summarization.
Target: Local LLM for 10% of workload.
"""

from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser, default_limit
from shared.models import get_model_router, AgentType, ModelTarget
from shared.utils import create_response, get_logger

logger = get_logger(__name__)

router = APIRouter()


class SummarizeRequest(BaseModel):
    """Summarization request."""
    model: str = "summarize-v1"
    text: str
    max_length: int = 150  # Words
    style: str = "concise"  # concise, detailed, bullets
    schema_version: str = "1.0"


SUMMARIZE_PROMPT = """
You are a summarization assistant. Summarize the given text clearly and accurately.

Rules:
1. Be {style}
2. Target approximately {max_length} words
3. Preserve key facts and main ideas
4. Return JSON format:
{{
  "summary": "the summary text",
  "bullets": ["key point 1", "key point 2", ...],
  "word_count": number,
  "source_mapping": [
    {{"bullet": "key point", "source_span": "relevant excerpt from original"}}
  ]
}}
"""


@router.post("/summarize")
# @default_limit
async def summarize_text(
    request: SummarizeRequest,
    api_key: AuthenticatedUser,
):
    """
    Summarize text content.
    
    Uses local LLM when available for fast, lightweight summarization.
    """
    logger.info("Summarize request", text_length=len(request.text))
    
    if len(request.text) < 50:
        return create_response(
            model=request.model,
            payload={
                "summary": request.text,
                "bullets": [],
                "word_count": len(request.text.split()),
            },
            payload_type="summary",
            human_summary="Text too short to summarize.",
            confidence=1.0,
        )
    
    model_router = get_model_router()
    
    system_prompt = SUMMARIZE_PROMPT.format(
        style=request.style,
        max_length=request.max_length,
    )
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.SUMMARIZE,  # Routes to local LLM
            prompt=f"Summarize this text:\n\n{request.text[:5000]}",
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1024,
        )
    except Exception as e:
        logger.error("Summarization failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
    # Parse response
    import json
    import re
    
    content = response.content
    payload = {
        "summary": content,
        "bullets": [],
        "word_count": len(content.split()),
    }
    
    # Try to extract JSON
    # Remove markdown code blocks if present
    clean_content = content.replace("```json", "").replace("```", "").strip()
    
    # Try finding JSON brace if there is extra text
    start = clean_content.find("{")
    end = clean_content.rfind("}")
    
    if start != -1 and end != -1:
        json_str = clean_content[start : end + 1]
        try:
            parsed = json.loads(json_str)
            payload = {
                "summary": parsed.get("summary", content),
                "bullets": parsed.get("bullets", []),
                "word_count": parsed.get("word_count", len(content.split())),
                "source_mapping": parsed.get("source_mapping", []),
            }
        except json.JSONDecodeError:
            logger.warning("Failed to parse JSON from summarize response")
            pass
    
    return create_response(
        model=request.model,
        payload=payload,
        payload_type="summary",
        human_summary=payload["summary"][:200] + "..." if len(payload["summary"]) > 200 else payload["summary"],
        confidence=0.85,
        caveat=response.caveat,
        caveat_reason=response.caveat_reason,
    )
