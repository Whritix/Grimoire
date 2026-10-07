from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional


from shared.models import get_model_router, AgentType
from shared.utils import get_logger
from shared.middleware import AuthenticatedUser
from fastapi import UploadFile, File
from .analysis import VideoAnalyzer
from google.cloud import firestore
import time
from .companies import get_all_companies, get_company_config, validate_company_role
import chromadb
from chromadb.config import Settings

logger = get_logger(__name__)


router = APIRouter()

# ============ Models ============

class ChatMessage(BaseModel):
    role: str
    content: str

class GenerateQuestionRequest(BaseModel):
    job_role: str
    skills: List[str]
    level: str = "mid"  # junior, mid, senior
    candidate_language: str = "en"
    candidate_language: str = "en"
    messages: List[ChatMessage]
    resume_text: Optional[str] = None
    company_id: Optional[str] = None
    company_role_id: Optional[str] = None

class ScoreInterviewRequest(BaseModel):
    transcript: str
    job_role: Optional[str] = "Software Engineer"
    skills: Optional[List[str]] = []
    level: Optional[str] = "mid"

class ScoreResponse(BaseModel):
    scores: Dict[str, int]
    overall: float
    confidence: float
    rationale: str
    strengths: List[str]
    weaknesses: List[str]
    recommendations: Dict[str, str]

class AnalysisResponse(BaseModel):
    face_detected: bool
    eye_contact: bool
    smile_detected: bool
    posture_score: float
    sentiment: str

# ============ Global Services ============
from collections import defaultdict
session_video_analysis: Dict[str, List[dict]] = defaultdict(list)
video_analyzer = VideoAnalyzer()
_db = None
_chroma_client = None
_chroma_collection = None

from google.oauth2 import service_account
import os

from shared.config import get_settings

def get_db():
    global _db
    if _db is None:
        try:
            settings = get_settings()
            # Check for explicitly provided credentials in env via Settings
            if settings.firebase_private_key and settings.firebase_client_email:
                cred_dict = {
                    "type": "service_account",
                    "project_id": settings.firebase_project_id or "Zentra-app",
                    "private_key_id": "", # Optional
                    "private_key": settings.firebase_private_key.replace("\\n", "\n"),
                    "client_email": settings.firebase_client_email,
                    "client_id": "",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{settings.firebase_client_email}"
                }
                creds = service_account.Credentials.from_service_account_info(cred_dict)
                _db = firestore.Client(credentials=creds, project=cred_dict["project_id"])
            else:
                # Fallback to default credentials (ADC)
                _db = firestore.Client()
        except Exception as e:
            logger.error(f"Failed to initialize Firestore: {e}")
            # Do not raise immediately to allow app startup, but subsequent calls will fail if DB needed
            # raise e 
            pass
    return _db

def get_chroma_collection():
    global _chroma_client, _chroma_collection
    if _chroma_collection is None:
        try:
            # Initialize ChromaDB (persistent)
            # We'll store it in a local directory for now, or use the settings
            _chroma_client = chromadb.PersistentClient(path="./chroma_db")
            
            _chroma_collection = _chroma_client.get_or_create_collection(
                name="interview_questions",
                metadata={"description": "Generated interview questions for various roles and companies"}
            )
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            pass
    return _chroma_collection

# ============ Prompts ============

