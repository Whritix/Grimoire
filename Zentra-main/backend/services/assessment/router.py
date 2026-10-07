"""
Assessment Agent - Generates quizzes and grades responses.
"""

from pathlib import Path
from typing import Any, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser, default_limit
from shared.models import get_model_router, AgentType
from shared.utils import create_response, safe_validate, get_logger

logger = get_logger(__name__)

router = APIRouter()

# Initialize Firebase Client
from shared.storage.firebase_client import FirebaseClient
db = FirebaseClient()


# Load prompt template
PROMPT_PATH = Path(__file__).parent.parent.parent / "shared" / "prompts" / "assessment.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""


class GenerateRequest(BaseModel):
    """Quiz generation request."""
    mode: Literal["generate", "flashcards"] = "generate"
    model: str = "assessment-v1"
    lesson_id: str | None = None
    lesson_content: str
    question_count: int = 5
    is_assignment: bool = False
    mcq_only: bool = False
    difficulty_distribution: dict[str, int] | None = None
    difficulty_level: str = "Intermediate" # Beginner, Intermediate, Advanced
    temperature: float = 0.4
    schema_version: str = "1.0"


class GradeRequest(BaseModel):
    """Grading request."""
    mode: Literal["grade"] = "grade"
    model: str = "assessment-v1"
    question_id: str
    question_text: str
    correct_answer: str | None = None
    rubric: dict[str, Any] | None = None
    user_answer: str
    context: str | None = None
    temperature: float = 0.2
    schema_version: str = "1.0"


class QuestionResult(BaseModel):
    id: str
    text: str | None = None
    user_answer: str
    correct_answer: str | None = None
    is_correct: bool
    time_taken: int  # ms

class SubmitAssessmentRequest(BaseModel):
    """Request to submit assessment results."""
    mode: Literal["submit"] = "submit"
    user_id: str
    topic: str
    score: float
    total_questions: int
    correct_count: int
    results: list[QuestionResult]
    time_taken_total: int
    timestamp: int | None = None
    metadata: dict[str, Any] = {}


class AnalyzeAssessmentRequest(BaseModel):
    """Request to analyze assessment performance."""
    topic: str
    score: float
    # Support both camelCase (frontend) and snake_case
    totalQuestions: int | None = None
    total_questions: int | None = None
    correctCount: int | None = None
    correct_count: int | None = None
    wrongQuestions: list[dict[str, Any]] = []
    correctQuestions: list[str] = []
    # Support for the format expected by the frontend's /teaching call
    mode: str | None = None
    message: str | None = None


@router.post("/assessment")
async def assessment(
    request: GenerateRequest | GradeRequest,
    api_key: AuthenticatedUser,
):
    """
    Generate quiz items or grade responses.
    """
    logger.info("Assessment request", mode=request.mode)
    
    model_router = get_model_router()
    
    if request.mode == "generate":
        return await handle_generate(request, model_router)
    elif request.mode == "flashcards":
        return await handle_flashcards(request, model_router)
    else:
        return await handle_grade(request, model_router)


