"""
Notes Intelligence Engine - Analyzes user notes and produces goal-oriented insights.
Operates as an independent analytical layer.
"""

from pathlib import Path
from typing import Any, Literal
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from pydantic import BaseModel, Field

from shared.middleware import AuthenticatedUser
from shared.models import get_model_router, AgentType
from shared.utils import create_response, get_logger
from shared.storage.firebase_client import get_firebase_client
from datetime import datetime

logger = get_logger(__name__)

router = APIRouter()

# Load system prompt
PROMPT_PATH = Path(__file__).parent.parent.parent / "shared" / "prompts" / "notes_intelligence.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""


# --- Request/Response Models ---

class NotesContext(BaseModel):
    """Optional context for more targeted analysis."""
    exam_type: str | None = None        # e.g., "MCQ", "Theory", "Practical"
    time_available: str | None = None   # e.g., "2 hours", "1 week"
    experience_level: str | None = None # e.g., "beginner", "intermediate"
    role: str | None = None             # For interview prep: target role


class NotesIntelligenceRequest(BaseModel):
    """Request model for notes analysis."""
    notes: str = Field(..., min_length=50, description="Raw notes content (min 50 chars)")
    goal: Literal["exam_prep", "interview_prep", "quick_revision", "concept_mastery"]
    subject: str | None = Field(None, description="Subject/domain of the notes")
    context: NotesContext | None = None
    user_id: str


class TopicPriority(BaseModel):
    """A prioritized topic."""
    topic: str
    why_important: str | None = None
    why_skippable: str | None = None
    required_depth: str | None = None
    key_points: list[str] | None = None


class NotesIntelligenceResponse(BaseModel):
    """Response model with prioritized analysis."""
    high_priority: list[TopicPriority]
    medium_priority: list[TopicPriority]
    low_priority: list[TopicPriority]
    common_mistakes: list[str]
    questions: list[str]
    summary: str
    goal: str
    suggested_title: str | None = None



@router.delete("/notes-intelligence/{note_id}")
async def delete_note(note_id: str):
    """Delete a saved note."""
    try:
        client = get_firebase_client()
        success = await client.delete_note(note_id)
        if not success:
             raise HTTPException(status_code=500, detail="Failed to delete note")
        return {"success": True}
    except Exception as e:
        logger.error("Failed to delete note", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))



class SaveNoteRequest(BaseModel):
    """Request to save analysis results."""
    user_id: str
    subject: str
    goal: str
    notes: str
    analysis_result: dict[str, Any]
    mindmap_result: dict[str, Any] | None = None
    podcast_audio_url: str | None = None
    podcast_segments: list[dict[str, Any]] | None = None


# --- Goal Display Names ---
GOAL_DISPLAY = {
    "exam_prep": "Exam Preparation",
    "interview_prep": "Interview Preparation", 
    "quick_revision": "Quick Revision",
    "concept_mastery": "Concept Mastery"
}