def get_interviewer_prompt(job_role: str, skills: List[str], level: str, candidate_language: str, resume_text: Optional[str] = None, company_id: Optional[str] = None) -> str:
    skills_list = ", ".join(skills)
    
    difficulty_note = "Balance depth with accessibility."
    if level == "senior":
        difficulty_note = "Ask deeper, more challenging questions that test their expertise."
    elif level == "junior":
        difficulty_note = "Keep questions accessible and encouraging, focusing on fundamentals."

    resume_context = ""
    if resume_text:
        resume_context = f"\n## CANDIDATE RESUME\nThe candidate has provided the following resume content. Use this to ask specific questions about their experience, projects, or background.\n{resume_text[:2000]}... [truncated]\n"
    elif "resume_text" in locals() and resume_text: # Fallback if passed as kwarg but not in sig (unlikely here but safe)
        pass 

    company_context = ""
    # We will handle company context injection in the router before calling this, or pass it in as a param. 
    # But since we change the signature in the router, let's update this function signature too.
    # Actually, let's keep this function signature simple and just append to the prompt if needed inside the function 
    # by adding **kwargs or updating signature.
    # Let's update the signature in the ReplacementChunk properly.
    
    return f"""You are a **friendly, encouraging, and highly interactive human-like interviewer**. Your goal is to make the candidate feel comfortable and valued throughout the process.

## ROLE & PURPOSE
You are conducting a supportive voice interview for: {job_role}
Skills to evaluate: {skills_list}
Experience level: {level}
Language: {candidate_language}
{difficulty_note}
{resume_context}

## INTERVIEW PHASES
1. **Phase 1: Rapport Building & Intro (First 1-2 turns)**: Introduce yourself, explain the process briefly, and ask a lighthearted, non-technical opening question (e.g., "How is your day going?", "Are you excited for our chat today?"). Build a connection.
2. **Phase 2: Professional Evaluation**: Transition smoothly into the candidate's background and then into the specific skills ({skills_list}).

## INTERACTION RULES (STRICT)
1. Ask **ONLY ONE question at a time**.
2. Be **warm and conversational**. Use phrases like "That's wonderful to hear!", "I totally understand," or "It sounds like you've been busy!" to acknowledge their answers.
3. **Bridge your questions**: Connect your next question to what they just said. Avoid abrupt jumps.
4. Speak clearly and at a natural, friendly pace.
5. If the user's answer is brief, gently encourage them: "That sounds neat, can you tell me a bit more about that part?"
6. Do NOT mention being an AI.
7. Keep transitions smooth: "Speaking of React, I'm curious..." or "That leads me to my next question about..."

## OUTPUT FORMAT (VERY IMPORTANT)
- Your output must be **spoken language only**.
- Do NOT output JSON, markdown, or labels.
- Keep total response length under 60 words for natural speech.

---

**Current State**: Starting the interview.
**Action**: Begin Phase 1 now. Introduce yourself warmly as the GRIMOIRE AI Interviewer {f'(representing {company_id.title()})' if company_id else ''}, mention the {job_role} role, and ask a friendly, lighthearted opening question to break the ice before we get into the technicals later."""

SCORING_PROMPT = """Evaluate the interview transcript thoroughly and empathetically.

Score each category from 1-5:
- **Technical Knowledge**: Mastery of concepts, domain expertise, and practical application.
- **Communication Clarity**: Ability to articulate complex ideas simply and effectively.
- **Problem Solving**: Logic, structure, and creativity in approaching challenges.
- **Soft Skills**: Interpersonal effectiveness, empathy, and collaboration potential.
- **Tone & Sentiment**: Enthusiasm, professional maturity, and positive engagement.
- **Structure & Coherence**: How well-organized and logical their responses were.

Consider:
- Did they answer questions directly with relevant examples?
- Did they demonstrate growth mindset and self-awareness?
- How did they handle pressure or difficult follow-up questions?
- Was their tone appropriate for the role?

Return STRICT JSON only, no other text:
{
  "scores": {
    "technicalKnowledge": <number 1-5>,
    "communicationClarity": <number 1-5>,
    "problemSolving": <number 1-5>,
    "softSkills": <number 1-5>,
    "toneAndSentiment": <number 1-5>,
    "structureAndCoherence": <number 1-5>
  },
  "overall": <number 1-5, weighted average>,
  "confidence": <number 0-1, your confidence in this assessment>,
  "rationale": "<Comprehensive 3-4 sentence explanation of the performance>",
  "strengths": ["<strength1 - specific>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1 - constructive>", "<weakness2>", "<weakness3>"],
  "recommendations": {
    "technicalSkills": "<Specific technical advice>",
    "softSkills": "<Advice on communication or interpersonal style>",
    "problemSolving": "<Feedback on their reasoning or approach>",
    "growthAreas": "<Concrete next steps for career growth>"
  }
  }
}"""

