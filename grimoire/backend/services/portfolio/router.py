"""
Portfolio Service - Public Portfolio & Skill Certificates.
"""

import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from shared.models import get_model_router, AgentType
from shared.utils import get_logger
from shared.storage.firebase_client import get_firebase_client
from shared.activity.logger import get_user_profile as get_activity_profile

logger = get_logger(__name__)
router = APIRouter()
db = get_firebase_client()

# ---------------------------------------------------------------------------
# In-memory TTL cache — avoids Firestore + LLM calls on every navigation
# ---------------------------------------------------------------------------
_portfolio_cache: Dict[str, tuple] = {}   # { user_id: (payload, epoch_ts) }
PORTFOLIO_CACHE_TTL = 300                 # 5 min — serve from memory
SKILL_SUMMARY_TTL   = 6 * 3600           # 6 h  — before regenerating via LLM


class PortfolioResponse(BaseModel):
    user_id: str
    profile: Dict[str, Any]
    stats: Dict[str, Any]
    badges: List[Dict[str, Any]]
    skill_summary: str
    generated_at: str


# ── Sync helpers (safe to call via run_in_executor) ───────────────────────────

def _sync_get_activity_profile(user_id: str) -> Dict[str, Any]:
    try:
        return get_activity_profile(user_id)
    except Exception as e:
        logger.error(f"Failed to fetch activity profile for {user_id}: {e}")
        return {"profile": {}, "stats": {}}


def _sync_get_firestore_profile(user_id: str) -> Optional[Dict[str, Any]]:
    try:
        doc = db.db.collection("users").document(user_id).get()
        return doc.to_dict() if doc.exists else None
    except Exception as e:
        logger.error(f"Failed to fetch Firestore profile for {user_id}: {e}")
        return None


def _sync_get_badges(user_id: str) -> List[Dict[str, Any]]:
    try:
        docs = db.db.collection("badges").where("user_id", "==", user_id).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.error(f"Failed to fetch badges for {user_id}: {e}")
        return []


