"""
User Activity Logger - Tracks all user behavior for personalization.
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta, timezone
from collections import Counter

from firebase_admin import firestore
from shared.storage.firebase_client import get_firebase_client
from shared.utils import get_logger

logger = get_logger(__name__)

class ActivityLogger:
    """Logs and analyzes user activity using Firestore for scalability."""
    
    # Activity types
    VIDEO_ANALYZED = "video_analyzed"
    LESSON_COMPLETED = "lesson_completed"
    QUIZ_TAKEN = "quiz_taken"
    TOPIC_SEARCHED = "topic_searched"
    CHAT_MESSAGE = "chat_message"
    AGENT_USED = "agent_used"
    FUNCTION_CALLED = "function_called"
    SESSION_START = "session_start"
    SESSION_END = "session_end"
    PAGE_VIEW = "page_view"
    
    # specialized activity types
    INTERVIEW_STARTED = "interview_started"
    INTERVIEW_COMPLETED = "interview_completed"
    INTERVIEW_SCORED = "interview_scored"
    ROADMAP_GENERATED = "roadmap_generated"
    ASSESSMENT_STARTED = "assessment_started"
    ASSESSMENT_COMPLETED = "assessment_completed"
    UI_ACTION = "ui_action"
    
    def __init__(self):
        self.firebase = get_firebase_client()
        self.firebase = get_firebase_client()
        # self.db = self.firebase.db  <-- Removed to prevent immediate crash on init failure

    @property
    def db(self):
        """Lazy load db."""
        return self.firebase.db
    

    def log(
        self, 
        user_id: str, 
        activity_type: str, 
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log a user activity to Firestore and VectorStore."""
        try:
            timestamp = datetime.now(timezone.utc)
            
            activity_record = {
                "type": activity_type,
                "timestamp": timestamp.isoformat(),
                "data": data,
                "metadata": metadata or {}
            }
            
            # Firestore Log
            self.db.collection("users").document(user_id).collection("activities").add(activity_record)
            self._update_user_summary(user_id, activity_type, data)
            
            if "topics" in data:
                topics = data["topics"][:5]
                self.db.collection("users").document(user_id).set({
                    "profile": {
                        "topics_of_interest": firestore.ArrayUnion(topics) if topics else []
                    }
                }, merge=True)
            
            # VectorStore Log (New)
            try:
                from shared.memory.vector_store import get_vector_store
                vector_store = get_vector_store()
                
                # Construct meaningful text for embedding
                memory_text = f"Activity: {activity_type.replace('_', ' ').title()}. "
                if activity_type == self.CHAT_MESSAGE:
                    q = data.get("question", "")
                    a = data.get("answer", "")
                    memory_text += f"User asked: '{q}'. Assistant replied: '{a}'."
                elif activity_type == self.QUIZ_TAKEN:
                    score = data.get("score", 0)
                    topic = data.get("topic", "unknown")
                    memory_text += f"Taken on '{topic}'. Score: {score}%."
                elif activity_type == self.INTERVIEW_SCORED:
                    overall = data.get("overall", 0)
                    role = data.get("role", "unknown")
                    memory_text += f"Interview for '{role}'. Overall Score: {overall}/5."
                elif activity_type == self.LESSON_COMPLETED:
                    title = data.get("title", "unknown")
                    memory_text += f"Completed lesson '{title}'."
                elif activity_type == self.ASSESSMENT_COMPLETED:
                     score = data.get("score", 0)
                     title = data.get("title", 'unknown')
                     memory_text += f"Completed assessment '{title}'. Score: {score}%."
                else:
                    # Generic fallback
                    memory_text += f"Data: {json.dumps(data)}"
                
                vector_store.add_memory(
                    user_id=user_id,
                    text=memory_text,
                    metadata={"type": activity_type, "timestamp": timestamp.timestamp()}
                )
            except Exception as e:
                logger.error(f"Failed to log to VectorStore: {e}")

            logger.info("Activity logged to Firestore and VectorStore", user_id=user_id, type=activity_type)
            return True
        except Exception as e:
            logger.error("Failed to log activity to Firestore", error=str(e))
            return False

    def _update_user_summary(self, user_id: str, activity_type: str, data: Dict[str, Any]):
        """Update atomic counters and recent data in the user document."""
        user_ref = self.db.collection("users").document(user_id)
        updates = {}
        
        if activity_type == self.VIDEO_ANALYZED:
            updates["stats.videos_analyzed"] = firestore.Increment(1)
            for topic in data.get("topics", []):
                updates[f"stats.topics_explored.{topic}"] = firestore.Increment(1)
        elif activity_type == self.LESSON_COMPLETED:
            updates["stats.lessons_completed"] = firestore.Increment(1)
        elif activity_type == self.INTERVIEW_SCORED:
            updates["stats.interviews_completed"] = firestore.Increment(1)
            if "overall" in data:
                updates["stats.recent_scores.interview"] = firestore.ArrayUnion([data["overall"]])
        elif activity_type == self.ASSESSMENT_COMPLETED:
            updates["stats.assessments_completed"] = firestore.Increment(1)
            if "score" in data:
                updates["stats.recent_scores.assessment"] = firestore.ArrayUnion([data["score"]])
        elif activity_type == self.QUIZ_TAKEN:
            updates["stats.quizzes_taken"] = firestore.Increment(1)
            if "score" in data:
                updates["stats.recent_scores.quiz"] = firestore.ArrayUnion([data["score"]])
        elif activity_type == self.CHAT_MESSAGE:
            updates["stats.chat_messages"] = firestore.Increment(1)
        elif activity_type == self.AGENT_USED:
            agent = data.get("agent", "unknown")
            updates[f"stats.agents_used.{agent}"] = firestore.Increment(1)
        
        # Calculate Streak
        try:
            doc = user_ref.get()
            if doc.exists:
                user_data = doc.to_dict()
                stats = user_data.get("stats", {})
                last_active = stats.get("last_active_date")
                current_streak = stats.get("current_streak", 0)
                
                now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
                
                logger.info(f"Checking streak for {user_id}: last_active={last_active}, today={now_date}, current={current_streak}")
                
                if last_active != now_date:
                    if last_active == yesterday:
                        updates["stats.current_streak"] = current_streak + 1
                        logger.info(f"🔥 Streak incremented to {current_streak + 1}")
                    else:
                        updates["stats.current_streak"] = 1
                        logger.info(f"⚠️ Streak reset to 1 (last active: {last_active})")
                    updates["stats.last_active_date"] = now_date
                else:
                    logger.info("Streak already counted for today")
            else:
                 # New user / First activity
                now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                updates["stats.current_streak"] = 1
                updates["stats.last_active_date"] = now_date
                logger.info("First activity! Streak initialized to 1")
        except Exception as e:
            logger.error(f"Failed to calculate streak: {e}")

        if updates:
            if not doc.exists:
                user_ref.set({
                    "profile": {
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "preferred_difficulty": "intermediate",
                        "learning_style": "visual"
                    },
                    "stats": {
                        "videos_analyzed": 0, "lessons_completed": 0, "quizzes_taken": 0,
                        "chat_messages": 0, "interviews_completed": 0, "assessments_completed": 0,
                        "agents_used": {}, "topics_explored": {},
                        "recent_scores": {"quiz": [], "interview": [], "assessment": []},
                        "current_streak": 1,
                        "last_active_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
                    }
                }, merge=True)
            
            user_ref.update(updates)

    def get_user_activities(self, user_id: str, activity_type: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent activities from Firestore subcollection."""
        try:
            query = self.db.collection("users").document(user_id).collection("activities")
            if activity_type:
                query = query.where("type", "==", activity_type)
            docs = query.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            logger.error("Failed to fetch activities from Firestore", error=str(e))
            return []
    
    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile from Firestore."""
        try:
            doc = self.db.collection("users").document(user_id).get()
            if not doc.exists:
                return {"exists": False, "profile": {}, "stats": {}}
            data = doc.to_dict()
            return {"exists": True, "profile": data.get("profile", {}), "stats": data.get("stats", {})}
        except Exception as e:
            logger.error("Failed to fetch profile from Firestore", error=str(e))
            return {"exists": False, "profile": {}, "stats": {}}
    
    def get_personalization_context(self, user_id: str) -> str:
        """Fetch data from Firestore and generate AI context."""
        profile_data = self.get_user_profile(user_id)
        if not profile_data["exists"]:
            return "New user with no learning history."
        profile = profile_data["profile"]
        stats = profile_data["stats"]
        activities = self.get_user_activities(user_id, limit=20)
        context_parts = []
        topics = profile.get("topics_of_interest", [])
        if topics: context_parts.append(f"Interests: {', '.join(topics[:5])}")
        context_parts.append(f"Skill Level: {profile.get('preferred_difficulty', 'intermediate')}")
        perf_parts = []
        if stats.get("lessons_completed", 0) > 0: perf_parts.append(f"{stats['lessons_completed']} lessons")
        if stats.get("interviews_completed", 0) > 0:
            int_scores = stats.get("recent_scores", {}).get("interview", [])
            avg_int = sum(int_scores) / len(int_scores) if int_scores else 0
            last_score = int_scores[-1] if int_scores else "N/A"
            interview_summary = f"{stats['interviews_completed']} interviews completed. Avg score: {avg_int:.1f}/5, Latest: {last_score}/5. "
            last_int = next((a for a in activities if a["type"] == self.INTERVIEW_SCORED), None)
            if last_int: interview_summary += f"Last interview for: {last_int['data'].get('role', 'unknown')}"
            context_parts.append(f"Interview Performance: {interview_summary}")
        if stats.get("quizzes_taken", 0) > 0:
            q_scores = stats.get("recent_scores", {}).get("quiz", [])
            avg_q = sum(q_scores) / len(q_scores) if q_scores else 0
            perf_parts.append(f"{stats['quizzes_taken']} quizzes (avg: {avg_q:.1f}%)")
        if perf_parts: context_parts.append(f"Overall Progress: {', '.join(perf_parts)}")
        recent_behavior = []
        for a in activities[:15]:
            t = a["type"]
            if t == self.PAGE_VIEW: recent_behavior.append(f"viewed {a['data'].get('panel', 'page')}")
            elif t == self.UI_ACTION: recent_behavior.append(f"clicked {a['data'].get('element', 'element')}")
            elif t == self.INTERVIEW_STARTED: recent_behavior.append(f"started an interview for {a['data'].get('role', 'role')}")
            elif t == self.ROADMAP_GENERATED: recent_behavior.append(f"generated a roadmap for {a['data'].get('topic', 'topic')}")
            elif t == self.ASSESSMENT_STARTED: recent_behavior.append(f"started an assessment")
        if recent_behavior:
            recent_behavior.reverse()
            context_parts.append(f"Recent behavior: User " + ", then ".join(recent_behavior[-3:]))
        return "User Activity & Context:\n- " + "\n- ".join(context_parts)

    def get_chat_history(self, user_id: str, limit: int = 5) -> str:
        """Fetch chat history from Firestore."""
        activities = self.get_user_activities(user_id, self.CHAT_MESSAGE, limit=limit)
        if not activities: return ""
        history = []
        activities.reverse()
        for act in activities:
            data = act.get("data", {})
            q, a = data.get("question", ""), data.get("answer", "")
            if q and a: history.append(f"User: {q}\nAssistant: {a}")
        return "Recent Conversation History:\n" + "\n\n".join(history) if history else ""
    
    def update_profile(self, user_id: str, updates: Dict[str, Any]) -> bool:
        """Update profile in Firestore."""
        try:
            self.db.collection("users").document(user_id).set({"profile": updates}, merge=True)
            return True
        except Exception: return False


# Singleton instance
_activity_logger = ActivityLogger()


def log_activity(user_id: str, activity_type: str, data: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> bool:
    """Log a user activity. Convenience function."""
    return _activity_logger.log(user_id, activity_type, data, metadata)


def get_user_activity(user_id: str, activity_type: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Get user activities. Convenience function."""
    return _activity_logger.get_user_activities(user_id, activity_type, limit)


def get_user_context(user_id: str) -> str:
    """Get personalization context for AI. Convenience function."""
    return _activity_logger.get_personalization_context(user_id)


def get_chat_history(user_id: str, limit: int = 5) -> str:
    """Get formatted chat history. Convenience function."""
    return _activity_logger.get_chat_history(user_id, limit)


def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Get user profile. Convenience function."""
    return _activity_logger.get_user_profile(user_id)


def update_user_profile(user_id: str, updates: Dict[str, Any]) -> bool:
    """Update user profile. Convenience function."""
    return _activity_logger.update_profile(user_id, updates)
