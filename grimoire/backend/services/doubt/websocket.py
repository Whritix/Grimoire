"""
WebSocket Handler for Doubt Assistant - Real-time RAG Chat.
Provides real-time chat interface with streaming responses.
"""

import json
import asyncio
from typing import Any
from dataclasses import dataclass, field
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

from shared.models import get_model_router, AgentType
from shared.utils import get_logger

logger = get_logger(__name__)


@dataclass
class ChatSession:
    """Represents a chat session with history."""
    session_id: str
    user_id: str | None = None
    lesson_id: str | None = None
    messages: list[dict] = field(default_factory=list)
    documents: list[dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def add_message(self, role: str, content: str):
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_context_window(self, max_messages: int = 10) -> list[dict]:
        """Get recent messages for context."""
        return self.messages[-max_messages:]


class ConnectionManager:
    """Manages WebSocket connections for real-time chat."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.sessions: dict[str, ChatSession] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str) -> ChatSession:
        """Accept connection and create session."""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        
        # Create or retrieve session
        if session_id not in self.sessions:
            self.sessions[session_id] = ChatSession(session_id=session_id)
        
        logger.info("WebSocket connected", session_id=session_id)
        return self.sessions[session_id]
    
    def disconnect(self, session_id: str):
        """Remove connection on disconnect."""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        logger.info("WebSocket disconnected", session_id=session_id)
    
    async def send_message(self, session_id: str, message: dict):
        """Send message to specific session."""
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)
    
    async def broadcast(self, message: dict):
        """Broadcast to all connections."""
        for websocket in self.active_connections.values():
            await websocket.send_json(message)


# Global connection manager
manager = ConnectionManager()


# System prompt for general knowledge mode (no documents)
GENERAL_KNOWLEDGE_PROMPT = """
You are a helpful teaching assistant with expertise in programming, technology, and academics.

## Your Role
Help learners understand concepts by providing clear, accurate explanations with examples.

## Guidelines
1. **Be Educational**: Explain concepts clearly with examples
2. **Be Structured**: Use step-by-step explanations
3. **Provide Code Examples**: When teaching programming, include working code in fenced code blocks
4. **Suggest Next Steps**: Recommend what to learn next

## Response Format
Respond in well-formatted Markdown:
- Use # for main title, ## for sections
- Use **bold** for important terms
- Use fenced code blocks with language specification (e.g. ```python)
- Use > for tips
- Do NOT use JSON. Write natural text.
"""

# RAG mode prompt (when documents are provided)
RAG_SYSTEM_PROMPT = """
You are a contextual doubt assistant. Use the provided documents to answer questions.
Cite your sources. If uncertain, acknowledge it.

Return JSON: {
  "answer": "your response",
  "citations": [{"id": "doc_id", "text": "relevant excerpt"}],
  "confidence": 0.0-1.0,
  "follow_up_suggestions": ["related questions"]
}
"""


async def handle_doubt_chat(websocket: WebSocket, session_id: str):
    """
    Main WebSocket handler for doubt assistant chat.
    
    Protocol:
    - Client sends: {"type": "message", "content": "question", "documents": [...]}
    - Server sends: {"type": "chunk", "content": "partial..."} (for streaming)
    - Server sends: {"type": "response", "content": {...}} (final)
    - Server sends: {"type": "error", "message": "..."} (on error)
    """
    session = await manager.connect(websocket, session_id)
    
    try:
        # Send welcome message
        await manager.send_message(session_id, {
            "type": "connected",
            "session_id": session_id,
            "message": "Connected to Teaching Assistant. Ask me anything - I can help you learn!"
        })
        
        while True:
            # Receive message from client
            # logger.info("Waiting for message...")
            try:
                data = await websocket.receive_json()
                logger.info(f"Received message type={data.get('type')} size={len(str(data))}")
            except WebSocketDisconnect:
                logger.info("Client disconnected normally during receive")
                raise
            except Exception as rx_e:
                logger.error(f"Error receiving message: {rx_e}")
                # Loop might continue or break depending on severity, but let's break to avoid spin loop
                break
            
            if data.get("type") == "message":
                await process_chat_message(session_id, session, data)
            elif data.get("type") == "set_context":
                # Update session context
                session.lesson_id = data.get("lesson_id")
                session.user_id = data.get("user_id")
                session.documents = data.get("documents", [])
                await manager.send_message(session_id, {
                    "type": "context_updated",
                    "lesson_id": session.lesson_id
                })
            elif data.get("type") == "clear_history":
                session.messages = []
                await manager.send_message(session_id, {
                    "type": "history_cleared"
                })
            elif data.get("type") == "ping":
                await manager.send_message(session_id, {"type": "pong"})
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        logger.error("WebSocket error", session_id=session_id, error=str(e))
        try:
            await manager.send_message(session_id, {
                "type": "error",
                "message": str(e)
            })
        except:
            pass
        manager.disconnect(session_id)


async def process_chat_message(session_id: str, session: ChatSession, data: dict):
    """Process incoming chat message and generate response."""
    # Import base64 safely
    import base64
    import traceback
    
    try:
        content = data.get("content", "")
        image_data = data.get("image")
        documents = data.get("documents", session.documents)
        
        logger.info(f"Processing message sess={session_id} has_image={bool(image_data)}")
        
        # Add user message to history
        session.add_message("user", content)
        
        # Send typing indicator
        await manager.send_message(session_id, {
            "type": "typing",
            "status": True
        })
    
        # Determine mode
        mode = "rag"
        if image_data:
            mode = "vision"
        elif not documents: # and not session.lesson_id: (Use hybrid if no docs)
            mode = "hybrid"
            
        # Get Personalization Context
        from shared.activity import get_user_context, get_chat_history
        # Allow client to override user_id per message, or use session default
        uid = data.get("user_id") or session.user_id
        
        if not uid:
            logger.error(f"Chat message received for session {session_id} without user_id. Personalization disabled.")
            user_context_str = "No user context available."
        else:
            user_context_str = get_user_context(uid)
        
        # Build conversation history from database (persistent) + session (transient)
        # Ideally we use just one source. Let's append session history to persistent if needed.
        # For simplicity, we'll use the session history we just built for immediate context, 
        # and maybe mix in persistent if session is short.
        
        # Using session history for immediate chat context
        history_msgs = session.get_context_window(6) 
        history_json = json.dumps([m for m in history_msgs if m['role'] != 'system'], indent=2)

        # Prepare Context
        if mode == "vision":
            system_prompt = GENERAL_KNOWLEDGE_PROMPT + "\n\nUser has provided an image. Analyze it as requested."
            docs_context = "" 
        elif mode == "hybrid":
            # Hybrid Mode (No specific docs provided)
            # Use General Knowledge + Personalization
             system_prompt = GENERAL_KNOWLEDGE_PROMPT
             docs_context = "No specific documents provided. Rely on general knowledge."
        else:
            # RAG Mode
            docs_text = "\n\n".join([f"Source {i+1}: {d.get('text', '')[:1000]}" for i, d in enumerate(documents)])
            docs_context = f"\n\nContext Documents:\n{docs_text}"
            system_prompt = RAG_SYSTEM_PROMPT

        # HYBRID USER PROMPT
        user_prompt = f"""
{user_context_str}

Current Lesson: {session.lesson_id or 'General Learning'}

{docs_context}

Chat History:
{history_json}

User Question: {content}

Instructions:
1. Answer the question using the Context Documents (if any) and your General Knowledge.
2. Adapt to the User Context provided above.
"""

        # Prepare Image if present
        images = []
        if image_data:
            try:
                # Format: data:image/png;base64,....
                # Validate format
                if "," in image_data:
                    header, encoded = image_data.split(",", 1)
                    if ";" in header and ":" in header:
                        mime_type = header.split(";")[0].split(":")[1]
                    else:
                        mime_type = "image/jpeg" # Default fallback
                else:
                    # Assume raw base64
                    encoded = image_data
                    mime_type = "image/jpeg"
                
                decoded_data = base64.b64decode(encoded)
                images.append({"mime_type": mime_type, "data": decoded_data})
                logger.info(f"Image decoded: {mime_type} len={len(decoded_data)}")
            except Exception as img_e:
                logger.error("Failed to process image", error=str(img_e))
                await manager.send_message(session_id, {"type": "error", "message": "Failed to upload image."})
                return

        # Call Model
        logger.info(f"Calling model router in mode={mode}")
        model_router = get_model_router()
        response = await model_router.generate(
            agent_type=AgentType.DOUBT,
            prompt=user_prompt,
            system_prompt=system_prompt,
            images=images if images else None,
            temperature=0.4,
            max_tokens=6000, 
        )
        logger.info("Model responded")
        
        # Parse Response
        response_content = response.content
        
        # Standardize Output
        payload = {
            "answer": response_content,
            "citations": [],
            "confidence": 0.9,
            "mode": mode
        }
        
        # Add assistant message to history
        session.add_message("assistant", payload["answer"])

        # Log Activity (Persistent)
        from shared.activity import log_activity, ActivityLogger
        u_id = data.get("user_id") or session.user_id
        if u_id:
            log_activity(
                u_id,
                ActivityLogger.CHAT_MESSAGE,
                {
                    "question": content[:1000],
                    "answer": payload["answer"][:1000],
                    "mode": mode,
                    "has_code": "```" in payload["answer"]
                }
            )
        else:
            logger.warning(f"Unable to log chat activity for session {session_id}: missing user_id")
        
        # Send stop typing
        await manager.send_message(session_id, {
            "type": "typing",
            "status": False
        })
        
        # Send response
        await manager.send_message(session_id, {
            "type": "response",
            "content": payload,
            "model_used": response.model_used,
            "latency_ms": response.latency_ms
        })
        
    except Exception as e:
        traceback.print_exc() # Print full stack trace to console
        logger.error("Chat processing error", error=str(e))
        try:
            await manager.send_message(session_id, {
                "type": "typing",
                "status": False
            })
            await manager.send_message(session_id, {
                "type": "error",
                "message": f"Processing Failed: {str(e)}"
            })
        except:
             pass


def get_connection_manager() -> ConnectionManager:
    """Get the global connection manager."""
    return manager