def _sync_get_progress(user_id: str) -> Dict[str, Any]:
    try:
        doc = db.db.collection("user_progress").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            data.setdefault("stats", {"lessons": 0, "quizzes": 0, "avg_score": 0.0, "difficulty_level": "Beginner"})
            return data
    except Exception as e:
        logger.error(f"Failed to fetch progress for {user_id}: {e}")
    return {"history": [], "stats": {"lessons": 0, "quizzes": 0, "avg_score": 0.0, "difficulty_level": "Beginner"}}


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/portfolio/public/{user_id}")
async def get_public_portfolio(user_id: str):
    """
    Get public portfolio data for a user.
    Served from in-memory cache within the TTL; otherwise rebuilt in parallel.
    """
    logger.info(f"Fetching public portfolio for {user_id}")

    # 1. Memory cache hit — instant return, no I/O
    if user_id in _portfolio_cache:
        payload, cached_at = _portfolio_cache[user_id]
        if time.time() - cached_at < PORTFOLIO_CACHE_TTL:
            logger.info(f"Portfolio cache hit for {user_id}")
            return payload

    # 2. All four Firestore fetches run in parallel thread pool
    #    (sync Firestore SDK would block the event loop if called with await directly)
    loop = asyncio.get_event_loop()
    results = await asyncio.gather(
        loop.run_in_executor(None, _sync_get_activity_profile, user_id),
        loop.run_in_executor(None, _sync_get_firestore_profile, user_id),
        loop.run_in_executor(None, _sync_get_badges, user_id),
        loop.run_in_executor(None, _sync_get_progress, user_id),
        return_exceptions=True,
    )

    activity_data = results[0] if not isinstance(results[0], Exception) else {"profile": {}, "stats": {}}
    user_doc      = results[1] if not isinstance(results[1], Exception) else None
    badges        = results[2] if not isinstance(results[2], Exception) else []
    progress_data = results[3] if not isinstance(results[3], Exception) else {"stats": {}}

    profile_info   = dict(activity_data.get("profile", {}))
    activity_stats = activity_data.get("stats", {})

    if user_doc:
        profile_info.update(user_doc)
        logger.info(f"Firestore profile fetched for {user_id}: {list(user_doc.keys())}")

    if not profile_info.get("name"):
        profile_info["name"] = f"Learner {user_id[:6]}"

    logger.info(f"Activity profile fetched for {user_id}: name={profile_info.get('name')}, stats={activity_stats}")
    logger.info(f"Badges fetched for {user_id}: count={len(badges)}")

    progress_stats = progress_data.get("stats", {})
    logger.info(f"Progress fetched for {user_id}: {progress_stats}")

    # 3. Auto-issue missing badges (async, runs concurrently with nothing else here)
    combined_stats = {
        "lessons":    progress_stats.get("lessons", 0) or activity_stats.get("lessons_completed", 0),
        "quizzes":    progress_stats.get("quizzes", 0) or activity_stats.get("quizzes_taken", 0),
        "avg_score":  progress_stats.get("avg_score", 0),
        "roadmaps":   activity_stats.get("roadmaps_created", 0),
        "interviews": activity_stats.get("interviews_completed", 0),
        "streak":     activity_stats.get("current_streak", 0),
    }
    try:
        from services.badge.router import check_and_issue_missing_badges
        new_badges = await check_and_issue_missing_badges(user_id, combined_stats, badges)
        if new_badges:
            badges = list(badges) + new_badges
            logger.info(f"Auto-issued {len(new_badges)} badges for {user_id}")
    except Exception as e:
        logger.error(f"Failed to auto-issue badges for {user_id}: {e}")

    # 4. Skill summary — use Firestore-cached value; call LLM only when stale
    cached_summary  = profile_info.get("skill_summary", "")
    cached_date_str = profile_info.get("summary_generated_at", "")
    skill_summary   = cached_summary
    generated_at    = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    should_refresh = True
    if cached_summary and len(cached_summary) > 10 and cached_date_str:
        try:
            cached_date = datetime.strptime(cached_date_str, "%Y-%m-%dT%H:%M:%SZ")
            if (datetime.now() - cached_date).total_seconds() < SKILL_SUMMARY_TTL:
                should_refresh = False
                generated_at = cached_date_str
                logger.info(f"Using cached skill summary for {user_id}")
        except ValueError:
            pass

    if should_refresh:
        badge_names = [b["metadata"]["name"] for b in badges if isinstance(b, dict) and b.get("metadata")]
        prompt = (
            "Based on the following learner stats, write a professional, encouraging 2-3 sentence "
            "'Skill Summary' suitable for a verified certificate or LinkedIn bio. "
            "Highlight their consistency and specific achievements.\n\n"
            f"User: {profile_info.get('name')}\n"
            f"Lessons: {progress_stats.get('lessons', 0)}  "
            f"Quizzes: {progress_stats.get('quizzes', 0)}  "
            f"Avg Score: {progress_stats.get('avg_score', 0)}%\n"
            f"Badges: {', '.join(badge_names) or 'none yet'}\n"
            f"Level: {progress_stats.get('difficulty_level', 'Beginner')}\n\n"
            "Output strictly the summary text."
        )
        generated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        try:
            model_router = get_model_router()
            response = await model_router.generate(
                agent_type=AgentType.SUMMARIZE,
                prompt=prompt,
                max_tokens=150,
                temperature=0.7,
            )
            skill_summary = response.content.strip().strip('"').strip("'")
            if not skill_summary:
                raise ValueError("Empty response from model")

            # Persist the new summary so the next request skips the LLM
            await loop.run_in_executor(
                None,
                lambda: db.db.collection("users").document(user_id).set(
                    {"skill_summary": skill_summary, "summary_generated_at": generated_at},
                    merge=True,
                ),
            )
            logger.info(f"Generated new skill summary for {user_id}")
        except Exception as e:
            logger.error(f"Failed to generate skill summary: {e}")
            skill_summary = (
                f"An ambitious learner on the GRIMOIRE platform with {len(badges)} verified badges "
                f"and {progress_stats.get('lessons', 0)} lessons completed."
            )
            # Save fallback so we don't call LLM again immediately
            try:
                await loop.run_in_executor(
                    None,
                    lambda: db.db.collection("users").document(user_id).set(
                        {"skill_summary": skill_summary, "summary_generated_at": generated_at},
                        merge=True,
                    ),
                )
            except Exception:
                pass

    # 5. Assemble payload, populate in-memory cache, return
    result_payload = {
        "user_id": user_id,
        "profile": {
            "name":      profile_info.get("name"),
            "avatar":    profile_info.get("avatar", ""),
            "bio":       profile_info.get("bio", "Learning AI Agents & Full Stack Development"),
            "joined_at": profile_info.get("joined_at", time.strftime("%Y-%m-%d")),
        },
        "stats": {
            "lessons_completed": combined_stats["lessons"],
            "quizzes_completed": combined_stats["quizzes"],
            "average_score":     combined_stats["avg_score"],
            "learning_hours":    activity_stats.get("hours_spent", 0.0),
            "streak":            combined_stats["streak"],
        },
        "badges":        badges,
        "skill_summary": skill_summary,
        "generated_at":  generated_at,
    }

    _portfolio_cache[user_id] = (result_payload, time.time())
    logger.info(f"Returning portfolio payload for {user_id}: {str(result_payload)[:200]}...")
    return result_payload