SCORING_WITH_VIDEO_PROMPT = """You are an expert, calibrated senior technical hiring evaluator.
Your role is to produce a TRUE, FAIR, and OBJECTIVE performance evaluation based on the actual interview transcript.

Context of Interview:
- Target Role: {job_role}
- Experience Level: {level}
- Target Skills: {skills}

Non-Verbal & Presence Overview:
{non_verbal_summary}

CALIBRATED EVALUATION PRINCIPLES:
1. TRUTHFUL & EVIDENCE-BASED:
   - Base all scores strictly on what the candidate demonstrated in their answers.
   - If the candidate answers questions with relevant concepts, correct principles, domain familiarity, or clear thinking, reward them with fair proficient scores (3 to 5 on a 1-5 scale).
   - Only assign 1 or 2 if the candidate's answers were completely evasive, incorrect, or absent.
   - Do NOT assume the candidate refused or gave up unless they literally said they refuse to continue.
   - If code was submitted in the session, consider their code quality, clean syntax, and problem decomposition.

2. CLEAR 1-5 SCORING RUBRIC (Each category maps to a 10-point scale where 5=10/10, 4=8/10, 3=6/10, 2=4/10, 1=2/10):
   - 5 (Exceptional / 10): Deep technical mastery, comprehensive explanation, anticipates edge cases and trade-offs.
   - 4 (Strong / 8): Confident, accurate responses, solid grasp of core technologies and concepts, clear communication.
   - 3 (Competent / 6): Good foundational understanding, answers the question reasonably well, minor gaps or brief points.
   - 2 (Developing / 4): Incomplete answers, noticeable technical gaps, or struggles to elaborate.
   - 1 (Inadequate / 2): Completely off-topic, evasive, or no answer provided.

3. BALANCED SCORING:
   - Ensure the overall score and executive summary genuinely reflect their performance.
   - Provide concrete, specific strengths and realistic, constructive recommendations tailored to {job_role}.

Return STRICT JSON only, matching this exact schema:
{{
  "scores": {{
    "technicalKnowledge": <integer 1-5>,
    "communicationClarity": <integer 1-5>,
    "problemSolving": <integer 1-5>,
    "softSkills": <integer 1-5>,
    "toneAndSentiment": <integer 1-5>,
    "structureAndCoherence": <integer 1-5>,
    "nonVerbalCommunication": <integer 1-5>
  }},
  "overall": <float 1.0-5.0, accurate weighted average>,
  "confidence": <float 0.8-1.0>,
  "rationale": "<Comprehensive 3-4 sentence summary objectively detailing the candidate's demonstrated knowledge and key growth opportunities>",
  "strengths": [
    "<Specific strength grounded in their actual answers>",
    "<Second specific strength>",
    "<Third specific strength>"
  ],
  "weaknesses": [
    "<Constructive growth area>",
    "<Second constructive growth area>"
  ],
  "recommendations": {{
    "technicalSkills": "<Specific technical advice tailored to {job_role}>",
    "softSkills": "<Communication or behavioral advice>",
    "problemSolving": "<Feedback on reasoning or architecture approach>",
    "growthAreas": "<Concrete next step to reach higher seniority>"
  }}
}}"""

# ============ Endpoints ============

@router.get("/interview/companies")
async def list_companies():
    """List supported companies for interview mode."""
    return {"companies": get_all_companies()}

