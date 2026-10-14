"""
Quiz Generator - Creates quizzes from lesson content using AI.
Implements MCQ generation and spaced repetition logic.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser
from shared.models import get_model_router, AgentType
from shared.storage.firebase_client import get_firebase_client
from shared.utils import create_response, get_logger
from shared.utils.audit_logger import audit_quiz_submit

logger = get_logger(__name__)

router = APIRouter()

db = get_firebase_client()

QUIZZES_COLLECTION = "quizzes"
QUIZ_RESULTS_COLLECTION = "quiz_results"


class QuizQuestion(BaseModel):
    """A single quiz question."""
    question: str
    options: List[str]
    correct_answer: int  # Index of correct option (0-3)
    explanation: str


class GenerateQuizRequest(BaseModel):
    """Request to generate a quiz."""
    user_id: str
    topic: str
    lesson_content: Optional[str] = None
    difficulty: str = "intermediate"  # beginner, intermediate, advanced
    num_questions: int = 5


class SubmitQuizRequest(BaseModel):
    """Request to submit quiz answers."""
    user_id: str
    quiz_id: str
    answers: List[int]  # User's selected answer indices
    time_taken_seconds: int


QUIZ_GENERATION_PROMPT = """
You are an educational quiz generator. Create a multiple-choice quiz based on the provided topic and content.

## Requirements:
1. Generate exactly {num_questions} questions
2. Each question must have exactly 4 options (A, B, C, D)
3. Only ONE option should be correct
4. Difficulty level: {difficulty}
5. Include a brief explanation for the correct answer

## Topic: {topic}

## Content (if provided):
{content}

## Output Format:
Return a valid JSON array of questions. Each question object must have:
- "question": The question text
- "options": Array of 4 answer options
- "correct_answer": Index of correct option (0-3)
- "explanation": Brief explanation of why the answer is correct

Example:
[
  {{
    "question": "What is the primary purpose of a variable in programming?",
    "options": ["To store data", "To delete files", "To connect to internet", "To print text"],
    "correct_answer": 0,
    "explanation": "Variables are used to store data values that can be referenced and manipulated throughout a program."
  }}
]

