"""
Doubt Assistant Agent - RAG-powered Q&A with citations.
Enhanced to use Gemini's base knowledge when no documents are provided.
"""

from pathlib import Path
from typing import Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser, default_limit
from shared.middleware.sanitizer import sanitize_message_content, sanitize_string_field
from shared.models import get_model_router, AgentType
from shared.utils import create_response, get_logger

logger = get_logger(__name__)

router = APIRouter()

# Load prompt template
PROMPT_PATH = Path(__file__).parent.parent.parent / "shared" / "prompts" / "doubt_assistant.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""

# System prompt for general knowledge mode (no documents)
GENERAL_KNOWLEDGE_PROMPT = """
You are a powerful AI Learning Assistant for the GRIMOIRE platform. 
Your primary goal is to help users learn tech skills, prepare for interviews, and track their progress.

### CONTEXT AWARENESS:
1. **PRACTICAL KNOWLEDGE**: You have access to the "User Activity Context" provided at the beginning of the user prompt. 
2. **PERSONALIZATION**: Use this data to reference the user's recent interviews, scores, roadmaps, and viewed lessons.
3. **NO GENERIC FALLBACKS**: If the context contains specific data about a user's last interview or score, DO NOT say "I don't have a record." Instead, use the exact metrics or session info from the context.

### STYLE GUIDELINES:
- Be encouraging, professional, and data-driven.
- Use Markdown for structure (headers, bold, tables).
- Keep responses information-rich and directly answer history questions based on the provided data.
- Do NOT wrap your response in JSON. Write directly in Markdown.
"""



# Helper function for topic extraction (Simple keyword based)
def extract_topics(text: str) -> list[str]:
    """Extract key topics from text using simple heuristics."""
    if not text:
        return []
    
    # Common stopwords to ignore
    stops = {"what", "how", "when", "where", "why", "who", "is", "are", "can", "do", "does", "the", "a", "an", "in", "on", "at", "to", "for", "of", "with", "about"}
    
    import re
    # Find words with 4+ chars
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    
    # Filter stopwords and return unique
    topics = [w for w in words if w not in stops]
    return list(dict.fromkeys(topics))[:5]  # Unique, max 5


class Message(BaseModel):
    """Chat message."""
    role: str
    content: str


class Document(BaseModel):
    """Context document."""
    id: str
    title: str | None = None
    text: str
    url: str | None = None


class DoubtRequest(BaseModel):
    """Doubt assistant request."""
    model: str = "doubt-v1"
    messages: list[Message]
    documents: list[Document] | None = None
    images: list[str] | None = None  # New: List of base64 image strings
    current_lesson: dict[str, Any] | None = None
    user_profile: dict[str, Any] | None = None
    user_id: str = "default_user"  # For personalization
    temperature: float = 0.5
    max_tokens: int = 8000
    schema_version: str = "1.0"
    use_general_knowledge: bool = True  # New: Allow general knowledge when no docs
    agents: list[str] | None = None  # New: Multi-agent study group participants



