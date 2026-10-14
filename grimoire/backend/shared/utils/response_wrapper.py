"""
OpenAI-compatible response wrapper for agent outputs.
Formats responses to match OpenAI API structure.
"""

import time
import uuid
from typing import Any
from dataclasses import dataclass, field
from pydantic import BaseModel


class AgentOutput(BaseModel):
    """Structured agent output payload."""
    type: str
    schema_version: str = "1.0"
    payload: dict[str, Any]
    sources: list[dict[str, Any]] = []
    confidence: float = 1.0
    caveat: bool = False
    caveat_reason: str | None = None


class Message(BaseModel):
    """Chat message format."""
    role: str
    content: str
    function_call: dict[str, Any] | None = None


class Choice(BaseModel):
    """Response choice."""
    index: int
    message: Message
    finish_reason: str = "stop"


class AgentResponse(BaseModel):
    """OpenAI-compatible agent response."""
    id: str
    object: str = "agent.response"
    created: int
    model: str
    agent_output: AgentOutput
    choices: list[Choice]
    usage: dict[str, int] | None = None


def create_response(
    model: str,
    payload: dict[str, Any],
    payload_type: str,
    human_summary: str,
    sources: list[dict[str, Any]] | None = None,
    confidence: float = 1.0,
    caveat: bool = False,
    caveat_reason: str | None = None,
    function_call: dict[str, Any] | None = None,
    tokens_used: int | None = None,
) -> AgentResponse:
    """
    Create an OpenAI-compatible agent response.
    
    Args:
        model: Model identifier (e.g., "planner-v1")
        payload: Structured JSON payload
        payload_type: Type of payload (e.g., "roadmap", "lesson")
        human_summary: Human-readable summary
        sources: Optional list of source citations
        confidence: Confidence score 0.0-1.0
        caveat: Whether response has caveats
        caveat_reason: Explanation for caveat
        function_call: Optional function call request
        tokens_used: Token usage statistics
    
    Returns:
        AgentResponse in OpenAI-compatible format
    """
    return AgentResponse(
        id=f"resp_{uuid.uuid4().hex[:12]}",
        created=int(time.time()),
        model=model,
        agent_output=AgentOutput(
            type=payload_type,
            payload=payload,
            sources=sources or [],
            confidence=confidence,
            caveat=caveat,
            caveat_reason=caveat_reason,
        ),
        choices=[
            Choice(
                index=0,
                message=Message(
                    role="assistant",
                    content=human_summary,
                    function_call=function_call,
                ),
            )
        ],
        usage={"total_tokens": tokens_used} if tokens_used else None,
    )


def create_error_response(
    code: str,
    message: str,
    error_type: str = "agent_error",
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create an error response."""
    error: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "type": error_type,
        }
    }
    if details:
        error["error"]["details"] = details
    return error