@router.post("/assessment/submit")
async def submit_assessment(request: SubmitAssessmentRequest, api_key: AuthenticatedUser):
    """Finalize and store assessment results with adaptive roadmap updates."""
    from services.progress.router import update_user_progress_internal
    from shared.activity import log_activity, ActivityLogger
    from services.roadmap.router import add_prerequisite_to_roadmap
    
    logger.info("Assessment submission", user_id=request.user_id, topic=request.topic, score=request.score)
    
    # 1. Update global progress
    await update_user_progress_internal(
        user_id=request.user_id,
        item_type="assessment",
        item_id=f"assessment_{int(__import__('time').time())}",
        title=request.topic,
        score=request.score
    )
    
    # 2. Save to Firebase 'assessments' collection
    data = request.dict()
    import time
    if not data.get("timestamp"):
        data["timestamp"] = int(time.time() * 1000)
    
    try:
        db.db.collection("assessments").add(data)
    except Exception as e:
        logger.error(f"Failed to save assessment history: {e}")

    # 3. Log Activity
    log_activity(request.user_id, ActivityLogger.ASSESSMENT_COMPLETED, {
        "topic": request.topic,
        "score": request.score,
        "correct_count": request.correct_count,
        "total_questions": request.total_questions,
        "time_ms": request.time_taken_total
    })
    
    # 4. Adaptive Roadmap Logic
    # Calculate percentage to be safe
    percentage = request.score
    if request.total_questions > 0:
        calculated_pct = (request.correct_count / request.total_questions) * 100
        # If score is vastly different (e.g. 0-1 vs 0-100), prefer calculated
        if request.score <= 1.0 and calculated_pct > 1.0:
            percentage = calculated_pct
        elif request.score > 1.0:
            percentage = request.score
            
    adaptive_message = None
    if percentage < 60:
        logger.info(f"Low score ({percentage:.1f}%) detected for '{request.topic}'. Triggering adaptive roadmap.")
        try:
            model_router = get_model_router()
            prompt = f"""
            The user failed an assessment on '{request.topic}' with a score of {percentage:.1f}%.
            Generate a single 'Prerequisite Module' content block that acts as a foundational reset/crash course for this topic.
            
            Return strictly valid JSON with this structure:
            {{
                "id": "remedial_{int(time.time())}",
                "title": "Prerequisite: Foundational {request.topic}",
                "description": "A customized prerequisite module to help you strengthen your understanding of {request.topic}.",
                "estimated_hours": 2,
                "difficulty": "beginner",
                "topics": ["Sub-topic 1", "Sub-topic 2", "Sub-topic 3"],
                "learning_outcomes": ["Outcome 1", "Outcome 2"],
                "content": "Markdown content explaining core concepts of {request.topic} simply...",
                "status": "pending"
            }}
            
            IMPORTANT: The 'topics' array MUST contain 3-5 actual sub-topics relevant to '{request.topic}' (e.g., if topic is 'Python Generators', topics could be ['Iterator Protocol', 'Yield Keyword', 'Generator Functions']).
            """
            
            response = await model_router.generate(
                agent_type=AgentType.ASSESSMENT,
                prompt=prompt,
                system_prompt="You are a helpful educational assistant. Generate valid JSON only.",
                temperature=0.3,
                max_tokens=2000
            )
            
            import json
            import re
            content = response.content.replace("```json", "").replace("```", "").strip()
            json_match = re.search(r"\{[\s\S]*\}", content)
            
            if json_match:
                module_data = json.loads(json_match.group())
                # Add to roadmap
                added = await add_prerequisite_to_roadmap(request.user_id, request.topic, module_data)
                if added:
                    adaptive_message = "We noticed you faced some challenges. A prerequisite module has been added to your roadmap to help you master this topic!"
                    
        except Exception as e:
            logger.error("Adaptive roadmap adjustment failed", error=str(e))
    
    return {
        "success": True, 
        "message": "Assessment recorded", 
        "adaptive_feedback": adaptive_message
    }


@router.post("/assessment/analyze")
@router.post("/teaching")
async def analyze_assessment(request: AnalyzeAssessmentRequest | dict, api_key: AuthenticatedUser):
    """Provide AI analysis of performance."""
    # Special handling for the generic /teaching chat format used as fallback
    if isinstance(request, dict) and request.get("message"):
        prompt = request["message"]
        topic = "General Assessment"
        score = 0
    else:
        # Standard format
        prompt = f"Analyze quiz: {request.topic}, Score: {request.score}%. Wrong: {len(request.wrongQuestions)}."
        topic = request.topic
        score = request.score

    model_router = get_model_router()
    
    # We use a very simple direct prompt here if it's the custom message, 
    # or a structured one if it's our standard request.
    # For compatibility with frontend/app/api/v1/agents/assessment/analyze/route.ts
    system_prompt = "You are a Teaching Assistant. Analyze the user's performance and provide strengths/weaknesses in JSON format."
    
    response = await model_router.generate(
        agent_type=AgentType.ASSESSMENT,
        prompt=str(request), # Use the whole request for context if it's rich
        system_prompt=system_prompt,
        temperature=0.3
    )
    
    return create_response(
        model="assessment-v1",
        payload={"message": response.content},
        payload_type="analysis",
        human_summary="Analysis provided by Teaching Assistant.",
        confidence=0.9
    )


