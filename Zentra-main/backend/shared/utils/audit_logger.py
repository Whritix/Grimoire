"""
Audit Logging Utility - Logs security-sensitive actions to Firestore.
Records user activities like login, roadmap CRUD, lesson completion, and quiz submissions.
"""

from datetime import datetime, timezone
from typing import Any, Optional
from enum import Enum

from shared.storage.firebase_client import get_firebase_client
from shared.utils import get_logger

logger = get_logger(__name__)

AUDIT_LOGS_COLLECTION = "audit_logs"


class AuditAction(str, Enum):
    """Audit action types."""
    # Authentication
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    USER_SIGNUP = "user.signup"
    
    # Roadmap operations
    ROADMAP_CREATE = "roadmap.create"
    ROADMAP_UPDATE = "roadmap.update"
    ROADMAP_DELETE = "roadmap.delete"
    
    # Learning activities
    LESSON_START = "lesson.start"
    LESSON_COMPLETE = "lesson.complete"
    QUIZ_START = "quiz.start"
    QUIZ_SUBMIT = "quiz.submit"
    
    # Chat/AI interactions
    CHAT_MESSAGE = "chat.message"
    AI_RESPONSE = "ai.response"
    
    # Bookmarks
    BOOKMARK_CREATE = "bookmark.create"
    BOOKMARK_DELETE = "bookmark.delete"
    
    # Progress
    PROGRESS_UPDATE = "progress.update"
    
    # Security events
    SECURITY_RATE_LIMIT = "security.rate_limit"
    SECURITY_INJECTION_ATTEMPT = "security.injection_attempt"
    SECURITY_AUTH_FAILURE = "security.auth_failure"


def log_audit_event(
    action: AuditAction,
    user_id: str,
    details: Optional[dict[str, Any]] = None,
    resource_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None
) -> bool:
    """
    Log an audit event to Firestore.
    
    Args:
        action: The type of action being logged
        user_id: ID of the user performing the action
        details: Additional details about the action
        resource_id: ID of the affected resource (roadmap, lesson, etc.)
        resource_type: Type of the affected resource
        ip_address: User's IP address (optional, consider privacy)
        user_agent: User's browser/client info
        success: Whether the action was successful
        error_message: Error message if the action failed
        
    Returns:
        True if logging succeeded, False otherwise
    """
    try:
        db = get_firebase_client()
        if not db or not db.db:
            logger.warning("Firebase not available for audit logging")
            return False
        
        now = datetime.now(timezone.utc)
        
        # Build the audit log entry
        log_entry = {
            "action": action.value,
            "user_id": user_id,
            "timestamp": now.isoformat(),
            "timestamp_epoch": int(now.timestamp()),
            "success": success,
        }
        
        # Add optional fields if provided
        if details:
            log_entry["details"] = details
        if resource_id:
            log_entry["resource_id"] = resource_id
        if resource_type:
            log_entry["resource_type"] = resource_type
        if user_agent:
            log_entry["user_agent"] = user_agent
        if error_message:
            log_entry["error_message"] = error_message
        
        # Note: IP address logging is optional for privacy
        # If you need IP tracking, uncomment below and handle GDPR compliance
        # if ip_address:
        #     log_entry["ip_address"] = ip_address
        
        # Generate a unique document ID based on timestamp
        doc_id = f"{action.value}_{user_id}_{int(now.timestamp() * 1000)}"
        
        # Write to Firestore
        db.db.collection(AUDIT_LOGS_COLLECTION).document(doc_id).set(log_entry)
        
        logger.debug(
            "Audit event logged",
            action=action.value,
            user_id=user_id,
            success=success
        )
        return True
        
    except Exception as e:
        logger.error("Failed to log audit event", error=str(e), action=action.value)
        return False


def get_user_audit_logs(
    user_id: str,
    limit: int = 50,
    action_filter: Optional[AuditAction] = None
) -> list[dict]:
    """
    Retrieve audit logs for a specific user.
    
    Args:
        user_id: The user ID to fetch logs for
        limit: Maximum number of logs to return
        action_filter: Optional filter by action type
        
    Returns:
        List of audit log entries
    """
    try:
        db = get_firebase_client()
        if not db or not db.db:
            return []
        
        query = db.db.collection(AUDIT_LOGS_COLLECTION).where(
            "user_id", "==", user_id
        )
        
        if action_filter:
            query = query.where("action", "==", action_filter.value)
        
        query = query.order_by("timestamp_epoch", direction="DESCENDING").limit(limit)
        
        docs = query.stream()
        return [doc.to_dict() for doc in docs]
        
    except Exception as e:
        logger.error("Failed to fetch audit logs", error=str(e), user_id=user_id)
        return []


def get_security_events(limit: int = 100) -> list[dict]:
    """
    Retrieve recent security-related events (for admin monitoring).
    
    Args:
        limit: Maximum number of events to return
        
    Returns:
        List of security audit log entries
    """
    try:
        db = get_firebase_client()
        if not db or not db.db:
            return []
        
        # Query for security events
        security_actions = [
            AuditAction.SECURITY_RATE_LIMIT.value,
            AuditAction.SECURITY_INJECTION_ATTEMPT.value,
            AuditAction.SECURITY_AUTH_FAILURE.value,
        ]
        
        query = db.db.collection(AUDIT_LOGS_COLLECTION).where(
            "action", "in", security_actions
        ).order_by("timestamp_epoch", direction="DESCENDING").limit(limit)
        
        docs = query.stream()
        return [doc.to_dict() for doc in docs]
        
    except Exception as e:
        logger.error("Failed to fetch security events", error=str(e))
        return []


# Convenience functions for common audit events
def audit_login(user_id: str, user_agent: Optional[str] = None, success: bool = True):
    """Log a user login event."""
    return log_audit_event(
        AuditAction.USER_LOGIN,
        user_id,
        user_agent=user_agent,
        success=success
    )


def audit_lesson_complete(user_id: str, lesson_id: str, lesson_title: str, score: Optional[float] = None):
    """Log a lesson completion event."""
    return log_audit_event(
        AuditAction.LESSON_COMPLETE,
        user_id,
        resource_id=lesson_id,
        resource_type="lesson",
        details={"title": lesson_title, "score": score}
    )


def audit_quiz_submit(user_id: str, quiz_id: str, topic: str, score: float, total_questions: int):
    """Log a quiz submission event."""
    return log_audit_event(
        AuditAction.QUIZ_SUBMIT,
        user_id,
        resource_id=quiz_id,
        resource_type="quiz",
        details={
            "topic": topic,
            "score": score,
            "total_questions": total_questions
        }
    )


def audit_roadmap_action(user_id: str, roadmap_id: str, action: str, title: str):
    """Log a roadmap CRUD action."""
    action_map = {
        "create": AuditAction.ROADMAP_CREATE,
        "update": AuditAction.ROADMAP_UPDATE,
        "delete": AuditAction.ROADMAP_DELETE,
    }
    return log_audit_event(
        action_map.get(action, AuditAction.ROADMAP_UPDATE),
        user_id,
        resource_id=roadmap_id,
        resource_type="roadmap",
        details={"title": title}
    )


def audit_security_event(user_id: str, event_type: str, details: dict):
    """Log a security event."""
    action_map = {
        "rate_limit": AuditAction.SECURITY_RATE_LIMIT,
        "injection": AuditAction.SECURITY_INJECTION_ATTEMPT,
        "auth_failure": AuditAction.SECURITY_AUTH_FAILURE,
    }
    return log_audit_event(
        action_map.get(event_type, AuditAction.SECURITY_AUTH_FAILURE),
        user_id,
        details=details,
        success=False
    )