@router.post("/interview/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """Parse resume PDF/Text and extract text content."""
    try:
        import pypdf
        import io
        
        contents = await file.read()
        text = ""

        if file.filename.lower().endswith('.pdf'):
            try:
                # Use pypdf to read PDF
                pdf_file = io.BytesIO(contents)
                reader = pypdf.PdfReader(pdf_file)
                for page in reader.pages:
                    text += page.extract_text() + "\\n"
            except Exception as pdf_err:
                logger.error(f"Error parsing PDF with pypdf: {pdf_err}")
                # Fallback: try raw decode if it's text renamed as PDF (unlikely but possible)
                text = contents.decode('utf-8', errors='ignore')

        elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            # Image Resume Parsing via Vision Model
            try:
                import base64
                base64_image = base64.b64encode(contents).decode("utf-8")
                
                model_router = get_model_router()
                # We ask the model to transcribe the resume
                response = await model_router.generate(
                    agent_type=AgentType.INTERVIEW, # Use INTERVIEW agent config (Groq)
                    prompt="Please transcribe the full text content of this resume image. Output ONLY the text content, preserving the structure as much as possible.",
                    images=[base64_image],
                    temperature=0.1,
                    max_tokens=2048
                )
                text = response.content
            except Exception as img_err:
                logger.error(f"Error parsing image resume: {img_err}")
                raise HTTPException(status_code=500, detail=f"Failed to parse image resume: {img_err}")

        else:
            # Assume text/markdown
            text = contents.decode('utf-8', errors='ignore')

        return {"text": text.strip()}
    except Exception as e:
        logger.error(f"Error parsing resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interview/generate-question")
async def generate_question(request: GenerateQuestionRequest):
    """Generate the next interview question."""
    
    system_prompt = get_interviewer_prompt(
        request.job_role, 
        request.skills, 
        request.level, 
        request.candidate_language,
        request.resume_text,
        request.company_id
    )
    
    # If company_id is provided, look up special culture context/instructions
    if request.company_id:
         company_config = get_company_config(request.company_id)
         if company_config and company_config.get("culture_context"):
             system_prompt += f"\n\n## COMPANY CULTURE ({company_config['name']})\n{company_config['culture_context']}\nIntegrate these principles into your evaluation and questioning style."

    
    # Prepend system prompt to messages if not present (or as separate argument if router supports it)
    # The router.generate supports system_prompt separately
    
    prompt = ""
    # We construct the conversation history for the model
    # Usually the modal router takes a 'prompt' string for the user input
    # But here we have a chat history. 
    # For Groq/Llama, we usually send the whole list.
    # The ModelRouter.generate method takes `prompt` (User input) and `system_prompt`.
    # It constructs: System + User content. 
    # But we have a history.
    # We need to serialize the history into the prompt if the router doesn't support list[dict].
    # Looking at model_router.py: _call_groq takes 'prompt' and 'system_prompt'. 
    # It does: messages.append({"role": "user", "content": prompt})
    # It does NOT verify if 'prompt' is actually a full conversation history format.
    
    # Hack for now: We will format the history into a single text block for the 'prompt' 
    # OR we need to update ModelRouter to support chat history properly.
    # Given _call_groq implementation:
    # messages = []
    # if system_prompt: messages.append(...)
    # messages.append({"role": "user", "content": prompt})
    
    # If we pass a serialized conversation as 'prompt', it gets wrapped in a user message, which is weird for Llama but might work if formatted like:
    # "User: ... \n Assistant: ..."
    
    # Better approach: stringify the history in a way the model understands.
    conversation_text = ""
    for msg in request.messages:
        conversation_text += f"[{msg.role.upper()}]: {msg.content}\n\n"
        
    # The prompt sent to router will be the conversation history + instructions to reply
    user_prompt = f"""Below is the conversation history so far. 
{conversation_text}

Respond with the next spoken question or statement as the Interviewer.
"""
    
    try:
        model_router = get_model_router()
        response = await model_router.generate(
            agent_type=AgentType.INTERVIEW,
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=1024
        )
        
        return {"question": response.content}
    except Exception as e:
        logger.error(f"Error generating question: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Save to ChromaDB asynchronously (fire and forget basically, or strictly)
        try:
            if 'response' in locals() and response and response.content:
                collection = get_chroma_collection()
                if collection:
                    import uuid
                    # Metadata for retrieval
                    metadata = {
                        "job_role": request.job_role,
                        "level": request.level,
                        "company_id": request.company_id or "generic",
                        "timestamp": str(time.time()),
                        "type": "generated_question"
                    }
                    if request.skills:
                        metadata["skills"] = ",".join(request.skills)
                    
                    collection.add(
                        documents=[response.content],
                        metadatas=[metadata],
                        ids=[str(uuid.uuid4())]
                    )
        except Exception as chroma_err:
            logger.error(f"Error saving to ChromaDB: {chroma_err}")


@router.post("/interview/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
):
    """Transcribe audio recorded from client microphone using Groq Whisper."""
    try:
        settings = get_settings()
        if not settings.groq_api_key:
            raise HTTPException(status_code=500, detail="Groq API key not configured")

        content = await file.read()
        filename = file.filename or "audio.webm"

        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )

        transcription = await client.audio.transcriptions.create(
            file=(filename, content, file.content_type or "audio/webm"),
            model="whisper-large-v3",
            response_format="json",
        )

        text = transcription.text.strip() if hasattr(transcription, "text") else str(transcription).strip()
        logger.info(f"Audio transcription result: '{text[:80]}...'")
        return {"text": text}
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interview/{session_id}/analysis")
async def analyze_video_frame(
    session_id: str,
    file: UploadFile = File(...),
):
    """Analyze a single video frame and buffer metrics in-memory."""
    try:
        contents = await file.read()
        results = video_analyzer.process_frame(contents)
        
        # Always store in memory for reliable scoring even if Firestore is not configured
        session_video_analysis[session_id].append(results)
        
        # Also store to Firestore if available
        try:
            db = get_db()
            if db:
                doc_ref = db.collection("conversations").document(session_id).collection("video_analysis").document()
                doc_ref.set({
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    **results
                })
        except Exception as fe:
            logger.debug(f"Firestore video log skipped: {fe}")
        
        return results
    except Exception as e:
        logger.error(f"Error analyzing frame: {e}")
        return {"error": str(e)}

@router.post("/interview/{session_id}/score")
async def score_interview(
    session_id: str,
    request: ScoreInterviewRequest,
    api_key: AuthenticatedUser,
):
    """Score the interview transcript with truthful, calibrated metrics."""
    from shared.activity import log_activity, ActivityLogger
    
    try:
        total_frames = 0
        eye_contact_count = 0
        smile_count = 0
        posture_scores = []

        # 1. Retrieve frames from in-memory session buffer first
        frames = list(session_video_analysis.get(session_id, []))
        
        # 2. Fallback to Firestore if memory is empty
        if not frames:
            try:
                db = get_db()
                if db:
                    analysis_ref = db.collection("conversations").document(session_id).collection("video_analysis")
                    for doc in analysis_ref.stream():
                        frames.append(doc.to_dict())
            except Exception as e:
                logger.warning(f"Could not load video analysis from db: {e}")
                
        # Aggregate non-verbal metrics
        total_frames = len(frames)
        if total_frames > 0:
            for data in frames:
                if data.get("eye_contact"):
                    eye_contact_count += 1
                if data.get("smile_detected"):
                    smile_count += 1
                if "posture_score" in data:
                    posture_scores.append(data["posture_score"])

            eye_contact_rate = (eye_contact_count / total_frames) * 100
            smile_rate = (smile_count / total_frames) * 100
            avg_posture = sum(posture_scores) / len(posture_scores) if posture_scores else 0.85
            
            non_verbal_summary = (
                f"Video Analysis across {total_frames} camera frames:\n"
                f"- Eye Contact maintained: {eye_contact_rate:.1f}%\n"
                f"- Positive Expression (Smile): {smile_rate:.1f}%\n"
                f"- Posture Score: {avg_posture:.2f}/1.0\n"
                f"- Candidate had camera active and maintained good visual engagement."
            )
        else:
            non_verbal_summary = (
                "Note: Candidate completed this interview via Voice/Audio mode (camera feed was not active).\n"
                "CRITICAL: Do NOT penalize the candidate for missing video feed. Rate nonVerbalCommunication "
                "neutrally at 4 out of 5 based on their vocal delivery, poise, and professional engagement."
            )
        
        if not request.transcript or len(request.transcript.strip()) < 15:
             logger.warning(f"Transcript is too short to score: '{request.transcript}'")
             return {
                "scores": {
                    "technicalKnowledge": 3,
                    "communicationClarity": 3,
                    "problemSolving": 3,
                    "softSkills": 3,
                    "toneAndSentiment": 3,
                    "structureAndCoherence": 3,
                    "nonVerbalCommunication": 4
                },
                "overall": 3.0,
                "confidence": 0.5,
                "rationale": "Short interview session. The candidate participated briefly, but more depth is recommended for full assessment.",
                "strengths": ["Polite engagement and willingness to interview"],
                "weaknesses": ["Session concluded early with limited question depth"],
                "recommendations": {
                    "technicalSkills": "Complete a full 4-5 question interview to receive in-depth technical analysis.",
                    "softSkills": "Practice elaborating on technical experiences using the STAR framework.",
                    "problemSolving": "Work through technical scenarios step-by-step.",
                    "growthAreas": "Complete a full session to unlock comprehensive performance metrics."
                }
             }

        model_router = get_model_router()
        skills_str = ", ".join(request.skills) if request.skills else "General Software Engineering"
        formatted_system_prompt = SCORING_WITH_VIDEO_PROMPT.format(
            job_role=request.job_role or "Software Engineer",
            level=request.level or "mid",
            skills=skills_str,
            non_verbal_summary=non_verbal_summary
        )

        response = await model_router.generate(
            agent_type=AgentType.INTERVIEW,
            prompt=f"Here is the interview transcript to evaluate:\n\n{request.transcript}",
            system_prompt=formatted_system_prompt,
            temperature=0.2, 
            max_tokens=4096
        )
        
        content = response.content
        logger.info(f"Scoring response content: {content}")
        
        # Parse JSON
        import json
        import re
        
        result = {}
        
        # 1. Try to strip markdown code blocks first
        clean_content = content
        if "```" in content:
            matches = re.findall(r"```(?:json)?([\s\S]*?)```", content)
            if matches:
                clean_content = max(matches, key=len).strip()
        
        # 2. Try to find JSON block in the cleaned content
        json_match = re.search(r"\{[\s\S]*\}", clean_content)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except Exception:
                pass
        
        if not result:
             json_match_orig = re.search(r"\{[\s\S]*\}", content)
             if json_match_orig:
                 try:
                     result = json.loads(json_match_orig.group())
                 except Exception: 
                     pass

        if not result:
             try:
                 result = json.loads(content.replace("```json", "").replace("```", "").strip())
             except Exception:
                 pass

        if not result:
            logger.error(f"Failed to parse scoring JSON. Raw content: {content}")
            raise ValueError("No valid JSON found in response")

        # Normalize and calibrate scores to 1-5 integers
        scores = result.get("scores", {})
        category_weights = {
            "technicalKnowledge": 0.30,
            "problemSolving": 0.25,
            "communicationClarity": 0.20,
            "structureAndCoherence": 0.10,
            "softSkills": 0.05,
            "toneAndSentiment": 0.05,
            "nonVerbalCommunication": 0.05
        }

        calibrated_scores = {}
        weighted_sum = 0.0

        for cat, weight in category_weights.items():
            raw_val = scores.get(cat, 3)
            try:
                val = int(raw_val)
                # If model accidentally output on 1-10 scale, normalize to 1-5
                if val > 5:
                    val = max(1, min(5, round(val / 2)))
                else:
                    val = max(1, min(5, val))
            except Exception:
                val = 3
            
            calibrated_scores[cat] = val
            weighted_sum += val * weight

        result["scores"] = calibrated_scores
        result["overall"] = round(weighted_sum, 1)
            
        # Log the activity
        try:
            log_activity(
                api_key.user_id,
                ActivityLogger.INTERVIEW_SCORED,
                {
                    "overall": result.get("overall", 0),
                    "strengths": result.get("strengths", []),
                    "weaknesses": result.get("weaknesses", []),
                    "role": request.job_role or "Interview Candidate",
                    "rationale": result.get("rationale", "")
                }
            )
        except Exception as log_err:
            logger.debug(f"Activity logging skipped: {log_err}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error scoring interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

