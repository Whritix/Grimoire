"""
Conversation Management Router - CRUD operations for chat history persistence.
Stores conversations in Firestore under users/{userId}/conversations
"""

import uuid
import base64
import secrets
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser
from shared.storage.firebase_client import get_firebase_client
from shared.utils import create_response, get_logger

logger = get_logger(__name__)

router = APIRouter()

# Get Firebase client
db = get_firebase_client()

CONVERSATIONS_COLLECTION = "conversations"


# Helper to save base64 image to disk
def save_image_to_disk(image_data: str) -> str | None:
    """
    Saves a base64 image string to public/uploads and returns the relative URL.
    Expects data URI: 'data:image/png;base64,...' or raw base64 (assumed jpeg).
    """
    if not image_data or len(image_data) < 100:
        return None
        
    try:
        # Check for data URI header
        header = ""
        base64_str = image_data
        ext = "jpeg" # Default extension
        
        if "data:image" in image_data and ";base64," in image_data:
            header, base64_str = image_data.split(";base64,")
            # Extract extension
            if "image/" in header:
                ext = header.split("image/")[1].split(";")[0]
        
        # Decode
        image_bytes = base64.b64decode(base64_str)
        
        # Generate filename
        filename = f"{secrets.token_hex(8)}.{ext}"
        
        # Determine path (relative to backend execution)
        # Absolute path to frontend/public/uploads
        # backend/services/doubt/conversation_router.py -> backend -> root
        base_dir = Path(__file__).parent.parent.parent.parent
        upload_dir = base_dir / "frontend" / "public" / "uploads"
        
        # Create directory if it doesn't exist (safety)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = upload_dir / filename
        file_path.write_bytes(image_bytes)
        
        return f"/uploads/{filename}"
        
    except Exception as e:
        logger.error(f"Failed to save image to disk: {e}")
        return None


class Message(BaseModel):
    """Chat message."""
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None
    image: Optional[str] = None


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    user_id: str
    title: Optional[str] = None
    messages: Optional[List[Message]] = []


class UpdateConversationRequest(BaseModel):
    """Request to add messages to a conversation."""
    messages: List[Message]


class ConversationResponse(BaseModel):
    """Conversation response model."""
    id: str
    user_id: str
    title: str
    messages: List[dict]
    created_at: str
    updated_at: str


def generate_title_from_content(content: str) -> str:
    """Generate a short title from the first message content."""
    # Take first 50 chars and clean up
    title = content[:50].strip()
    if len(content) > 50:
        title += "..."
    # Remove newlines
    title = title.replace('\n', ' ').replace('\r', '')
    return title or "New Chat"


@router.post("/conversations")
async def create_conversation(
    request: CreateConversationRequest,
    api_key: AuthenticatedUser,
):
    """Create a new conversation."""
    try:
        # Use authenticated user ID
        user_id = api_key.user_id
        
        conversation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Generate title from first message if not provided
        title = request.title
        if not title and request.messages:
            first_user_msg = next(
                (m for m in request.messages if m.role == "user"),
                None
            )
            if first_user_msg:
                title = generate_title_from_content(first_user_msg.content)
        title = title or "New Chat"
        
        # Prepare messages with timestamps and handle images
        messages = []
        for msg in request.messages or []:
            image_url = msg.image
            # If image is base64 data URI, save it to disk
            if image_url and image_url.startswith("data:"):
                saved_url = save_image_to_disk(image_url)
                if saved_url:
                    image_url = saved_url
            
            messages.append({
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp or now,
                "image": image_url
            })
        
        conversation = {
            "id": conversation_id,
            "user_id": user_id,
            "title": title,
            "messages": messages,
            "created_at": now,
            "updated_at": now,
        }
        
        # Store in Firestore
        db.db.collection(CONVERSATIONS_COLLECTION).document(conversation_id).set(conversation)
        
        logger.info("Conversation created", conversation_id=conversation_id, user_id=user_id)
        
        return create_response(
            model="conversation-v1",
            payload=conversation,
            payload_type="conversation",
            human_summary=f"Created conversation: {title}"
        )
    except Exception as e:
        logger.error("Failed to create conversation", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations")
async def list_conversations(
    api_key: AuthenticatedUser,
    limit: int = 20,
):
    """List all conversations for the authenticated user."""
    user_id = api_key.user_id
    try:
        # Query conversations for user, ordered by updated_at descending
        docs = (
            db.db.collection(CONVERSATIONS_COLLECTION)
            .where("user_id", "==", user_id)
            .order_by("updated_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        
        conversations = []
        for doc in docs:
            data = doc.to_dict()
            # Return summary info (not full messages)
            conversations.append({
                "id": data.get("id"),
                "title": data.get("title"),
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at"),
                "message_count": len(data.get("messages", [])),
            })
        
        logger.info("Listed conversations", user_id=user_id, count=len(conversations))
        
        return create_response(
            model="conversation-v1",
            payload={"conversations": conversations, "total": len(conversations)},
            payload_type="conversation_list",
            human_summary=f"Found {len(conversations)} conversations"
        )
    except Exception as e:
        logger.error("Failed to list conversations", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    api_key: AuthenticatedUser,
):
    """Get a specific conversation with full messages."""
    user_id = api_key.user_id
    try:
        doc = db.db.collection(CONVERSATIONS_COLLECTION).document(conversation_id).get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        data = doc.to_dict()
        
        # Verify ownership
        if data.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.info("Retrieved conversation", conversation_id=conversation_id)
        
        return create_response(
            model="conversation-v1",
            payload=data,
            payload_type="conversation",
            human_summary=f"Loaded conversation: {data.get('title')}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get conversation", conversation_id=conversation_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    request: UpdateConversationRequest,
    api_key: AuthenticatedUser,
):
    """Add messages to an existing conversation."""
    user_id = api_key.user_id
    try:
        doc_ref = db.db.collection(CONVERSATIONS_COLLECTION).document(conversation_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        data = doc.to_dict()
        
        # Verify ownership
        if data.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Add new messages
        existing_messages = data.get("messages", [])
        for msg in request.messages:
            image_url = msg.image
            # If image is base64 data URI, save it to disk
            if image_url and image_url.startswith("data:"):
                saved_url = save_image_to_disk(image_url)
                if saved_url:
                    image_url = saved_url
            
            existing_messages.append({
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp or now,
                "image": image_url
            })
        
        # Update the document
        doc_ref.update({
            "messages": existing_messages,
            "updated_at": now,
        })
        
        logger.info("Updated conversation", conversation_id=conversation_id, new_messages=len(request.messages))
        
        return create_response(
            model="conversation-v1",
            payload={
                "id": conversation_id,
                "message_count": len(existing_messages),
                "updated_at": now
            },
            payload_type="conversation_update",
            human_summary=f"Added {len(request.messages)} messages to conversation"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update conversation", conversation_id=conversation_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
