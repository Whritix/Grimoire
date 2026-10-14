"""
Learning Insights API - Analyzes learning patterns and provides personalized feedback.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser
from shared.storage.firebase_client import get_firebase_client
from shared.utils import create_response, get_logger

logger = get_logger(__name__)

router = APIRouter()

db = get_firebase_client()


class InsightsResponse(BaseModel):
    """Learning insights response."""
    strongest_topics: List[Dict[str, Any]]
    areas_for_improvement: List[Dict[str, Any]]
    learning_patterns: Dict[str, Any]
    streak_info: Dict[str, Any]
    recommendations: List[str]


@router.get("/insights/{user_id}")
async def get_learning_insights(
    user_id: str,
    api_key: AuthenticatedUser,
):
    """Get personalized learning insights for a user."""
    try:
        # Fetch user progress
        progress_doc = db.db.collection("user_progress").document(user_id).get()
        
        if not progress_doc.exists:
            return create_response(
                model="insights-v1",
                payload={
                    "strongest_topics": [],
                    "areas_for_improvement": [],
                    "learning_patterns": {},
                    "streak_info": {"current": 0, "longest": 0},
                    "recommendations": ["Start your learning journey by creating a roadmap!"],
                    "message": "No learning data yet"
                },
                payload_type="insights",
                human_summary="No learning data available yet"
            )
        
        progress = progress_doc.to_dict()
        history = progress.get("history", [])
        stats = progress.get("stats", {})
        
        # Analyze strongest topics (high quiz scores)
        topic_scores: Dict[str, List[float]] = {}
        for item in history:
            if item.get("item_type") == "quiz" and item.get("score") is not None:
                topic = extract_topic(item.get("title", ""))
                if topic not in topic_scores:
                    topic_scores[topic] = []
                topic_scores[topic].append(item.get("score", 0))
        
        strongest_topics = []
        areas_for_improvement = []
        
        for topic, scores in topic_scores.items():
            avg_score = sum(scores) / len(scores)
            entry = {
                "topic": topic,
                "average_score": round(avg_score, 1),
                "attempts": len(scores)
            }
            if avg_score >= 70:
                strongest_topics.append(entry)
            else:
                areas_for_improvement.append(entry)
        
        # Sort by score
        strongest_topics.sort(key=lambda x: x["average_score"], reverse=True)
        areas_for_improvement.sort(key=lambda x: x["average_score"])
        
        # Analyze learning patterns
        learning_patterns = analyze_learning_patterns(history)
        
        # Calculate streak
        streak_info = calculate_streak_details(history)
        
        # Generate recommendations
        recommendations = generate_recommendations(
            strongest_topics,
            areas_for_improvement,
            learning_patterns,
            stats
        )
        
        return create_response(
            model="insights-v1",
            payload={
                "strongest_topics": strongest_topics[:5],
                "areas_for_improvement": areas_for_improvement[:5],
                "learning_patterns": learning_patterns,
                "streak_info": streak_info,
                "recommendations": recommendations,
                "total_lessons": stats.get("lessons", 0),
                "total_quizzes": stats.get("quizzes", 0),
                "average_score": stats.get("avg_score", 0),
            },
            payload_type="insights",
            human_summary=f"Generated insights from {len(history)} learning activities"
        )
        
    except Exception as e:
        logger.error("Failed to get learning insights", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations/{user_id}")
async def get_recommendations(
    user_id: str,
    api_key: AuthenticatedUser,
    limit: int = 5,
):
    """Get personalized topic recommendations."""
    try:
        # Fetch user progress and roadmaps
        progress_doc = db.db.collection("user_progress").document(user_id).get()
        
        # Try both camelCase and snake_case for maximum compatibility
        docs_camel = db.db.collection("roadmaps").where("userId", "==", user_id).stream()
        docs_snake = db.db.collection("roadmaps").where("user_id", "==", user_id).stream()
        
        seen_ids = set()
        roadmaps = []
        
        for doc in docs_camel:
            if doc.id not in seen_ids:
                roadmaps.append(doc.to_dict())
                seen_ids.add(doc.id)
        
        for doc in docs_snake:
            if doc.id not in seen_ids:
                roadmaps.append(doc.to_dict())
                seen_ids.add(doc.id)
        
        progress = progress_doc.to_dict() if progress_doc.exists else {"history": [], "stats": {}}
        history = progress.get("history", [])
        
        # Get completed topics
        completed_topics = set()
        for item in history:
            if item.get("item_type") == "lesson":
                completed_topics.add(item.get("title", "").lower())
        
        # Find incomplete topics from roadmaps
        incomplete_topics = []
        for roadmap in roadmaps:
            for module in roadmap.get("modules", []):
                for topic in module.get("topics", []):
                    if topic.lower() not in completed_topics:
                        incomplete_topics.append({
                            "topic": topic,
                            "roadmap": roadmap.get("technology", "Unknown"),
                            "module": module.get("title", ""),
                            "priority": calculate_topic_priority(topic, history)
                        })
        
        # Sort by priority and limit
        incomplete_topics.sort(key=lambda x: x["priority"], reverse=True)
        recommendations = incomplete_topics[:limit]
        
        # If no roadmaps, suggest general topics
        if not recommendations:
            recommendations = [
                {"topic": "Python Basics", "reason": "Great starting point for programming"},
                {"topic": "JavaScript Fundamentals", "reason": "Essential for web development"},
                {"topic": "Data Structures", "reason": "Foundation for problem solving"},
            ][:limit]
        
        return create_response(
            model="recommendations-v1",
            payload={
                "recommendations": recommendations,
                "completed_count": len(completed_topics),
                "total_available": len(incomplete_topics) + len(completed_topics),
            },
            payload_type="recommendations",
            human_summary=f"Suggested {len(recommendations)} topics to study next"
        )
        
    except Exception as e:
        logger.error("Failed to get recommendations", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


def extract_topic(title: str) -> str:
    """Extract main topic from a title."""
    keywords = ["Python", "JavaScript", "React", "HTML", "CSS", "SQL", "Data", 
                "Algorithm", "Machine Learning", "API", "Database", "Testing"]
    for kw in keywords:
        if kw.lower() in title.lower():
            return kw
    return title.split()[0] if title else "General"


def analyze_learning_patterns(history: List[Dict]) -> Dict[str, Any]:
    """Analyze when the user typically learns."""
    if not history:
        return {"preferred_time": "unknown", "most_active_day": "unknown", "avg_session_length": 0}
    
    hour_counts = {}
    day_counts = {}
    
    for item in history:
        timestamp = item.get("completed_at", "")
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                hour = dt.hour
                day = dt.strftime("%A")
                
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
                day_counts[day] = day_counts.get(day, 0) + 1
            except:
                pass
    
    # Determine preferred time
    preferred_time = "unknown"
    if hour_counts:
        peak_hour = max(hour_counts, key=hour_counts.get)
        if 5 <= peak_hour < 12:
            preferred_time = "morning"
        elif 12 <= peak_hour < 17:
            preferred_time = "afternoon"
        elif 17 <= peak_hour < 21:
            preferred_time = "evening"
        else:
            preferred_time = "night"
    
    # Determine most active day
    most_active_day = max(day_counts, key=day_counts.get) if day_counts else "unknown"
    
    return {
        "preferred_time": preferred_time,
        "most_active_day": most_active_day,
        "total_activities": len(history),
        "activities_this_week": sum(1 for h in history if is_within_days(h.get("completed_at"), 7)),
    }


def calculate_streak_details(history: List[Dict]) -> Dict[str, Any]:
    """Calculate learning streak details."""
    if not history:
        return {"current": 0, "longest": 0, "total_days": 0}
    
    # Get unique days of activity
    active_days = set()
    for item in history:
        timestamp = item.get("completed_at", "")
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                active_days.add(dt.date())
            except:
                pass
    
    if not active_days:
        return {"current": 0, "longest": 0, "total_days": 0}
    
    # Sort days
    sorted_days = sorted(active_days)
    today = datetime.now(timezone.utc).date()
    
    # Calculate current streak
    current_streak = 0
    check_date = today
    while check_date in active_days or (check_date == today and (today - timedelta(days=1)) in active_days):
        if check_date in active_days:
            current_streak += 1
        check_date -= timedelta(days=1)
        if check_date not in active_days and check_date != today:
            break
    
    # Calculate longest streak
    longest_streak = 1
    current_run = 1
    for i in range(1, len(sorted_days)):
        if (sorted_days[i] - sorted_days[i-1]).days == 1:
            current_run += 1
            longest_streak = max(longest_streak, current_run)
        else:
            current_run = 1
    
    return {
        "current": current_streak,
        "longest": longest_streak,
        "total_days": len(active_days),
    }


def is_within_days(timestamp: str, days: int) -> bool:
    """Check if timestamp is within the last N days."""
    if not timestamp:
        return False
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        return dt >= cutoff
    except:
        return False


def calculate_topic_priority(topic: str, history: List[Dict]) -> float:
    """Calculate priority score for a topic recommendation."""
    # Base priority
    priority = 1.0
    
    # Boost if related to recent learning
    recent_topics = []
    for item in history[-10:]:
        recent_topics.append(item.get("title", "").lower())
    
    topic_lower = topic.lower()
    for recent in recent_topics:
        # Simple keyword overlap
        if any(word in recent for word in topic_lower.split()):
            priority += 0.5
    
    return priority


def generate_recommendations(
    strongest: List[Dict],
    improvement: List[Dict],
    patterns: Dict,
    stats: Dict
) -> List[str]:
    """Generate personalized recommendations based on learning data."""
    recommendations = []
    
    # Based on improvement areas
    if improvement:
        weakest = improvement[0]
        recommendations.append(
            f"Focus on {weakest['topic']} - your average score is {weakest['average_score']}%. "
            "Consider reviewing the fundamentals."
        )
    
    # Based on learning patterns
    preferred_time = patterns.get("preferred_time", "unknown")
    if preferred_time != "unknown":
        recommendations.append(
            f"You learn best in the {preferred_time}. "
            "Try to schedule study sessions during this time."
        )
    
    # Based on activity
    activities_this_week = patterns.get("activities_this_week", 0)
    if activities_this_week < 3:
        recommendations.append(
            "Try to complete at least 3 lessons per week to maintain momentum."
        )
    elif activities_this_week >= 7:
        recommendations.append(
            "Great consistency! Consider taking short breaks to avoid burnout."
        )
    
    # Based on quiz performance
    avg_score = stats.get("avg_score", 0)
    if avg_score > 0 and avg_score < 70:
        recommendations.append(
            "Review lessons before taking quizzes to improve your scores."
        )
    elif avg_score >= 90:
        recommendations.append(
            "Excellent quiz performance! Consider moving to more advanced topics."
        )
    
    # Ensure we have at least one recommendation
    if not recommendations:
        recommendations.append("Keep up the great work! Consistency is key to learning success.")
    
    return recommendations[:5]
