"""
RL Controller Agent - Adaptive difficulty using contextual bandit.
"""

from typing import Any, Literal
from fastapi import APIRouter
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser, default_limit
from shared.models import get_model_router, AgentType
from shared.utils import create_response, get_logger

logger = get_logger(__name__)

router = APIRouter()


class SignalsInput(BaseModel):
    """Learning signals for RL decision."""
    recent_quiz_scores: list[float] = []
    hints_used: int = 0
    time_spent_minutes: float = 0
    retention_results: list[float] = []
    streak_days: int = 0
    user_id: str | None = None


class RLRequest(BaseModel):
    """RL Controller request."""
    model: str = "rl-v1"
    signals: SignalsInput
    current_difficulty: str = "intermediate"
    schema_version: str = "1.0"


class RLAction(BaseModel):
    """RL action decision."""
    action: Literal["easier", "same", "harder"]
    confidence: float
    reason: str
    suggested_adjustments: list[str] = []


@router.post("/rl-controller")
# @default_limit
async def decide_difficulty(
    request: RLRequest,
    api_key: AuthenticatedUser,
):
    """
    Decide whether to adjust content difficulty.
    
    Uses a contextual bandit approach based on learning signals.
    """
    logger.info("RL request", current=request.current_difficulty)
    
    signals = request.signals
    
    # Simple rule-based policy (can be replaced with learned policy)
    avg_score = (
        sum(signals.recent_quiz_scores) / len(signals.recent_quiz_scores)
        if signals.recent_quiz_scores
        else 0.7
    )
    
    # Decision logic
    if avg_score >= 0.85 and signals.hints_used <= 1:
        action = "harder"
        confidence = min(0.9, avg_score)
        reason = f"Strong performance (avg {avg_score:.0%}) with minimal hints."
        adjustments = ["Introduce advanced topics", "Reduce scaffolding"]
    elif avg_score <= 0.5 or signals.hints_used >= 5:
        action = "easier"
        confidence = 0.8
        reason = f"Struggling (avg {avg_score:.0%}) or heavy hint usage ({signals.hints_used} hints)."
        adjustments = ["Add more examples", "Break down concepts", "Provide more practice"]
    else:
        action = "same"
        confidence = 0.7
        reason = f"Moderate performance (avg {avg_score:.0%}). Maintain current difficulty."
        adjustments = []
    
    # Adjust confidence based on data quality
    if len(signals.recent_quiz_scores) < 3:
        confidence *= 0.8
        reason += " (Limited data - low confidence)"
    
    result = RLAction(
        action=action,
        confidence=confidence,
        reason=reason,
        suggested_adjustments=adjustments,
    )
    
    return create_response(
        model=request.model,
        payload=result.model_dump(),
        payload_type="rl_decision",
        human_summary=f"Recommendation: {action} ({confidence:.0%} confidence). {reason}",
        confidence=confidence,
    )