Generate the quiz now. Return ONLY the JSON array, no other text.
"""


@router.post("/quiz/generate")
async def generate_quiz(
    request: GenerateQuizRequest,
    api_key: AuthenticatedUser,
):
    """Generate a quiz from topic and optional lesson content."""
    try:
        model_router = get_model_router()
        
        # Build prompt
        content = request.lesson_content or "No specific content provided. Generate questions based on general knowledge of the topic."
        prompt = QUIZ_GENERATION_PROMPT.format(
            num_questions=request.num_questions,
            difficulty=request.difficulty,
            topic=request.topic,
            content=content[:2000]  # Limit content length
        )
        
        # Generate quiz questions
        response = await model_router.generate(
            agent_type=AgentType.ASSESSMENT,
            prompt=prompt,
            system_prompt="You are a quiz generator. Always return valid JSON arrays.",
            temperature=0.7,
            max_tokens=2000,
        )
        
        # Parse response
        try:
            # Clean up response - extract JSON if wrapped in markdown
            content = response.content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()
            
            questions = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse quiz response", error=str(e), response=response.content[:200])
            raise HTTPException(status_code=500, detail="Failed to generate quiz - invalid response format")
        
        # Create quiz document
        quiz_id = f"quiz_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        
        quiz = {
            "id": quiz_id,
            "user_id": request.user_id,
            "topic": request.topic,
            "difficulty": request.difficulty,
            "questions": questions,
            "num_questions": len(questions),
            "created_at": now,
        }
        
        # Store in Firestore
        db.db.collection(QUIZZES_COLLECTION).document(quiz_id).set(quiz)
        
        # Return quiz without correct answers for client
        client_questions = [
            {
                "question": q["question"],
                "options": q["options"],
            }
            for q in questions
        ]
        
        logger.info("Quiz generated", quiz_id=quiz_id, topic=request.topic, num_questions=len(questions))
        
        return create_response(
            model="quiz-generator-v1",
            payload={
                "quiz_id": quiz_id,
                "topic": request.topic,
                "difficulty": request.difficulty,
                "questions": client_questions,
                "time_limit_seconds": len(questions) * 60,  # 1 minute per question
            },
            payload_type="quiz",
            human_summary=f"Generated {len(questions)} questions on {request.topic}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate quiz", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/submit")
async def submit_quiz(
    request: SubmitQuizRequest,
    api_key: AuthenticatedUser,
):
    """Submit quiz answers and get results."""
    try:
        # Fetch the quiz
        quiz_doc = db.db.collection(QUIZZES_COLLECTION).document(request.quiz_id).get()
        
        if not quiz_doc.exists:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        quiz = quiz_doc.to_dict()
        
        # Verify ownership
        if quiz.get("user_id") != request.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        questions = quiz.get("questions", [])
        
        # Score the quiz
        correct_count = 0
        results = []
        
        for i, question in enumerate(questions):
            user_answer = request.answers[i] if i < len(request.answers) else -1
            correct_answer = question.get("correct_answer", 0)
            is_correct = user_answer == correct_answer
            
            if is_correct:
                correct_count += 1
            
            results.append({
                "question": question["question"],
                "options": question["options"],
                "user_answer": user_answer,
                "correct_answer": correct_answer,
                "is_correct": is_correct,
                "explanation": question.get("explanation", ""),
            })
        
        score = round((correct_count / len(questions)) * 100) if questions else 0
        
        # Store result
        result_id = f"result_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        
        quiz_result = {
            "id": result_id,
            "quiz_id": request.quiz_id,
            "user_id": request.user_id,
            "topic": quiz.get("topic"),
            "score": score,
            "correct_count": correct_count,
            "total_questions": len(questions),
            "time_taken_seconds": request.time_taken_seconds,
            "completed_at": now,
        }
        
        db.db.collection(QUIZ_RESULTS_COLLECTION).document(result_id).set(quiz_result)
        
        # Log audit event
        audit_quiz_submit(
            user_id=request.user_id,
            quiz_id=request.quiz_id,
            topic=quiz.get("topic", "Unknown"),
            score=score,
            total_questions=len(questions)
        )
        
        # Update user progress
        try:
            from services.progress.router import update_user_progress_internal
            await update_user_progress_internal(
                user_id=request.user_id,
                item_type="quiz",
                item_id=request.quiz_id,
                title=quiz.get("topic", "Quiz"),
                score=score
            )
        except Exception as e:
            logger.warning("Failed to update progress", error=str(e))
        
        logger.info("Quiz submitted", quiz_id=request.quiz_id, score=score)
        
        return create_response(
            model="quiz-grader-v1",
            payload={
                "quiz_id": request.quiz_id,
                "score": score,
                "correct_count": correct_count,
                "total_questions": len(questions),
                "time_taken_seconds": request.time_taken_seconds,
                "results": results,
                "passed": score >= 70,
            },
            payload_type="quiz_result",
            human_summary=f"Score: {score}% ({correct_count}/{len(questions)} correct)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to submit quiz", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quiz/history/{user_id}")
async def get_quiz_history(
    user_id: str,
    api_key: AuthenticatedUser,
    limit: int = 20,
):
    """Get quiz history for a user."""
    try:
        docs = (
            db.db.collection(QUIZ_RESULTS_COLLECTION)
            .where("user_id", "==", user_id)
            .order_by("completed_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        
        results = [doc.to_dict() for doc in docs]
        
        # Calculate stats
        if results:
            avg_score = sum(r.get("score", 0) for r in results) / len(results)
            total_quizzes = len(results)
        else:
            avg_score = 0
            total_quizzes = 0
        
        return create_response(
            model="quiz-history-v1",
            payload={
                "results": results,
                "total_quizzes": total_quizzes,
                "average_score": round(avg_score, 1),
            },
            payload_type="quiz_history",
            human_summary=f"{total_quizzes} quizzes taken, avg score: {avg_score:.1f}%"
        )
        
    except Exception as e:
        logger.error("Failed to get quiz history", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
