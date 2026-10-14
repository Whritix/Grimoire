"""
Progress Tracking Service - Stores and retrieves user learning progress.
Now uses Firebase Firestore for storage.
"""

import datetime
from datetime import timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser
from shared.utils import create_response, get_logger
from shared.storage.firebase_client import get_firebase_client

# Lazy import to avoid circular dependency at module level if possible, 
# but for now we'll import inside function or use standard import
# We can't easily import from services.badge.router due to potential circular imports if it imports shared.*
# However, we only need the internal function and model.
# To be safe, we'll do the import inside the function.

logger = get_logger(__name__)

router = APIRouter()

# Get Firebase client
db = get_firebase_client()


class ProgressUpdate(BaseModel):
    user_id: str
    item_type: str  # 'lesson', 'quiz'
    item_id: str
    title: str
    score: Optional[float] = None
    completed_at: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


async def get_user_progress_data(user_id: str) -> Dict[str, Any]:
    """Get user progress data from Firestore."""
    try:
        doc = db.db.collection("user_progress").document(user_id).get()
        if doc.exists:
            data = doc.to_dict()
            # Ensure stats exist
            if "stats" not in data:
                data["stats"] = {"lessons": 0, "quizzes": 0, "avg_score": 0.0, "difficulty_level": "Beginner"}
            return data
        return {"history": [], "stats": {"lessons": 0, "quizzes": 0, "avg_score": 0.0, "difficulty_level": "Beginner"}}
    except Exception as e:
        logger.error(f"Failed to get progress for {user_id} from Firebase: {e}")
        return {"history": [], "stats": {"lessons": 0, "quizzes": 0, "avg_score": 0.0, "difficulty_level": "Beginner"}}


async def save_user_progress_data(user_id: str, data: Dict[str, Any]):
    """Save user progress data to Firestore."""
    try:
        db.db.collection("user_progress").document(user_id).set(data)
    except Exception as e:
        logger.error("Failed to save progress to Firebase", error=str(e))