async def handle_generate(request: GenerateRequest, model_router):
    """Handle quiz generation."""
    
    # Adjust distribution based on level if not provided
    dist_text = request.difficulty_distribution or 'balanced'
    if not request.difficulty_distribution:
        if request.difficulty_level.lower() == "beginner":
            dist_text = "mostly easy, some medium"
        elif request.difficulty_level.lower() == "advanced":
            dist_text = "mostly hard, some medium"
            
    user_prompt = f"""
Generate {request.question_count} quiz questions.

Target Audience Level: {request.difficulty_level}
Topic / Context:
{request.lesson_content[:4000]}

Difficulty Distribution: {dist_text}

Instructions:
Create high-quality questions based on the provided text.
Create high-quality questions based on the provided text.
IMPORTANT: If the 'Topic / Context' above is just a topic name (e.g., "Python", "Machine Learning") and not a full lesson, YOU MUST USE YOUR GENERAL KNOWLEDGE to generate relevant questions about that topic.
"""
    
    if request.is_assignment:
        user_prompt += "\nMODE: ASSIGNMENT. Generate formal, rigorous questions suitable for grading. Avoid trivial questions.\n"

    if request.mcq_only:
        user_prompt += """
CONSTRAINT: STRICTLY MCQ ONLY. 
1. Generate EXACTLY 4 options for every question.
2. Provide ONE correct_answer that EXACTLY matches one of the options.
3. DO NOT output code snippets question types.
4. DO NOT output open-ended questions.
"""


    
    try:
        response = await model_router.generate(
            agent_type=AgentType.ASSESSMENT,
            prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=request.temperature,
            max_tokens=8000,
        )
    except Exception as e:
        logger.error("Generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
    validation = safe_validate(response.content, "quiz")
    
    if not validation.success:
        return create_response(
            model=request.model,
            payload={"raw_response": response.content},
            payload_type="quiz",
            human_summary="Quiz generated but validation failed.",
            confidence=0.5,
            caveat=True,
            caveat_reason="; ".join(validation.errors),
        )
    
    questions = validation.data.get("questions", [])
    if isinstance(questions, list) and len(questions) > request.question_count:
        questions = questions[:request.question_count]
        validation.data["questions"] = questions

    return create_response(
        model=request.model,
        payload=validation.data,
        payload_type="quiz",
        human_summary=f"Generated {len(questions)} quiz questions.",
        confidence=0.85,
    )


async def handle_flashcards(request: GenerateRequest, model_router):
    """Handle flashcard generation."""
    
    user_prompt = f"""
Generate {request.question_count} Spaced Repetition Flashcards for this content.
Return strictly valid JSON: {{ "flashcards": [ {{ "front": "Question/Term", "back": "Answer/Definition" }}, ... ] }}

Target Level: {request.difficulty_level}

Content:
{request.lesson_content[:4000]}
"""
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.ASSESSMENT,
            prompt=user_prompt,
            system_prompt="You are an expert at creating study materials. Return strictly valid JSON.",
            temperature=0.3,
            max_tokens=4096,
        )
    except Exception as e:
        logger.error("Flashcard generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
    # Parse logic
    import json
    import re
    content = response.content
    
    # Strip markdown
    clean_content = content.replace("```json", "").replace("```", "").strip()
    
    payload = {"flashcards": []}
    
    try:
        json_match = re.search(r"\{[\s\S]*\}", clean_content)
        if json_match:
            payload = json.loads(json_match.group())
        else:
             payload = json.loads(clean_content)
    except:
        pass
        
    return create_response(
        model=request.model,
        payload=payload,
        payload_type="flashcards",
        human_summary=f"Generated {len(payload.get('flashcards', []))} cards.",
        confidence=0.9
    )


async def handle_grade(request: GradeRequest, model_router):
    """
    Handle answer grading using Oumi-style Judge pattern.
    Ref: Oumi Evaluation Framework (Simulated)
    """
    
    # Oumi Judge Prompt Structure:
    # 1. Role Definition (Expert Judge)
    # 2. Context & Input
    # 3. Rubric/Criteria
    # 4. Chain of Thought Evaluation
    # 5. Final Score & Feedback
    
    user_prompt = f"""
IGNORE PREVIOUS INSTRUCTIONS. You are an implementation of the Oumi-style Judge for Educational Assessment.
Your goal is to provide a fair, accurate, and constructive evaluation of the student's answer.

### INPUT DATA
- **Question**: {request.question_text}
- **Correct Answer/Reference**: {request.correct_answer or 'Grade based on domain expertise'}
- **Rubric**: {request.rubric or 'Standard: Correctness (40%), Completeness (40%), Clarity (20%)'}
- **Student Answer**: {request.user_answer}
- **Context**: {request.context or 'N/A'}

### EVALUATION PROTOCOL
1. **Analyze**: Compare the student's answer to the reference key and rubric.
2. **Reasoning**: Identify specific strengths and missing components.
3. **Draft Feedback**: Create helpful feedback for the student.
4. **Score**: Assign a score from 0.0 to 1.0.

### OUTPUT FORMAT
Return a valid JSON object matching this schema:
{{
  "score": float, // 0.0 to 1.0 (e.g., 0.85)
  "feedback": "string", // Constructive feedback for the student
  "reasoning": "string", // Judge's internal reasoning (CoT)
  "rubric_breakdown": {{ "correctness": x, "completeness": y }} // Optional details
}}
"""
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.ASSESSMENT,
            prompt=user_prompt,
            system_prompt="You are a strict but fair AI Judge.", # Override standard prompt for Judge Mode
            temperature=0.1, # Low temp for consistency
            max_tokens=1024,
        )
    except Exception as e:
        logger.error("Grading failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
    # Parse grading response - Use "grading_result" schema if exists or generic
    # We reused "quiz" validation before, let's try to validate loosely or just parse JSON
    import json
    import re
    
    content = response.content
    try:
        # Extract JSON if wrapped in markdown
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(content)
            
        result = data
        score = result.get("score", 0.0)
        
        return create_response(
            model=request.model,
            payload=result,
            payload_type="grading_result",
            human_summary=f"Oumi Judge Score: {score:.0%}. {result.get('feedback', '')}",
            confidence=0.9,
        )
        
    except Exception as e:
         # Fallback
        logger.error("Judge parsing failed", error=str(e))
        return create_response(
            model=request.model,
            payload={"raw_response": content},
            payload_type="grading_result",
            human_summary="Grading completed (Parsing issue).",
            confidence=0.5,
            caveat=True
        )


@router.get("/assessment/history/{user_id}")
async def get_assessment_history(
    user_id: str,
    user: AuthenticatedUser, 
    limit: int = 10
):
    """Get past assessments for user from Firebase."""
    try:
        # Query assessments for this user, sorted by timestamp
        docs = (
            db.db.collection("assessments")
            .where("user_id", "==", user_id)
            .order_by("timestamp", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        history = [doc.to_dict() for doc in docs]
        return {"history": history}
    except Exception as e:
        logger.error("Failed to fetch history", error=str(e))
        return {"history": []}



