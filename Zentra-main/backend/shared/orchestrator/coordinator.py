"""
Learning Orchestrator - Coordinates all agents for personalized learning.
Combines RL, Planner, Activity, and Progress for unified recommendations.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

from shared.utils import get_logger

logger = get_logger(__name__)


@dataclass
class Recommendation:
    """A personalized learning recommendation."""
    type: str  # "lesson", "quiz", "video", "review"
    title: str
    description: str
    difficulty: str
    priority: float  # 0-1, higher = more important
    reason: str
    metadata: Dict[str, Any] = None


class LearningOrchestrator:
    """
    Coordinates all agents to provide unified personalized recommendations.
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
    
    def get_user_state(self) -> Dict[str, Any]:
        """Get comprehensive user state from all sources."""
        from shared.activity.logger import get_user_profile
        from shared.rl.policy import extract_signals_from_activity, get_policy
        from services.progress.saved_plans import get_active_plan
        
        profile = get_user_profile(self.user_id)
        signals = extract_signals_from_activity(self.user_id)
        active_plan = get_active_plan(self.user_id)
        
        # Get RL recommendation
        policy = get_policy()
        action, confidence, reason = policy.select_action(signals)
        
        return {
            "profile": profile,
            "signals": signals,
            "active_plan": active_plan,
            "rl_recommendation": {
                "action": action,
                "confidence": confidence,
                "reason": reason
            },
            "difficulty_level": profile.get("profile", {}).get("preferred_difficulty", "intermediate"),
            "topics_of_interest": profile.get("profile", {}).get("topics_of_interest", []),
        }
    
    def get_recommendations(self, max_count: int = 5) -> List[Recommendation]:
        """
        Generate personalized recommendations based on all agent inputs.
        """
        recommendations = []
        state = self.get_user_state()
        
        profile = state["profile"]
        signals = state["signals"]
        active_plan = state["active_plan"]
        rl_rec = state["rl_recommendation"]
        
        # Determine difficulty based on RL
        if rl_rec["action"] == "harder":
            difficulty = "advanced"
        elif rl_rec["action"] == "easier":
            difficulty = "beginner"
        else:
            difficulty = state["difficulty_level"]
        
        # 1. If there's an active plan, prioritize next item
        if active_plan:
            items = active_plan.get("items", [])
            for i, item in enumerate(items):
                if not item.get("completed", False):
                    recommendations.append(Recommendation(
                        type="lesson",
                        title=item.get("title", f"Lesson {i+1}"),
                        description=item.get("description", "Continue your learning plan"),
                        difficulty=active_plan.get("difficulty", difficulty),
                        priority=1.0,  # Highest priority
                        reason=f"Next item in your plan '{active_plan.get('title')}'",
                        metadata={"plan_id": active_plan.get("plan_id"), "item_index": i}
                    ))
                    break
        
        # 2. Suggest based on topics of interest
        topics = state["topics_of_interest"][:3]
        for topic in topics:
            recommendations.append(Recommendation(
                type="video",
                title=f"Learn more about {topic.title()}",
                description=f"Explore {topic} concepts at {difficulty} level",
                difficulty=difficulty,
                priority=0.7,
                reason=f"Based on your interest in {topic}",
                metadata={"topic": topic}
            ))
        
        # 3. Suggest quizzes if many lessons completed
        if signals.get("lessons_completed", 0) > signals.get("quizzes_taken", 0) * 2:
            recommendations.append(Recommendation(
                type="quiz",
                title="Knowledge Check",
                description="Test what you've learned recently",
                difficulty=difficulty,
                priority=0.8,
                reason="You've completed several lessons - time to test your knowledge!",
                metadata={}
            ))
        
        # 4. Suggest review if performance is low
        avg_score = sum(signals.get("recent_quiz_scores", [0.7])) / max(1, len(signals.get("recent_quiz_scores", [1])))
        if avg_score < 0.6:
            recommendations.append(Recommendation(
                type="review",
                title="Review Session",
                description="Revisit previous concepts to strengthen understanding",
                difficulty="beginner",
                priority=0.85,
                reason="Your recent quiz scores suggest some topics need review",
                metadata={"avg_score": avg_score}
            ))
        
        # Sort by priority and limit
        recommendations.sort(key=lambda x: x.priority, reverse=True)
        return recommendations[:max_count]
    
    def get_daily_plan(self) -> Dict[str, Any]:
        """
        Generate a comprehensive daily learning plan.
        Includes lessons, quizzes, projects, and review items.
        """
        state = self.get_user_state()
        active_plan = state["active_plan"]
        signals = state["signals"]
        rl_rec = state["rl_recommendation"]
        
        daily_items = []
        total_time = 0
        
        # 1. Core Learning (from active plan)
        if active_plan:
            items = active_plan.get("items", [])
            for i, item in enumerate(items):
                if not item.get("completed", False):
                    # Add primary lesson
                    daily_items.append({
                        "type": "lesson",
                        "title": item.get("title", f"Lesson {i+1}"),
                        "description": item.get("description", "Core curriculum lesson"),
                        "duration_minutes": item.get("duration_minutes", 30),
                        "priority": "high",
                        "context": {"plan_id": active_plan.get("plan_id"), "item_index": i},
                        "resources": item.get("resources", []),
                        "topics": item.get("topics", []),
                        "objectives": item.get("objectives", []),
                        "importance": item.get("importance", "")
                    })
                    total_time += item.get("duration_minutes", 30)
                    
                    # If this is a major topic, add a mini-project or practice
                    if "project" in item.get("title", "").lower() or (i + 1) % 5 == 0:
                        daily_items.append({
                            "type": "project",
                            "title": f"Project: Apply {item.get('title')}",
                            "description": "Hands-on practice to reinforce concepts",
                            "duration_minutes": 45,
                            "priority": "medium",
                        })
                        total_time += 45
                    
                    if total_time >= 60:  # Cap core learning at ~1 hour per day
                        break
        
        # 2. Adaptive Practice (RL-driven)
        if rl_rec["action"] == "harder" and signals.get("recent_quiz_scores", [0])[0] > 0.85:
            daily_items.append({
                "type": "challenge",
                "title": "Advanced Challenge",
                "description": "Push your limits with a harder problem",
                "duration_minutes": 20,
                "priority": "medium"
            })
        elif rl_rec["action"] == "easier" or signals.get("recent_quiz_scores", [1])[0] < 0.6:
            daily_items.append({
                "type": "review",
                "title": "Concept Review",
                "description": "Review recent difficult topics",
                "duration_minutes": 20,
                "priority": "high"
            })
            
        # 3. Knowledge Retention (Quiz)
        if signals.get("lessons_completed", 0) % 3 == 0 and signals.get("lessons_completed", 0) > 0:
            daily_items.append({
                "type": "quiz",
                "title": "Progress Quiz",
                "description": "Check your retention of recent topics",
                "duration_minutes": 15,
                "priority": "medium"
            })

        return {
            "user_id": self.user_id,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "summary": f"Day {signals.get('streak_days', 1)} of Learning",
            "difficulty_mode": state["difficulty_level"],
            "rl_guidance": rl_rec["reason"],
            "items": daily_items,
            "estimated_minutes": sum(i["duration_minutes"] for i in daily_items)
        }

    def generate_study_session(self, duration_minutes: int = 60) -> Dict[str, Any]:
        """
        Generate a strictly timed study session plan.
        """
        daily_plan = self.get_daily_plan()
        items = daily_plan["items"]
        
        session_items = []
        remaining_time = duration_minutes
        
        # Prioritize high priority items
        items.sort(key=lambda x: 0 if x.get("priority") == "high" else 1)
        
        for item in items:
            if item["duration_minutes"] <= remaining_time:
                session_items.append(item)
                remaining_time -= item["duration_minutes"]
                
        # Fill remaining time with quick reviews if needed
        if remaining_time > 10:
             session_items.append({
                "type": "review",
                "title": "Quick Review",
                "description": "Flashcard review of key terms",
                "duration_minutes": remaining_time,
                "priority": "low"
            })

        return {
            "user_id": self.user_id,
            "total_duration_minutes": duration_minutes,
            "items": session_items,
            "rl_action": daily_plan["rl_guidance"]
        }


def get_recommendation(user_id: str, max_count: int = 5) -> List[Dict[str, Any]]:
    """Get personalized recommendations for a user."""
    orchestrator = LearningOrchestrator(user_id)
    recs = orchestrator.get_recommendations(max_count)
    return [
        {
            "type": r.type,
            "title": r.title,
            "description": r.description,
            "difficulty": r.difficulty,
            "priority": r.priority,
            "reason": r.reason,
            "metadata": r.metadata or {}
        }
        for r in recs
    ]


def generate_study_session(user_id: str, duration_minutes: int = 60) -> Dict[str, Any]:
    """Generate a personalized study session."""
    orchestrator = LearningOrchestrator(user_id)
    return orchestrator.generate_study_session(duration_minutes)
