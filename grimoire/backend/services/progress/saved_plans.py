"""
Saved Lesson Plans - Store and manage user's learning plans.
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from dataclasses import dataclass, asdict

from shared.utils import get_logger

logger = get_logger(__name__)

from shared.storage.firebase_client import get_firebase_client
from shared.activity import log_activity, ActivityLogger

# Firestore client
db = get_firebase_client()
ROADMAPS_COLLECTION = "roadmaps"


@dataclass
class LessonPlanItem:
    """A single item in a lesson plan."""
    item_id: str
    title: str
    description: str = ""
    duration_minutes: int = 30
    completed: bool = False
    completed_at: Optional[str] = None
    score: Optional[float] = None


@dataclass
class SavedPlan:
    """A saved lesson plan."""
    plan_id: str
    user_id: str
    title: str
    goal: str
    created_at: str
    items: List[Dict[str, Any]]
    progress_pct: float = 0.0
    total_items: int = 0
    completed_items: int = 0
    estimated_hours: float = 0.0
    difficulty: str = "intermediate"
    source: str = "planner"  # Which agent created it
    metadata: Dict[str, Any] = None


def _load_plans() -> Dict[str, Any]:
    """Deprecated: No longer using local files."""
    return {}


def _save_plans(data: Dict[str, Any]):
    """Deprecated: No longer using local files."""
    pass


def save_plan(
    user_id: str,
    title: str,
    goal: str,
    items: List[Dict[str, Any]],
    difficulty: str = "intermediate",
    source: str = "planner",
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Save a lesson plan for a user.
    
    Args:
        user_id: User identifier
        title: Plan title
        goal: Learning goal
        items: List of plan items (topics, lessons, activities)
        difficulty: Difficulty level
        source: Which agent generated the plan
        metadata: Additional metadata
    
    Returns:
        The saved plan with ID
    """
    plan_id = f"plan_{int(time.time())}_{user_id[:8]}"
    
    # Calculate estimated hours
    total_minutes = sum(item.get("duration_minutes", 30) for item in items)
    
    plan_dict = {
        "plan_id": plan_id,
        "user_id": user_id,
        "title": title,
        "goal": goal,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "items": items,
        "total_items": len(items),
        "completed_items": 0,
        "progress_pct": 0.0,
        "estimated_hours": round(total_minutes / 60, 1),
        "difficulty": difficulty,
        "source": source,
        "metadata": metadata or {}
    }
    
    try:
        db.db.collection(ROADMAPS_COLLECTION).document(plan_id).set(plan_dict)
        logger.info("Plan saved to Firestore", plan_id=plan_id, user_id=user_id, items=len(items))
        
        # Log activity
        log_activity(user_id, ActivityLogger.ROADMAP_GENERATED, {
            "topic": title,
            "roadmap_id": plan_id
        })
        
        return plan_dict
    except Exception as e:
        logger.error("Failed to save plan to Firestore", error=str(e))
        return plan_dict


def get_user_plans(user_id: str) -> List[Dict[str, Any]]:
    """Get all saved plans for a user from Firestore."""
    try:
        # Run both field-name queries in parallel threads (sync Firestore SDK)
        def _query_snake():
            return list(db.db.collection(ROADMAPS_COLLECTION).where("user_id", "==", user_id).stream())

        def _query_camel():
            return list(db.db.collection(ROADMAPS_COLLECTION).where("userId", "==", user_id).stream())

        with ThreadPoolExecutor(max_workers=2) as pool:
            future_snake = pool.submit(_query_snake)
            future_camel = pool.submit(_query_camel)
            snake_docs = future_snake.result()
            camel_docs = future_camel.result()

        plans = []
        seen_ids = set()

        for doc in snake_docs:
            data = doc.to_dict()
            if doc.id not in seen_ids:
                data["id"] = doc.id
                plans.append(data)
                seen_ids.add(doc.id)

        for doc in camel_docs:
            data = doc.to_dict()
            if doc.id not in seen_ids:
                data["id"] = doc.id
                plans.append(data)
                seen_ids.add(doc.id)
        
        # Unify progress field (progress_pct vs progress)
        for plan in plans:
            if "progress_pct" not in plan and "progress" in plan:
                plan["progress_pct"] = plan["progress"]
            if "plan_id" not in plan:
                plan["plan_id"] = plan.get("id")
        
        return plans
    except Exception as e:
        logger.error("Failed to fetch plans from Firestore", error=str(e))
        return []


def get_plan_by_id(user_id: str, plan_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific plan by ID from Firestore."""
    try:
        doc = db.db.collection(ROADMAPS_COLLECTION).document(plan_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            if "plan_id" not in data:
                data["plan_id"] = doc.id
            return data
        return None
    except Exception as e:
        logger.error("Failed to fetch plan by ID", error=str(e))
        return None


def update_plan_progress(
    user_id: str,
    plan_id: str,
    item_index: int,
    completed: bool = True,
    score: Optional[float] = None
) -> Optional[Dict[str, Any]]:
    """Update progress on a plan item in Firestore."""
    try:
        doc_ref = db.db.collection(ROADMAPS_COLLECTION).document(plan_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return None
        
        plan = doc.to_dict()
        items = plan.get("items") or plan.get("modules") or []
        
        if 0 <= item_index < len(items):
            # Update the specific item
            items[item_index]["completed"] = completed
            items[item_index]["completed_at"] = datetime.now(timezone.utc).isoformat() if completed else None
            if score is not None:
                items[item_index]["score"] = score
            
            # Recalculate progress
            completed_count = sum(1 for item in items if item.get("completed", False))
            total_items = len(items)
            progress_pct = round(completed_count / total_items * 100, 1) if total_items > 0 else 0
            
            # Prepare update
            updates = {
                "items": items if "items" in plan else None,
                "modules": items if "modules" in plan else None,
                "completed_items": completed_count,
                "progress_pct": progress_pct,
                "progress": progress_pct  # Keep both synced
            }
            # Remove None values
            updates = {k: v for k, v in updates.items() if v is not None}
            
            doc_ref.update(updates)
            
            # Also log to activity
            log_activity(user_id, ActivityLogger.LESSON_COMPLETED, {
                "roadmap_id": plan_id,
                "item_index": item_index,
                "progress": progress_pct
            })
            
            plan.update(updates)
            return plan
            
        return None
    except Exception as e:
        logger.error("Failed to update plan progress", error=str(e))
        return None


def delete_plan(user_id: str, plan_id: str) -> bool:
    """Delete a saved plan from Firestore."""
    try:
        doc_ref = db.db.collection(ROADMAPS_COLLECTION).document(plan_id)
        doc = doc_ref.get()
        if not doc.exists:
            return False
            
        # Verify ownership
        data = doc.to_dict()
        owner_id = data.get("user_id") or data.get("userId")
        if owner_id != user_id:
            return False
            
        doc_ref.delete()
        logger.info("Plan deleted from Firestore", plan_id=plan_id)
        return True
    except Exception as e:
        logger.error("Failed to delete plan", error=str(e))
        return False


def get_active_plan(user_id: str) -> Optional[Dict[str, Any]]:
    """Get the user's most recent incomplete plan."""
    plans = get_user_plans(user_id)
    
    # Sort by creation date, get most recent incomplete
    incomplete = [p for p in plans if p.get("progress_pct", 0) < 100]
    if incomplete:
        incomplete.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return incomplete[0]
    
    return None
