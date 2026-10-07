"""
Lesson Bookmarks API - Save and manage bookmarked lessons.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser
from shared.storage.firebase_client import get_firebase_client
from shared.utils import create_response, get_logger

logger = get_logger(__name__)

router = APIRouter()

db = get_firebase_client()

BOOKMARKS_COLLECTION = "bookmarks"


class CreateBookmarkRequest(BaseModel):
    """Request to create a bookmark."""
    user_id: str
    lesson_id: str
    lesson_title: str
    lesson_topic: str
    roadmap_id: Optional[str] = None
    notes: Optional[str] = None
    highlight_text: Optional[str] = None


class UpdateBookmarkRequest(BaseModel):
    """Request to update a bookmark."""
    notes: Optional[str] = None


@router.post("/bookmarks")
async def create_bookmark(
    request: CreateBookmarkRequest,
    api_key: AuthenticatedUser,
):
    """Create a new bookmark."""
    try:
        bookmark_id = f"bm_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        
        bookmark = {
            "id": bookmark_id,
            "user_id": request.user_id,
            "lesson_id": request.lesson_id,
            "lesson_title": request.lesson_title,
            "lesson_topic": request.lesson_topic,
            "roadmap_id": request.roadmap_id,
            "notes": request.notes,
            "highlight_text": request.highlight_text,
            "created_at": now,
            "updated_at": now,
        }
        
        # Check for duplicate
        existing = (
            db.db.collection(BOOKMARKS_COLLECTION)
            .where("user_id", "==", request.user_id)
            .where("lesson_id", "==", request.lesson_id)
            .limit(1)
            .get()
        )
        
        if len(list(existing)) > 0:
            raise HTTPException(status_code=409, detail="Bookmark already exists")
        
        db.db.collection(BOOKMARKS_COLLECTION).document(bookmark_id).set(bookmark)
        
        logger.info("Bookmark created", bookmark_id=bookmark_id, lesson_id=request.lesson_id)
        
        return create_response(
            model="bookmarks-v1",
            payload=bookmark,
            payload_type="bookmark",
            human_summary=f"Bookmarked: {request.lesson_title}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create bookmark", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks/{user_id}")
async def list_bookmarks(
    user_id: str,
    api_key: AuthenticatedUser,
    limit: int = 50,
):
    """List all bookmarks for a user."""
    try:
        docs = (
            db.db.collection(BOOKMARKS_COLLECTION)
            .where("user_id", "==", user_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        
        bookmarks = [doc.to_dict() for doc in docs]
        
        return create_response(
            model="bookmarks-v1",
            payload={"bookmarks": bookmarks, "total": len(bookmarks)},
            payload_type="bookmark_list",
            human_summary=f"Found {len(bookmarks)} bookmarks"
        )
        
    except Exception as e:
        logger.error("Failed to list bookmarks", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks/{user_id}/{bookmark_id}")
async def get_bookmark(
    user_id: str,
    bookmark_id: str,
    api_key: AuthenticatedUser,
):
    """Get a specific bookmark."""
    try:
        doc = db.db.collection(BOOKMARKS_COLLECTION).document(bookmark_id).get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        
        bookmark = doc.to_dict()
        
        if bookmark.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return create_response(
            model="bookmarks-v1",
            payload=bookmark,
            payload_type="bookmark",
            human_summary=f"Bookmark: {bookmark.get('lesson_title')}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get bookmark", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/bookmarks/{user_id}/{bookmark_id}")
async def update_bookmark(
    user_id: str,
    bookmark_id: str,
    request: UpdateBookmarkRequest,
    api_key: AuthenticatedUser,
):
    """Update a bookmark's notes."""
    try:
        doc_ref = db.db.collection(BOOKMARKS_COLLECTION).document(bookmark_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        
        bookmark = doc.to_dict()
        
        if bookmark.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        now = datetime.now(timezone.utc).isoformat()
        updates = {"updated_at": now}
        
        if request.notes is not None:
            updates["notes"] = request.notes
        
        doc_ref.update(updates)
        
        return create_response(
            model="bookmarks-v1",
            payload={"id": bookmark_id, **updates},
            payload_type="bookmark_update",
            human_summary="Bookmark updated"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update bookmark", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bookmarks/{user_id}/{bookmark_id}")
async def delete_bookmark(
    user_id: str,
    bookmark_id: str,
    api_key: AuthenticatedUser,
):
    """Delete a bookmark."""
    try:
        doc_ref = db.db.collection(BOOKMARKS_COLLECTION).document(bookmark_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        
        bookmark = doc.to_dict()
        
        if bookmark.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        doc_ref.delete()
        
        logger.info("Bookmark deleted", bookmark_id=bookmark_id)
        
        return create_response(
            model="bookmarks-v1",
            payload={"deleted": True, "id": bookmark_id},
            payload_type="bookmark_delete",
            human_summary="Bookmark removed"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete bookmark", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks/{user_id}/check/{lesson_id}")
async def check_bookmark(
    user_id: str,
    lesson_id: str,
    api_key: AuthenticatedUser,
):
    """Check if a lesson is bookmarked."""
    try:
        docs = list(
            db.db.collection(BOOKMARKS_COLLECTION)
            .where("user_id", "==", user_id)
            .where("lesson_id", "==", lesson_id)
            .limit(1)
            .stream()
        )
        
        is_bookmarked = len(docs) > 0
        bookmark_id = docs[0].to_dict().get("id") if is_bookmarked else None
        
        return create_response(
            model="bookmarks-v1",
            payload={"is_bookmarked": is_bookmarked, "bookmark_id": bookmark_id},
            payload_type="bookmark_check",
            human_summary="Bookmark checked"
        )
        
    except Exception as e:
        logger.error("Failed to check bookmark", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