@router.post("/notes-intelligence")
async def analyze_notes(
    request: NotesIntelligenceRequest,
    api_key: AuthenticatedUser,
    background_tasks: BackgroundTasks,
):
    """
    Analyze user notes and generate prioritized, goal-oriented insights.
    
    This engine:
    - Extracts explicit and implicit topics
    - Ranks importance based on the stated goal
    - Provides common mistakes and goal-specific questions
    """
    from shared.activity import log_activity, ActivityLogger
    
    logger.info(
        "Notes intelligence request",
        notes_length=len(request.notes),
        goal=request.goal,
        subject=request.subject,
        user_id=request.user_id
    )
    
    # Build context section for prompt
    context_section = ""
    if request.subject:
        context_section += f"Subject/Domain: {request.subject}\n"
    if request.context:
        if request.context.exam_type:
            context_section += f"Exam Type: {request.context.exam_type}\n"
        if request.context.time_available:
            context_section += f"Time Available: {request.context.time_available}\n"
        if request.context.experience_level:
            context_section += f"Experience Level: {request.context.experience_level}\n"
        if request.context.role:
            context_section += f"Target Role: {request.context.role}\n"
    
    # Construct the user prompt
    user_prompt = f"""
## INPUT

### User Goal
{GOAL_DISPLAY.get(request.goal, request.goal)}

### Context
{context_section if context_section else "No additional context provided."}

### Notes to Analyze
```
{request.notes[:15000]}
```

---

Analyze these notes according to the goal "{request.goal}" and return the prioritized JSON output.
The JSON must strictly follow the schema.
IMPORTANT: Also include a "suggested_title" field with a short, relevant title (3-6 words) for these notes based on the content.
"""

    model_router = get_model_router()
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.DOUBT,  # Reuse DOUBT agent type for model routing
            prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=0.3,  # Low temperature for deterministic analysis
            max_tokens=4096,
        )
    except Exception as e:
        logger.error("Model generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    # Parse the JSON response
    import json
    import re
    
    content = response.content.strip()
    
    # Try to extract JSON from the response
    try:
        # First, try direct parse
        if content.startswith("{"):
            parsed = json.loads(content)
        else:
            # Try to find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
    except json.JSONDecodeError as e:
        logger.error("Failed to parse JSON response", error=str(e), content=content[:500])
        # Return a fallback response
        parsed = {
            "high_priority": [{"topic": "Analysis Error", "why_important": "The AI response could not be parsed. Please try again."}],
            "medium_priority": [],
            "low_priority": [],
            "common_mistakes": ["Unable to analyze - please ensure notes are clear and structured"],
            "questions": ["Try resubmitting with clearer notes"],
            "summary": "Analysis failed - please try again"
        }
    
    # Ensure all required fields exist
    result = {
        "high_priority": parsed.get("high_priority", []),
        "medium_priority": parsed.get("medium_priority", []),
        "low_priority": parsed.get("low_priority", []),
        "common_mistakes": parsed.get("common_mistakes", []),
        "questions": parsed.get("questions", []),
        "summary": parsed.get("summary", "Analysis complete"),
        "goal": request.goal,
        "suggested_title": parsed.get("suggested_title", "Untitled Notes")
    }
    
    # Log activity in background
    background_tasks.add_task(
        log_activity,
        request.user_id,
        ActivityLogger.CHAT_MESSAGE,  # Reuse existing activity type
        {
            "action": "notes_intelligence",
            "goal": request.goal,
            "subject": request.subject,
            "notes_length": len(request.notes),
            "topics_found": len(result["high_priority"]) + len(result["medium_priority"]) + len(result["low_priority"])
        }
    )
    
    return create_response(
        model="notes-intelligence-v1",
        payload=result,
        payload_type="notes_intelligence",
        human_summary=result["summary"],
        confidence=0.85,
    )


@router.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    """
    Extract text from an uploaded PDF file using PyMuPDF.
    """
    import fitz  # PyMuPDF

    try:
        # Read file content
        content = await file.read()
        
        # Open PDF from memory
        doc = fitz.open(stream=content, filetype="pdf")
        
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
            
        doc.close()
        
        return {"text": full_text.strip()}

    except Exception as e:
        logger.error("PDF extraction failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)}")


# Load mindmap prompt
MINDMAP_PROMPT_PATH = Path(__file__).parent.parent.parent / "shared" / "prompts" / "mindmap_generator.md"
MINDMAP_SYSTEM_PROMPT = MINDMAP_PROMPT_PATH.read_text(encoding="utf-8") if MINDMAP_PROMPT_PATH.exists() else ""


class MindmapNode(BaseModel):
    """A node in the mindmap."""
    id: str
    type: str  # "center", "branch", or "leaf"
    data: dict[str, Any]


class MindmapEdge(BaseModel):
    """An edge connecting two nodes."""
    id: str
    source: str
    target: str


class MindmapRequest(BaseModel):
    """Request model for mindmap generation."""
    notes: str = Field(..., min_length=50, description="Text content to generate mindmap from (min 50 chars)")
    subject: str | None = Field(None, description="Subject/domain of the content")
    user_id: str


class MindmapResponse(BaseModel):
    """Response model with mindmap data."""
    centerTopic: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


@router.post("/generate-mindmap")
async def generate_mindmap(
    request: MindmapRequest,
    api_key: AuthenticatedUser,
    background_tasks: BackgroundTasks,
):
    """
    Generate an interactive mindmap from text content.
    
    Analyzes the notes/PDF text and creates a hierarchical structure
    with nodes and edges suitable for visualization with React Flow.
    """
    from shared.activity import log_activity, ActivityLogger
    
    logger.info(
        "Mindmap generation request",
        notes_length=len(request.notes),
        subject=request.subject,
        user_id=request.user_id
    )
    
    # Build the user prompt
    subject_context = f"Subject/Domain: {request.subject}\n" if request.subject else ""
    
    user_prompt = f"""
## INPUT

{subject_context}
### Content to Map
```
{request.notes[:15000]}
```

---

## REQUIREMENTS

Generate a **COMPREHENSIVE** hierarchical mindmap structure:

1. Create as many levels of depth as the content naturally requires - do NOT limit yourself to 3-5 levels.
2. If a concept has sub-concepts, and those have their own details, keep nesting deeper (4, 5, 6, 7+ levels are encouraged for rich content).
3. Focus on capturing ALL important connections, relationships, and hierarchies.
4. Ensure the JSON is valid and complete.
5. Use numeric string IDs (e.g. "1", "2") for nodes to save space.

**Structure Guide:**
- Center → Major Topics → Subtopics → Concepts → Details → Sub-details → Finer points...
- Continue nesting as deep as the content allows - there is NO limit on depth.
- Keep descriptions concise (10-25 words) but be thorough with the hierarchy.

Output the complete JSON structure with all nodes and edges.
"""

    model_router = get_model_router()
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.DOUBT,  # Reuse DOUBT agent type for model routing
            prompt=user_prompt,
            system_prompt=MINDMAP_SYSTEM_PROMPT,
            temperature=0.3,  # Lower temp for more consistent JSON
            max_tokens=8000,
        )
    except Exception as e:
        logger.error("Model generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Mindmap generation failed: {str(e)}")
    
    # Parse the JSON response
    import json
    import re
    
    content = response.content.strip()
    
    # Try to extract JSON from the response
    parsed = None
    try:
        # First, try direct parse
        if content.startswith("{"):
            parsed = json.loads(content)
        else:
            # Try to find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
    except json.JSONDecodeError as e:
        logger.warning("JSON truncated, attempting recovery", error=str(e))
        # Try to recover truncated JSON by extracting valid nodes and edges
        try:
            # Extract centerTopic
            center_match = re.search(r'"centerTopic"\s*:\s*"([^"]+)"', content)
            center_topic = center_match.group(1) if center_match else (request.subject or "Content Map")
            
            # Extract all complete node objects
            node_pattern = r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"(center|branch|leaf)"\s*,\s*"data"\s*:\s*\{\s*"label"\s*:\s*"([^"]+)"(?:,\s*"description"\s*:\s*"([^"]+)")?\s*\}\s*\}'
            node_matches = re.findall(node_pattern, content)
            
            nodes = []
            for match in node_matches:
                data = {"label": match[2]}
                if match[3]:
                    data["description"] = match[3]
                nodes.append({
                    "id": match[0],
                    "type": match[1],
                    "data": data
                })
            
            # Extract all complete edge objects
            edge_pattern = r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"source"\s*:\s*"([^"]+)"\s*,\s*"target"\s*:\s*"([^"]+)"\s*\}'
            edge_matches = re.findall(edge_pattern, content)
            
            edges = []
            for match in edge_matches:
                edges.append({
                    "id": match[0],
                    "source": match[1],
                    "target": match[2]
                })
            
            if nodes:
                parsed = {
                    "centerTopic": center_topic,
                    "nodes": nodes,
                    "edges": edges
                }
                logger.info("Recovered truncated JSON", nodes=len(nodes), edges=len(edges))
            else:
                raise ValueError("Could not recover any nodes")
                
        except Exception as recovery_error:
            logger.error("JSON recovery failed", error=str(recovery_error), content=content[:500])
            # Return a fallback mindmap
            parsed = {
                "centerTopic": request.subject or "Content Overview",
                "nodes": [
                    {"id": "1", "type": "center", "data": {"label": request.subject or "Content Overview"}},
                    {"id": "2", "type": "branch", "data": {"label": "Content could not be parsed"}},
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"}
                ]
            }
    
    # Ensure all required fields exist
    result = {
        "centerTopic": parsed.get("centerTopic", request.subject or "Content"),
        "nodes": parsed.get("nodes", []),
        "edges": parsed.get("edges", []),
    }
    
    # Log activity in background
    background_tasks.add_task(
        log_activity,
        request.user_id,
        ActivityLogger.CHAT_MESSAGE,  # Reuse existing activity type
        {
            "action": "mindmap_generation",
            "subject": request.subject,
            "notes_length": len(request.notes),
            "nodes_generated": len(result["nodes"]),
            "edges_generated": len(result["edges"])
        }
    )
    
    return create_response(
        model="mindmap-generator-v1",
        payload=result,
        payload_type="mindmap",
        human_summary=f"Generated mindmap with {len(result['nodes'])} nodes and {len(result['edges'])} edges."
    )


# --- Saving & Retrieval Endpoints ---

@router.post("/notes-intelligence/save")
async def save_analysis(request: SaveNoteRequest):
    """Save analysis and mindmap to user's history."""
    try:
        logger.info("Saving analysis", user_id=request.user_id, subject=request.subject, goal=request.goal)
        client = get_firebase_client()
        
        # Create searchable/displayable summary
        preview = request.analysis_result.get("summary", "")[:200]
        
        note_data = {
            "user_id": request.user_id,
            "subject": request.subject or "Untitled Notes",
            "goal": request.goal,
            "notes_preview": request.notes[:500],
            # Store full content in a scalable way (Firestore doc size limit is 1MB, usually fine for text)
            "full_notes": request.notes,
            "analysis_result": request.analysis_result,
            "mindmap_result": request.mindmap_result,
            "podcast_audio_url": request.podcast_audio_url,
            "podcast_segments": request.podcast_segments,
            "created_at": datetime.utcnow().isoformat(),
            "summary_preview": preview
        }
        
        note_id = await client.save_note_analysis(note_data)
        
        return {"success": True, "id": note_id}
    except Exception as e:
        logger.error("Failed to save analysis", error=str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save analysis: {str(e)}")


@router.get("/notes-intelligence/list/{user_id}")
async def list_saved_notes(user_id: str, limit: int = 20):
    """Get list of saved analyses for dashboard."""
    client = get_firebase_client()
    notes = await client.get_user_notes(user_id, limit)
    
    # Return minimal data for list view
    return {
        "notes": [
            {
                "id": n.get("id"),
                "subject": n.get("subject"),
                "goal": n.get("goal"),
                "created_at": n.get("created_at"),
                "summary_preview": n.get("summary_preview")
            }
            for n in notes
        ]
    }


@router.get("/notes-intelligence/{note_id}")
async def get_note_details(note_id: str):
    """Get full details of a saved analysis."""
    client = get_firebase_client()
    note = await client.get_note(note_id)
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    return note


