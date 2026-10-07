"""
Composer Agent - Synthesizes lessons from retrieved documents.
"""

from pathlib import Path
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser, heavy_limit
from shared.middleware.sanitizer import sanitize_string_field
from shared.models import get_model_router, AgentType
from shared.utils import create_response, safe_validate, get_logger

logger = get_logger(__name__)

router = APIRouter()
# Trigger reload for prompt update

# Load prompt template
PROMPT_PATH = Path(__file__).parent.parent.parent / "shared" / "prompts" / "composer.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""


class DocumentInput(BaseModel):
    """Input document for composition."""
    id: str
    title: str | None = None
    text: str
    url: str | None = None
    source_type: str = "article"


class ComposerRequest(BaseModel):
    """Composer agent request."""
    model: str = "composer-v1"
    topic: str
    documents: list[DocumentInput]
    difficulty: str = "intermediate"
    temperature: float = 0.3
    max_tokens: int = 8000
    schema_version: str = "1.0"
    lesson_template: str | None = None


@router.post("/composer")
# @heavy_limit  # TODO: fix rate limiting
async def compose_lesson(
    request: ComposerRequest,
    api_key: AuthenticatedUser,
):
    """
    Compose a structured lesson from documents.
    
    Synthesizes retrieved documents into a coherent lesson with
    objectives, notes, quiz seeds, and citations.
    """
    logger.info(
        "Composer request",
        topic=request.topic,
        doc_count=len(request.documents),
    )
    
    # Sanitize user inputs to prevent prompt injection
    sanitized_topic = sanitize_string_field(request.topic, max_length=500)
    sanitized_template = sanitize_string_field(request.lesson_template, max_length=200) if request.lesson_template else None
    
    # Build the prompt with documents
    docs_text = "\n\n".join([
        f"--- Document {i+1}: {doc.title or doc.id} ---\nType: {doc.source_type}\nURL: {doc.url}\nContent:\n{doc.text[:3000]}"
        for i, doc in enumerate(request.documents)
    ])
    
    if not request.documents:
        user_prompt = f"""
Topic: {request.topic}
Target Difficulty: {request.difficulty}
Context: {request.lesson_template or 'General Programming'}

Create a comprehensive, structured lesson on this topic using your own expert knowledge.
STRICTLY ADHERE to the provided Context. If the context is 'Python', do not generate JavaScript code.

Include:
- Overview
- Key Concepts
- Practical Examples (in the language specified by Context)
- Summary
"""
    else:
        user_prompt = f"""
Topic: {request.topic}
Target Difficulty: {request.difficulty}
Context: {request.lesson_template or ''}

Documents to synthesize:
{docs_text}

Create a comprehensive lesson from these documents.
STRICTLY ADHERE to the provided Context.
"""
    
    # Call the model
    model_router = get_model_router()
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.COMPOSER,
            prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
    except Exception as e:
        logger.error("Model generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Model error: {str(e)}")
    
    # Return raw markdown response logic
    # We no longer strictly validate JSON because we want rich Markdown output for text-based lessons
    content = response.content
    
    human_summary = f"Created lesson '{request.topic}'"
    
    return create_response(
        model=request.model,
        payload={"raw_response": content, "title": request.topic},
        payload_type="lesson",
        human_summary=human_summary,
        sources=[{"id": d.id, "url": d.url, "title": d.title} for d in request.documents if d.url],
        confidence=0.9,
        tokens_used=response.tokens_used,
    )
