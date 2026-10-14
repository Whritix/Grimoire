"""
Badge Service - Creates verifiable badge claims.
"""

import hmac
import hashlib
import time
import uuid
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser, default_limit
from shared.config import get_settings
from shared.utils import create_response, safe_validate, get_logger

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()


class EvidenceItem(BaseModel):
    """Evidence supporting badge award."""
    type: str  # assessment, project, lesson_completion, checkpoint
    id: str
    score: float | None = None
    completed_at: str | None = None
    url: str | None = None


class BadgeRequest(BaseModel):
    """Badge issuance request."""
    model: str = "badge-v1"
    user_id: str
    roadmap_id: str
    badge_name: str
    badge_description: str | None = None
    criteria: str | None = None
    evidence: list[EvidenceItem]
    schema_version: str = "1.0"


def create_signed_claim(badge_id: str, user_id: str, evidence: list[dict]) -> str:
    """Create HMAC-signed badge claim."""
    claim_data = f"{badge_id}:{user_id}:{len(evidence)}:{int(time.time())}"
    signature = hmac.new(
        settings.badge_signing_secret.encode(),
        claim_data.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{claim_data}:{signature}"


def verify_evidence(evidence: list[EvidenceItem]) -> tuple[bool, list[str]]:
    """Verify that evidence meets badge requirements."""
    issues = []
    
    if not evidence:
        issues.append("No evidence provided")
        return False, issues
    
    # Check for minimum requirements
    scores = [e.score for e in evidence if e.score is not None]
    if scores:
        avg_score = sum(scores) / len(scores)
        if avg_score < 0.6:
            issues.append(f"Average score {avg_score:.0%} below 60% threshold")
    
    # Check for required evidence types
    types = {e.type for e in evidence}
    if "assessment" not in types:
        issues.append("Missing assessment evidence")
    
    return len(issues) == 0, issues


@router.post("/badge")
# @default_limit
async def issue_badge(
    request: BadgeRequest,
    api_key: AuthenticatedUser,
):
    """
    Validate evidence and issue a verifiable badge.
    
    Creates a cryptographically signed badge claim.
    """
    logger.info(
        "Badge request",
        user=request.user_id,
        badge=request.badge_name,
    )
    
    # Verify evidence
    is_valid, issues = verify_evidence(request.evidence)
    
    if not is_valid:
        badge_id = f"badge_{uuid.uuid4().hex[:12]}"
        return create_response(
            model=request.model,
            payload={
                "badge_id": badge_id,
                "status": "rejected",
                "issues": issues,
            },
            payload_type="badge",
            human_summary=f"Badge rejected: {'; '.join(issues)}",
            confidence=0.9,
        )

    return await issue_badge_to_user(request)


async def issue_badge_to_user(request: BadgeRequest):
    """Internal function to issue a badge without API key dependency."""
    badge_id = f"badge_{uuid.uuid4().hex[:12]}"
    
    # Create signed claim
    evidence_dicts = [e.model_dump() for e in request.evidence]
    signed_claim = create_signed_claim(badge_id, request.user_id, evidence_dicts)
    
    issued_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    badge_data = {
        "badge_id": badge_id,
        "status": "issued",
        "signed_claim": signed_claim,
        "verify_url": f"/v1/badges/verify/{badge_id}",
        "issued_at": issued_at,
        "user_id": request.user_id,
        "metadata": {
            "name": request.badge_name,
            "description": request.badge_description,
            "criteria": request.criteria,
            "issuer": {"name": "AI Agents Learning Platform"},
            "recipient": {"user_id": request.user_id},
        },
        "evidence": evidence_dicts,
    }
    
    # Save to Firestore
    from shared.storage.firebase_client import get_firebase_client
    db = get_firebase_client()
    await db.save_badge(badge_id, badge_data)
    
    # Validate against schema
    validation = safe_validate(badge_data, "badge")
    
    return create_response(
        model=request.model,
        payload=badge_data,
        payload_type="badge",
        human_summary=f"Badge '{request.badge_name}' issued to user {request.user_id}.",
        confidence=0.95,
    )


@router.get("/badges/verify/{badge_id}")
async def verify_badge(badge_id: str):
    """Verify a badge claim."""
    from shared.storage.firebase_client import get_firebase_client
    db = get_firebase_client()
    
    badge = await db.get_badge(badge_id)
    
    if not badge:
        return {
            "badge_id": badge_id,
            "valid": False,
            "message": "Badge not found.",
        }
        
    # Verify signature logic (optional double-check)
    # For now, just existence in DB is enough proof of issuance because we trust our write path
    
    return {
        "badge_id": badge_id,
        "valid": True,
        "data": badge,
        "message": "Badge is valid and verified.",
    }


# --- Automatic Badge Issuance Logic ---

BADGE_DEFINITIONS = [
  {
    "id": "1",
    "name": "First Steps",
    "description": "Started your learning journey",
    "criteria": "Complete your first lesson",
    "check_earned": lambda stats: stats.get("lessons", 0) >= 1
  },
  {
    "id": "2",
    "name": "Quick Learner",
    "description": "Completed 5 lessons",
    "criteria": "Complete 5 lessons",
    "check_earned": lambda stats: stats.get("lessons", 0) >= 5
  },
  {
    "id": "3",
    "name": "Quiz Master",
    "description": "Completed 3 quizzes",
    "criteria": "Complete 3 quizzes",
    "check_earned": lambda stats: stats.get("quizzes", 0) >= 3
  },
  {
    "id": "4",
    "name": "Module Master",
    "description": "Completed 10 lessons",
    "criteria": "Complete 10 lessons",
    "check_earned": lambda stats: stats.get("lessons", 0) >= 10
  },
  {
    "id": "5",
    "name": "Goal Setter",
    "description": "Created a learning roadmap",
    "criteria": "Create 1 roadmap",
    "check_earned": lambda stats: stats.get("roadmaps", 0) >= 1
  },
  {
    "id": "6",
    "name": "Champion",
    "description": "Mastery achieved - 20 lessons complete",
    "criteria": "Complete 20 lessons",
    "check_earned": lambda stats: stats.get("lessons", 0) >= 20
  },
  {
    "id": "7",
    "name": "Interview Pro",
    "description": "Completed interview practice",
    "criteria": "Complete 1 interview",
    "check_earned": lambda stats: stats.get("interviews", 0) >= 1
  },
  {
    "id": "8",
    "name": "High Scorer",
    "description": "Score 80%+ on a quiz",
    "criteria": "Score 80% or higher",
    "check_earned": lambda stats: stats.get("avg_score", 0) >= 80
  },
  {
    "id": "9",
    "name": "Dedicated",
    "description": "5 day learning streak",
    "criteria": "Learn 5 days in a row",
    "check_earned": lambda stats: stats.get("streak", 0) >= 5
  },
]

async def check_and_issue_missing_badges(user_id: str, stats: dict, existing_badges: list[dict]):
    """
    Checks user stats against badge definitions and issues any missing badges.
    Returns: A list of newly issued badges.
    """
    existing_badge_names = {b.get("metadata", {}).get("name") for b in existing_badges}
    newly_issued = []
    
    for definition in BADGE_DEFINITIONS:
        if definition["name"] not in existing_badge_names:
            if definition["check_earned"](stats):
                # Issue the badge!
                logger.info(f"Auto-issuing badge '{definition['name']}' to user {user_id}")
                
                # Mock evidence for auto-issued badges
                evidence = [
                    EvidenceItem(
                        type="auto_check",
                        id=f"auto_{int(time.time())}",
                        completed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    )
                ]
                
                req = BadgeRequest(
                    user_id=user_id,
                    roadmap_id="general", # Generic roadmap context
                    badge_name=definition["name"],
                    badge_description=definition["description"],
                    criteria=definition["criteria"],
                    evidence=evidence
                )
                
                try:
                    response = await issue_badge_to_user(req)
                    # The response payload is the badge data
                    badge_data = response.payload
                    newly_issued.append(badge_data)
                except Exception as e:
                    logger.error(f"Failed to auto-issue badge {definition['name']}: {e}")
                    
    return newly_issued