async def update_user_progress_internal(
    user_id: str,
    item_type: str,
    item_id: str,
    title: str,
    score: Optional[float] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Internal function to update progress, shared by multiple endpoints."""
    user_data = await get_user_progress_data(user_id)
    
    # Add to history
    entry = {
        "user_id": user_id,
        "item_type": item_type,
        "item_id": item_id,
        "title": title,
        "score": score,
        "completed_at": datetime.datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {}
    }
        
    user_data["history"].append(entry)
    
    # Update stats
    if item_type == "lesson":
        user_data["stats"]["lessons"] = user_data["stats"].get("lessons", 0) + 1
        logger.info(f"✅ Lesson completed", title=title, total_lessons=user_data["stats"]["lessons"])
    elif item_type in ["quiz", "assessment"]:
        current_total = user_data["stats"].get("quizzes", 0)
        current_avg = user_data["stats"].get("avg_score", 0.0)
        new_score = score or 0.0
        
        # Incremental average
        new_avg = ((current_avg * current_total) + new_score) / (current_total + 1)
        
        user_data["stats"]["quizzes"] = current_total + 1
        user_data["stats"]["avg_score"] = round(new_avg, 2)
        
        # Adaptive Difficulty Logic
        current_level = user_data["stats"].get("difficulty_level", "Beginner")
        if user_data["stats"]["quizzes"] >= 3:
            if new_avg >= 85 and current_level == "Beginner":
                current_level = "Intermediate"
            elif new_avg >= 85 and current_level == "Intermediate":
                current_level = "Advanced"
            elif new_avg < 50 and current_level == "Advanced":
                current_level = "Intermediate"
            elif new_avg < 50 and current_level == "Intermediate":
                current_level = "Beginner"
        user_data["stats"]["difficulty_level"] = current_level
        
    # Calculate Streak
    # ------------------------------------------------------------------
    # Use the shared Activity Logger as the source of truth to ensure
    # consistency with the Profile page and other parts of the app.
    
    try:
        from shared.activity.logger import get_user_profile
        activity_profile = get_user_profile(user_id)
        if activity_profile.get("exists"):
            current_streak = activity_profile["stats"].get("current_streak", 0)
            user_data["stats"]["streak"] = current_streak
        else:
            # Fallback if no activity profile exists yet
             user_data["stats"]["streak"] = 1 # We just logged an activity, so at least 1
    except Exception as e:
        logger.error(f"Failed to sync streak from activity logger: {e}")
        # Keep existing value or default to 0
        if "streak" not in user_data["stats"]:
             user_data["stats"]["streak"] = 0
    
    await save_user_progress_data(user_id, user_data)
    
    # Sync with Activity Logger for personalization
    from shared.activity import log_activity, ActivityLogger
    if item_type == "lesson":
        log_activity(user_id, ActivityLogger.LESSON_COMPLETED, {"item_id": item_id, "title": title})
    elif item_type == "quiz":
        log_activity(user_id, ActivityLogger.QUIZ_TAKEN, {"item_id": item_id, "title": title, "score": score})
    elif item_type == "assessment":
        log_activity(user_id, ActivityLogger.ASSESSMENT_COMPLETED, {"item_id": item_id, "title": title, "score": score})
    
    
    # Check for "First Lesson" Badge
    if item_type == "lesson" and user_data["stats"]["lessons"] == 1:
        try:
            # Import here to avoid circular dependencies
            from services.badge.router import issue_badge_to_user, BadgeRequest, EvidenceItem
            
            logger.info("🏆 Issuing 'First Lesson' badge to user", user_id=user_id)
            
            badge_req = BadgeRequest(
                user_id=user_id,
                roadmap_id="general",
                badge_name="First Step",
                badge_description="Completed your first lesson on GRIMOIRE.",
                criteria="Complete 1 lesson",
                evidence=[
                    EvidenceItem(
                        type="lesson_completion",
                        id=item_id,
                        completed_at=entry["completed_at"],
                        url=f"/lesson/{item_id}"
                    )
                ]
            )
            await issue_badge_to_user(badge_req)
        except Exception as e:
            logger.error("Failed to auto-issue badge", error=str(e))

    return user_data


@router.post("/progress/update")
async def update_progress(update: ProgressUpdate, _api_key: AuthenticatedUser):
    """Record completion of a learning item."""
    logger.info(f"📝 Progress update received", user_id=update.user_id, item_type=update.item_type, title=update.title)
    
    user_data = await update_user_progress_internal(
        user_id=update.user_id,
        item_type=update.item_type,
        item_id=update.item_id,
        title=update.title,
        score=update.score,
        metadata=update.metadata
    )
    
    return create_response(
        model="progress-v1",
        payload={"status": "updated", "stats": user_data["stats"]},
        payload_type="progress_update",
        human_summary=f"Progress saved. Current Level: {user_data['stats'].get('difficulty_level', 'Beginner')}"
    )


class FlashcardReview(BaseModel):
    user_id: str
    card_front: str
    rating: str  # 'easy', 'hard'


@router.post("/progress/flashcards/review")
async def review_flashcard(review: FlashcardReview, _api_key: AuthenticatedUser):
    """Record a flashcard review."""
    user_data = await get_user_progress_data(review.user_id)
    
    if "flashcards" not in user_data:
        user_data["flashcards"] = {}
        
    card_id = str(hash(review.card_front))
    
    card_data = user_data["flashcards"].get(card_id, {
        "front": review.card_front, 
        "box": 0, 
        "reviews": 0,
        "last_review": None
    })
    
    card_data["last_review"] = datetime.datetime.now(timezone.utc).isoformat()
    card_data["reviews"] += 1
    
    if review.rating == "easy":
        card_data["box"] += 1
    else:
        card_data["box"] = 1
        
    user_data["flashcards"][card_id] = card_data
    
    # Update total cards reviewed stat
    stats = user_data.get("stats", {})
    stats["cards_reviewed"] = stats.get("cards_reviewed", 0) + 1
    user_data["stats"] = stats
    
    await save_user_progress_data(review.user_id, user_data)
    
    return create_response(
        model="progress-v1",
        payload={"status": "reviewed", "card": card_data},
        payload_type="flashcard_update",
        human_summary=f"Card reviewed. Moved to Box {card_data['box']}"
    )


@router.get("/progress/{user_id}")
async def get_progress(user_id: str, _api_key: AuthenticatedUser):
    """Get progress for a user."""
    default_stats = {"lessons": 0, "quizzes": 0, "avg_score": 0.0, "difficulty_level": "Beginner"}
    user_data = await get_user_progress_data(user_id)
    
    # Ensure all required keys exist in stats
    if "stats" not in user_data:
        user_data["stats"] = default_stats.copy()
    else:
        for key, value in default_stats.items():
            if key not in user_data["stats"]:
                user_data["stats"][key] = value
    
    return create_response(
        model="progress-v1",
        payload=user_data,
        payload_type="user_progress",
        human_summary=f"Level: {user_data['stats']['difficulty_level']}. Completed: {user_data['stats']['lessons']} lessons, {user_data['stats']['quizzes']} quizzes."
    )