@router.post("/doubt-assistant")
# @default_limit
async def answer_doubt(
    request: DoubtRequest,
    api_key: AuthenticatedUser,
    background_tasks: BackgroundTasks,
):
    """
    Answer learner questions with citations.
    
    Uses RAG when documents are provided, or Gemini's base knowledge
    when no documents are available. Personalizes responses based on user history.
    Supports Multi-Agent "Study Group" mode.
    """
    from shared.activity import log_activity, get_user_context, get_chat_history, ActivityLogger, get_user_profile
    from services.progress.router import get_user_progress_data
    from services.progress.saved_plans import get_user_plans, get_active_plan
    from shared.models import ModelTarget
    
    logger.info("Doubt request", message_count=len(request.messages), user_id=request.user_id, agents=request.agents, has_images=bool(request.images))
    
    # Sanitize user input messages to prevent prompt injection
    sanitized_messages = sanitize_message_content([{"role": m.role, "content": m.content} for m in request.messages])
    
    logger.info(f"Doubt Request Received. Has images: {bool(request.images)}")
    if request.images:
        logger.info(f"Image count: {len(request.images)}")
        logger.info(f"First image start: {request.images[0][:50]}...")
    else:
        logger.info("No images found in request.")

    # Update request messages with sanitized content
    for i, msg in enumerate(request.messages):
        if msg.role == "user":
            msg.content = sanitized_messages[i]["content"]
    
    # Get personalization context and history
    user_context = get_user_context(request.user_id)
    chat_history = get_chat_history(request.user_id, limit=5)
    
    # Get vector memories (NEW)
    from shared.memory.vector_store import get_vector_store
    
    # Extract the user's latest question to search memory
    last_user_message = request.messages[-1].content if request.messages else ""
    
    vector_memories = []
    if last_user_message:
        try:
            # Search for similar past interactions/activities
            # This is a read operation, usually fast if loaded
            vector_store = get_vector_store()
            memories = vector_store.search_memories(request.user_id, last_user_message, limit=3)
            for m in memories:
                # Format: "Type: [Activity] - Content"
                vector_memories.append(f"- {m['text']}")
        except Exception as e:
            logger.error(f"Failed to fetch vector memories: {e}")
            

    # Get detailed user progress data
    user_progress = await get_user_progress_data(request.user_id)
    user_stats = user_progress.get("stats", {"lessons": 0, "quizzes": 0, "avg_score": 0.0, "difficulty_level": "Beginner"})
    user_history = user_progress.get("history", [])
    
    # Get user profile from activity logger
    profile_data = get_user_profile(request.user_id)
    user_profile_info = profile_data.get("profile", {})
    activity_stats = profile_data.get("stats", {})
    
    # Get saved courses/plans
    saved_plans = get_user_plans(request.user_id)
    active_plan = get_active_plan(request.user_id)
    
    # Merge stats from both sources to ensure accuracy
    lessons_from_progress = user_stats.get('lessons', 0)
    lessons_from_activities = activity_stats.get('lessons_completed', 0)
    total_lessons = max(lessons_from_progress, lessons_from_activities)
    
    quizzes_from_progress = user_stats.get('quizzes', 0)
    quizzes_taken_from_activities = activity_stats.get('quizzes_taken', 0)
    assessments_from_activities = activity_stats.get('assessments_completed', 0)
    
    # Total quizzes should be the max of the consolidated counter vs individual counters
    total_quizzes = max(quizzes_from_progress, quizzes_taken_from_activities + assessments_from_activities)
    
    avg_score = user_stats.get('avg_score', 0)

    # Build detailed progress context
    progress_context = f"""
## User Learning Progress (Global Stats):
- **Lessons Completed**: {total_lessons}
- **Quizzes Taken**: {total_quizzes}
- **Average Quiz Score**: {avg_score}%
- **Current Difficulty Level**: {user_stats.get('difficulty_level', 'Beginner')}
- **Videos Analyzed**: {activity_stats.get('videos_analyzed', 0)}
- **Chat Messages Sent**: {activity_stats.get('chat_messages', 0)}
- **Interviews Completed**: {activity_stats.get('interviews_completed', 0)}
- **Topics of Interest**: {', '.join(user_profile_info.get('topics_of_interest', [])) or 'None recorded yet'}
"""

    # Add interview performance if available
    recent_interviews = activity_stats.get("recent_scores", {}).get("interview", [])
    if recent_interviews:
        avg_int = sum(recent_interviews) / len(recent_interviews)
        last_int = recent_interviews[-1]
        progress_context += f"- **Interview Avg Score**: {avg_int:.1f}/5\n"
        progress_context += f"- **Last Interview Score**: {last_int}/5\n"

    progress_context += f"\n## Saved Courses/Learning Plans ({len(saved_plans)} total):\n"
    
    # Add saved plans info
    if saved_plans:
        for plan in saved_plans:
            progress_context += f"- **{plan.get('title', 'Untitled')}**: {plan.get('progress_pct', 0)}% complete ({plan.get('completed_items', 0)}/{plan.get('total_items', 0)} items)\n"
    else:
        progress_context += "- No courses saved yet.\n"
    
    # Add active plan details
    if active_plan:
        progress_context += f"\n### Currently Active Course: {active_plan.get('title', 'Unknown')}\n"
        progress_context += f"- Goal: {active_plan.get('goal', 'Not specified')}\n"
        progress_context += f"- Progress: {active_plan.get('progress_pct', 0)}%\n"
        
        # Add items
        items = active_plan.get("items", [])
        if items:
            progress_context += "- Key Modules:\n"
            for i, item in enumerate(items[:5]):  # Show first 5
                status = "✅" if item.get("completed") else "⬜"
                progress_context += f"  {status} {item.get('title', f'Item {i+1}')}\n"
    
    # Add recent history (Detailed Quizzes & Assessments)
    if user_history:
        recent_items = user_history[-10:]  # Last 10 items
        progress_context += "\n### Detailed History (Recent Quizzes & Lessons):\n"
        for item in recent_items:
            item_type = item.get('item_type', 'item').title()
            title = item.get('title', 'Unknown')
            score = item.get('score', 'N/A')
            completed_at = item.get('completed_at', '')
            date_str = completed_at.split('T')[0] if completed_at else 'N/A'
            
            if item.get('item_type') in ["quiz", "assessment"]:
                progress_context += f"- **{item_type}**: {title} | **Score: {score}%** ({date_str})\n"
            else:
                progress_context += f"- {item_type}: {title} ({date_str})\n"
    
    # Add summary of strengths/weaknesses from recent assessments if available
    recent_assessments = [h for h in user_history if h.get("item_type") == "assessment"]
    if recent_assessments:
        last_assessment = recent_assessments[-1]
        progress_context += f"\n### Latest Assessment Insight ({last_assessment.get('title')}):\n"
        progress_context += f"- The user recently completed an assessment on {last_assessment.get('title')} with a score of {last_assessment.get('score')}%.\n"
    
    # Check if we have documents
    has_documents = request.documents and len(request.documents) > 0
    
    # Build context from documents
    docs_context = ""
    if has_documents:
        docs_context = "\n\n".join([
            f"[{doc.id}] {doc.title or 'Document'}: {doc.text[:1500]}"
            for doc in request.documents
        ])
    
    # Build conversation (current session)
    conversation = "\n".join([
        f"{msg.role.upper()}: {msg.content}"
        for msg in request.messages
    ])
    
    # Add lesson context
    lesson_context = ""
    if request.current_lesson:
        title = request.current_lesson.get('title', 'N/A')
        content = request.current_lesson.get('content', '')
        lesson_context = f"\n## Current Lesson Context\nTitle: {title}\n"
        if content:
             lesson_context += f"Lesson Content:\n{content[:5000]}\n"
    
    
    # --- PROMPT STRATEGY ---
    force_groq = False
    images = request.images or []
    
    # MULTI-AGENT STUDY GROUP MODE
    if request.agents and len(request.agents) > 0:
        # Load study group prompt
        STUDY_GROUP_PATH = Path(__file__).parent.parent.parent / "shared" / "prompts" / "study_group.md"
        system_prompt = STUDY_GROUP_PATH.read_text(encoding="utf-8") if STUDY_GROUP_PATH.exists() else GENERAL_KNOWLEDGE_PROMPT
        
        # Inject context directly into system prompt variables if using f-string, but here we construct user prompt
        # We'll stick to a simple strategy: System prompt sets the persona, User prompt provides data.
        
        user_prompt = f"""
### INPUT DATA
User Question: {last_user_message}

Active Agents: {', '.join(request.agents)}

User Context:
{user_context}
{progress_context}
{lesson_context}

Available Documents:
{docs_context}

Conversation History:
{conversation}

Please start the study group discussion now.
"""
        # Prefer Groq for study groups (faster inference for long contexts)
        force_groq = True
        mode = "study_group"

    else:
        # STANDARD DOUBT MODE
        # Use GENERAL_KNOWLEDGE_PROMPT for teaching (returns markdown)
        # Use SYSTEM_PROMPT for RAG mode (returns JSON with citations)
        
        # If no documents provided, use general knowledge prompt for markdown output
        # Also use general knowledge layout if we have images (Images generally need open-ended responses)
        if not has_documents or images:
            system_prompt = GENERAL_KNOWLEDGE_PROMPT
        else:
            system_prompt = SYSTEM_PROMPT or GENERAL_KNOWLEDGE_PROMPT
        
        memory_context = ""
        if vector_memories:
            memory_context = "\n### Relevant Past Memories (Recall):\n" + "\n".join(vector_memories) + "\n"
        
        image_context = ""
        user_prompt_prefix = ""
        
        if images:
             image_context = """
# 📸 IMAGE ANALYSIS MODE
> [!IMPORTANT] 
> The user has attached an image. **YOUR PRIMARY TASK IS TO ANALYZE THIS IMAGE.** 
> The user's question (e.g., "what is this") refers to the image content.
> IGNORE the "User Learning Progress" or "Current Lesson" context below unless it is directly relevant to explaining the image.
> Do NOT simply summarize the user's stats or dashboard unless explicitly asked to do so.
"""
             force_groq = True # Force Groq for vision as requested
             user_prompt_prefix = image_context

        user_prompt = f"""
{user_prompt_prefix}

{user_context}

{progress_context}

{memory_context}

{chat_history}

{lesson_context}

Available Documents (RAG Context):
{docs_context if docs_context else "No specific documents provided."}

INSTRUCTIONS:
1. Answer the user's latest question.
2. **IMAGE PRIORITY**: If an image is provided (see top of prompt), prioritize analyzing it. The question usually refers to the image.
3. **DO NOT DUMP STATS**: Do NOT include a "Quick snapshot of where you're at" or "User Learning Progress" table unless the user EXPLICITLY asks for their progress.
4. **BE SPECIFIC**: Use the "User Learning Progress" data ONLY if it directly helps answer a specific question. Otherwise, ignore it.
5. **USE MEMORY**: If "Relevant Past Memories" are provided, refer to them if they help answer the question.
6. If the user asks "how is my last interview?", look for "last_int" feedback.
7. Combine information from the 'Available Documents' AND your own General Knowledge.
8. Respond in well-formatted Markdown. Do NOT wrap your response in JSON.

Conversation:
{conversation}
"""
        mode = "hybrid"


    model_router = get_model_router()
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.DOUBT,
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            images=images,
            force_target=ModelTarget.GROQ if force_groq else None
        )
    except Exception as e:
        logger.error("Model error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
    # Parse response
    import json
    import re
    
    content = response.content
    
    # Default payload - assume markdown response
    payload = {
        "answer": content,
        "citations": [],
        "confidence": 0.8,
        "mode": mode,
    }
    
    # Only try JSON parsing if we used RAG mode with documents (and NOT study group)
    # Otherwise the response should be clean markdown
    if has_documents and mode != "study_group" and not images:
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
                # Only use parsed answer if it exists
                if parsed.get("answer"):
                    payload = {
                        "answer": parsed.get("answer"),
                        "citations": parsed.get("citations", []),
                        "confidence": parsed.get("confidence", 0.8),
                        "mode": mode,
                        "topic": parsed.get("topic"),
                        "key_concepts": parsed.get("key_concepts", []),
                        "code_examples": parsed.get("code_examples", []),
                        "next_topics": parsed.get("next_topics", []),
                        "function_call": parsed.get("function_call"),
                    }
            except json.JSONDecodeError:
                pass
    else:
        # Clean markdown mode - strip any accidental JSON wrapper
        if content.strip().startswith('{') and '"answer"' in content:
            try:
                parsed = json.loads(content)
                if parsed.get("answer"):
                    payload["answer"] = parsed.get("answer")
            except json.JSONDecodeError:
                # Try to extract just the answer field
                answer_match = re.search(r'"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]', content, re.DOTALL)
                if answer_match:
                    # Unescape the string
                    payload["answer"] = answer_match.group(1).replace('\\"', '"').replace('\\n', '\n')
    
    # Create summary
    summary = payload["answer"][:500].replace('\n', ' ').strip()
    if len(payload["answer"]) > 500:
        summary += "..."
    
    # Log the chat activity WITH ANSWER for history
    # Run in background to avoid blocking response (Latency optimization)
    last_message = request.messages[-1].content if request.messages else ""
    
    background_tasks.add_task(
        log_activity,
        request.user_id,
        ActivityLogger.CHAT_MESSAGE,
        {
            "question": last_message[:1000], 
            "answer": payload["answer"][:1000],
            "mode": mode,
            "topics": payload.get("key_concepts", []) or extract_topics(last_message),
            "has_code": "```" in payload.get("answer", ""),
            "agents": request.agents, # Log agents if used
            "has_images": bool(images)
        }
    )
    
    note = ""
    return create_response(
        model=request.model,
        payload=payload,
        payload_type="doubt_response",
        human_summary=summary + note,
        confidence=payload["confidence"],
        sources=payload.get("citations", []),
        function_call=payload.get("function_call"),
    )

    return list(dict.fromkeys(topics))[:5]  # Unique, max 5


@router.post("/doubt-assistant/stream")
async def answer_doubt_stream(
    request: DoubtRequest,
    api_key: AuthenticatedUser,
    background_tasks: BackgroundTasks,
):
    """
    Stream answer for learner questions.
    Returns: Server-Sent Events (SSE) stream of text chunks.
    """
    from fastapi.responses import StreamingResponse
    from shared.activity import log_activity, get_user_context, get_chat_history, ActivityLogger, get_user_profile
    from services.progress.router import get_user_progress_data
    from services.progress.saved_plans import get_user_plans, get_active_plan
    from shared.models import ModelTarget
    
    # --- Context Gathering (Same as standard endpoint) ---
    sanitized_messages = sanitize_message_content([{"role": m.role, "content": m.content} for m in request.messages])
    for i, msg in enumerate(request.messages):
        if msg.role == "user":
            msg.content = sanitized_messages[i]["content"]
            
    # Quick context lookup
    user_context = get_user_context(request.user_id)
    chat_history = get_chat_history(request.user_id, limit=5)
    
    # Vector Memory
    from shared.memory.vector_store import get_vector_store
    last_user_message = request.messages[-1].content if request.messages else ""
    vector_memories = []
    if last_user_message:
        try:
            vector_store = get_vector_store()
            memories = vector_store.search_memories(request.user_id, last_user_message, limit=2)
            for m in memories:
                vector_memories.append(f"- {m['text']}")
        except:
            pass

    # Basic Progress Data (Simplified for SPEED for streaming)
    # We don't need full deep analysis for every chat message
    profile_data = get_user_profile(request.user_id)
    activity_stats = profile_data.get("stats", {})
    user_profile_info = profile_data.get("profile", {})
    
    progress_context = f"""
## User Stats:
- Difficulty: {activity_stats.get('difficulty_level', 'Beginner')}
- Topics: {', '.join(user_profile_info.get('topics_of_interest', []))}
"""
    
    # Document Context
    docs_context = ""
    if request.documents:
        docs_context = "\n\n".join([f"[{doc.id}] {doc.text[:1500]}" for doc in request.documents])
        
    conversation = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in request.messages])
    
    
    # Prompt Setup - OVERRIDE for streaming to ensure Markdown output (no JSON)
    # Use a simpler system prompt for streaming chat
    SYSTEM_PROMPT = """
You are GRIMOIRE, an expert AI learning assistant.
Your goal is to help users learn by providing clear, helpful, and accurate answers.
Respond directly in Markdown format.
Do NOT use JSON or any structured data wrappers.
Do NOT mention "I don't have that info" if you can answer from general knowledge.
"""
    
    prompt = f"""
User Context: {user_context}
Stats: {progress_context}
Memories: {vector_memories}
Docs: {docs_context}
Conversation: {conversation}

Instructions:
1. Stream the answer directly in Markdown.
2. Be concise but helpful.
3. If code is requested, use proper markdown code blocks.
"""
    
    # --- Generator Function ---
    async def response_generator():
        model_router = get_model_router()
        full_response = ""
        
        # Determine strict mode or default
        force_groq = True # Default to Groq for speed/streaming
        if request.images:
             force_groq = True # Groq supports vision too now via Llama 3.2/4
        
        try:
            stream = model_router.generate_stream(
                agent_type=AgentType.DOUBT,
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT,
                images=request.images,
                max_tokens=4096, # Increased limit for chat
                force_target=ModelTarget.GROQ if force_groq else None
            )
            
            async for chunk in stream:
                full_response += chunk
                yield chunk

            # --- Background Logging (After stream completes) ---
            # We can't use background_tasks directly inside generator easily for some runners,
            # but we can log right here at the end of the stream iteration.
            try:
                log_activity(
                    request.user_id,
                    ActivityLogger.CHAT_MESSAGE,
                    {
                        "question": last_user_message[:500],
                        "answer": full_response[:1000],
                        "mode": "stream",
                        "has_images": bool(request.images)
                    }
                )
            except Exception as e:
                logger.error(f"Failed to log stream activity: {e}")
                
        except Exception as e:
            yield f"\n\n[Error generating response: {str(e)}]"

    return StreamingResponse(response_generator(), media_type="text/plain")

