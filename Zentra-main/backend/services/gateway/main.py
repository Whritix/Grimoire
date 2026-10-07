"""
API Gateway - Main entry point for the AI Agents system.
Exposes OpenAI-compatible endpoints for all agents.
Enhanced with WebSocket, tracing, function calls, and PDF generation.
"""

from contextlib import asynccontextmanager
from typing import Any
import os
import logging
import time

from fastapi import FastAPI, Request, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi.errors import RateLimitExceeded

from shared.config import get_settings

# Configure basic logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Trigger system reload 5


# Trigger system reload for immediate feedback fix
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    logger.info("AI Agents System starting up")
    logger.info(f"Environment: {settings.env}")
    logger.info(f"Debug Mode: {settings.debug}")
    logger.info(f"Log Level: {settings.log_level}")
    logger.info(f"Redis URL: {settings.redis_url}")
    logger.info(f"Chroma URL: {settings.chroma_url}")
    logger.info(f"YouTube Enabled: {bool(settings.youtube_api_key)}")
    logger.info(f"Local LLM Enabled: {settings.local_llm_enabled}")
    
    # Pre-initialize VectorStore to avoid first-request latency
    try:
        from shared.memory.vector_store import get_vector_store
        logger.info("Initializing Vector Store...")
        get_vector_store()
        logger.info("Vector Store initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Vector Store: {e}")
    
    yield
    logger.info("AI Agents System shutting down")


# Create application
settings = get_settings()
app = FastAPI(
    title="GRIMOIRE AI Agents API",
    description="Microservices gateway for the GRIMOIRE learning platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

@app.on_event("startup")
async def startup_event():
    logger.info("Registered Routes:")
    for route in app.routes:
        logger.info(f"{route.path} [{','.join(route.methods)}]")

# Add CORS middleware
# Add TrustedHost middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*"]  # Allow all hosts for Railway/Production dynamic domains
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://grimoire.app",
        "https://www.grimoire.app",
        "https://zentra.app",
        "https://www.zentra.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add tracing middleware
from shared.middleware import limiter, rate_limit_exceeded_handler, TracingMiddleware
app.add_middleware(TracingMiddleware)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add X-Response-Time header to all responses."""
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Response-Time"] = f"{process_time:.2f}ms"
    return response


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with standard format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": str(exc.status_code), "message": exc.detail}},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": str(exc)}},
    )


# Import and include agent routers
from services.planner.router import router as planner_router
from services.retriever.router import router as retriever_router
from services.composer.router import router as composer_router
from services.assessment.router import router as assessment_router
from services.doubt.router import router as doubt_router
from services.doubt.conversation_router import router as conversation_router
from services.rl_controller.router import router as rl_router
from services.badge.router import router as badge_router
from services.summarize.router import router as summarize_router
from services.progress.router import router as progress_router
from services.roadmap.router import router as roadmap_router
from services.interview.router import router as interview_router
from services.quiz.router import router as quiz_router
from services.bookmarks.router import router as bookmarks_router
from services.insights.router import router as insights_router
from services.portfolio.router import router as portfolio_router
from services.notes_intelligence.router import router as notes_intelligence_router

app.include_router(planner_router, prefix="/v1/agents", tags=["Planner"])
app.include_router(retriever_router, prefix="/v1/agents", tags=["Retriever"])
app.include_router(composer_router, prefix="/v1/agents", tags=["Composer"])
app.include_router(assessment_router, prefix="/v1/agents", tags=["Assessment"])
app.include_router(doubt_router, prefix="/v1/agents", tags=["Doubt Assistant"])
app.include_router(conversation_router, prefix="/v1/agents", tags=["Conversations"])
app.include_router(rl_router, prefix="/v1/agents", tags=["RL Controller"])
app.include_router(badge_router, prefix="/v1/agents", tags=["Badge"])
app.include_router(summarize_router, prefix="/v1/agents", tags=["Summarize"])
app.include_router(progress_router, prefix="/v1/agents", tags=["Progress"])
app.include_router(roadmap_router, prefix="/v1/agents", tags=["Roadmap"])
app.include_router(interview_router, prefix="/v1/agents", tags=["Interview"])
app.include_router(quiz_router, prefix="/v1/agents", tags=["Quiz"])
app.include_router(bookmarks_router, prefix="/v1/agents", tags=["Bookmarks"])
app.include_router(insights_router, prefix="/v1/agents", tags=["Insights"])
app.include_router(portfolio_router, prefix="/v1/agents", tags=["Portfolio"])
app.include_router(portfolio_router, prefix="/v1/agents", tags=["Portfolio"])
app.include_router(notes_intelligence_router, prefix="/v1/agents", tags=["Notes Intelligence"])
from services.podcast.router import router as podcast_router
app.include_router(podcast_router, prefix="/v1/agents", tags=["Podcast"])

# Mount static files for serving podcast audio
import os
assets_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets")
os.makedirs(assets_path, exist_ok=True)
app.mount("/assets", StaticFiles(directory=assets_path), name="assets")



# ============ WebSocket Endpoint ============
@app.websocket("/ws/doubt-assistant")
async def websocket_doubt_assistant(websocket: WebSocket):
    """WebSocket endpoint for real-time doubt assistant chat."""
    from services.doubt.websocket import handle_doubt_chat
    import uuid
    session_id = f"ws_{uuid.uuid4().hex[:12]}"
    await handle_doubt_chat(websocket, session_id)


# ============ Function Call Endpoint ============
class FunctionCallRequest(BaseModel):
    """Request to execute a function."""
    name: str
    arguments: dict[str, Any]



@app.post("/v1/functions/execute")
async def execute_function(request: FunctionCallRequest):
    """Execute a registered function by name."""
    from shared.functions import execute_function as exec_fn
    from shared.activity import log_activity, ActivityLogger
    
    result = await exec_fn(request.name, **request.arguments)
    
    user_id = request.arguments.get("user_id")
    activity_data = {
        "function": request.name,
        "success": result.status.value == "success",
        "execution_time_ms": result.execution_time_ms
    }
    
    # Extract topics from video analysis
    if request.name == "fetch_transcript" and result.result:
        res = result.result
        if res.get("summary"):
            activity_data["topics"] = extract_topics_from_text(res.get("summary", ""))
        activity_data["video_id"] = res.get("video_id")
        
        if user_id:
             # Explicitly log as VIDEO_ANALYZED for better recall
             log_activity(
                 user_id, 
                 ActivityLogger.VIDEO_ANALYZED, 
                 {
                     "video_id": res.get("video_id"),
                     "summary": res.get("summary", "")[:500],
                     "topics": activity_data["topics"]
                 }
             )
    
    if user_id:
        # Also log the generic function call
        log_activity(user_id, ActivityLogger.FUNCTION_CALLED, activity_data)
    else:
        logger.warning(f"Function {request.name} executed without user_id context. Activity not logged.")
    
    return {
        "name": result.name,
        "status": result.status.value,
        "result": result.result,
        "error": result.error,
        "execution_time_ms": result.execution_time_ms,
    }


def extract_topics_from_text(text: str) -> list:
    """Extract topic keywords from text."""
    # Simple keyword extraction
    import re
    words = re.findall(r'\b[A-Za-z]{4,}\b', text.lower())
    # Filter common words
    stopwords = {'this', 'that', 'with', 'from', 'have', 'been', 'will', 'about', 'which', 'their', 'there', 'would', 'could', 'should', 'being', 'after', 'before', 'other', 'through', 'video', 'learn', 'tutorial'}
    topics = [w for w in words if w not in stopwords]
    # Return unique topics
    seen = set()
    unique = []
    for t in topics:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    return unique[:10]



@app.get("/v1/functions/available")
async def list_functions():
    """List available functions for function calling."""
    from shared.functions import get_available_functions
    return {"functions": get_available_functions()}


# ============ User Activity & Personalization ============
class ActivityLogRequest(BaseModel):
    """Request to log user activity."""
    user_id: str
    activity_type: str
    data: dict[str, Any] = {}
    metadata: dict[str, Any] = {}


class ProfileUpdateRequest(BaseModel):
    """Request to update user profile."""
    user_id: str
    updates: dict[str, Any]


@app.post("/v1/user/activity")
async def log_user_activity(request: ActivityLogRequest):
    """Log a user activity event."""
    from shared.activity import log_activity
    
    success = log_activity(
        request.user_id,
        request.activity_type,
        request.data,
        request.metadata
    )
    
    return {"success": success, "message": "Activity logged" if success else "Failed to log activity"}


@app.get("/v1/user/activity/{user_id}")
async def get_user_activities(user_id: str, activity_type: str = None, limit: int = 50):
    """Get recent activities for a user."""
    from shared.activity import get_user_activity
    
    activities = get_user_activity(user_id, activity_type, limit)
    return {"user_id": user_id, "activities": activities, "count": len(activities)}


@app.get("/v1/user/profile/{user_id}")
async def get_user_profile(user_id: str):
    """Get user profile with preferences and stats."""
    from shared.activity.logger import get_user_profile
    
    profile = get_user_profile(user_id)
    return {"user_id": user_id, **profile}


@app.post("/v1/user/profile")
async def update_user_profile(request: ProfileUpdateRequest):
    """Update user profile preferences."""
    from shared.activity.logger import update_user_profile
    
    success = update_user_profile(request.user_id, request.updates)
    return {"success": success, "user_id": request.user_id}


@app.get("/v1/user/context/{user_id}")
async def get_personalization_context(user_id: str):
    """Get personalization context for AI interactions."""
    from shared.activity import get_user_context
    
    context = get_user_context(user_id)
    return {"user_id": user_id, "context": context}


# ============ Saved Plans ============
class SavePlanRequest(BaseModel):
    """Request to save a lesson plan."""
    user_id: str
    title: str
    goal: str
    items: list[dict[str, Any]]
    difficulty: str = "intermediate"
    source: str = "planner"
    metadata: dict[str, Any] = {}


class PlanProgressRequest(BaseModel):
    """Request to update plan progress."""
    user_id: str
    plan_id: str
    item_index: int
    completed: bool = True
    score: float = None


@app.post("/v1/plans/save")
async def save_lesson_plan(request: SavePlanRequest):
    """Save a lesson plan for a user."""
    from services.progress.saved_plans import save_plan
    
    plan = save_plan(
        user_id=request.user_id,
        title=request.title,
        goal=request.goal,
        items=request.items,
        difficulty=request.difficulty,
        source=request.source,
        metadata=request.metadata
    )
    return {"success": True, "plan": plan}


@app.get("/v1/plans/{user_id}")
async def get_user_plans(user_id: str):
    """Get all saved plans for a user."""
    from services.progress.saved_plans import get_user_plans
    
    plans = get_user_plans(user_id)
    return {"user_id": user_id, "plans": plans, "count": len(plans)}


@app.get("/v1/plans/{user_id}/{plan_id}")
async def get_plan_details(user_id: str, plan_id: str):
    """Get details of a specific plan."""
    from services.progress.saved_plans import get_plan_by_id
    
    plan = get_plan_by_id(user_id, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@app.post("/v1/plans/progress")
async def update_plan_progress(request: PlanProgressRequest):
    """Update progress on a plan item."""
    from services.progress.saved_plans import update_plan_progress
    from shared.activity import log_activity, ActivityLogger
    
    plan = update_plan_progress(
        request.user_id,
        request.plan_id,
        request.item_index,
        request.completed,
        request.score
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan or item not found")
    
    # Log the activity
    log_activity(request.user_id, ActivityLogger.LESSON_COMPLETED, {
        "plan_id": request.plan_id,
        "item_index": request.item_index,
        "score": request.score
    })
    
    return {"success": True, "plan": plan}


@app.delete("/v1/plans/{user_id}/{plan_id}")
async def delete_plan(user_id: str, plan_id: str):
    """Delete a saved plan."""
    from services.progress.saved_plans import delete_plan
    
    success = delete_plan(user_id, plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"success": True, "deleted": plan_id}


# ============ Personalized Recommendations ============
@app.get("/v1/recommendations/{user_id}")
async def get_recommendations(user_id: str, max_count: int = 5):
    """Get personalized learning recommendations combining all agents."""
    from shared.orchestrator import get_recommendation
    
    recommendations = get_recommendation(user_id, max_count)
    return {"user_id": user_id, "recommendations": recommendations}


@app.get("/v1/study-session/{user_id}")
async def get_study_session(user_id: str, duration_minutes: int = 60):
    """Generate a personalized study session using all agents."""
    from shared.orchestrator import generate_study_session
    
    session = generate_study_session(user_id, duration_minutes)
    return session


@app.get("/v1/daily-plan/{user_id}")
async def get_daily_plan(user_id: str):
    """Get today's personalized learning plan with all agent inputs."""
    from shared.orchestrator import LearningOrchestrator
    from services.progress.saved_plans import get_active_plan
    
    orchestrator = LearningOrchestrator(user_id)
    state = orchestrator.get_user_state()
    active_plan = get_active_plan(user_id)
    
    # Build daily plan
    daily_items = []
    
    # Add next items from active plan
    if active_plan:
        items = active_plan.get("items", [])
        for i, item in enumerate(items):
            if not item.get("completed", False):
                daily_items.append({
                    "type": "lesson",
                    "title": item.get("title", f"Lesson {i+1}"),
                    "description": item.get("description", ""),
                    "duration_minutes": item.get("duration_minutes", 30),
                    "from_plan": active_plan.get("title"),
                    "plan_id": active_plan.get("plan_id"),
                    "item_index": i
                })
                if len(daily_items) >= 3:  # Max 3 lessons from plan
                    break
    
    # Add a quiz if needed
    signals = state["signals"]
    if signals.get("lessons_completed", 0) > 0:
        daily_items.append({
            "type": "quiz",
            "title": "Knowledge Check",
            "description": "Test your understanding of recent lessons",
            "duration_minutes": 15
        })
    
    # Add RL-based adjustment
    rl_rec = state["rl_recommendation"]
    
    return {
        "user_id": user_id,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "difficulty_level": state["difficulty_level"],
        "rl_recommendation": rl_rec,
        "active_plan": {
            "title": active_plan.get("title") if active_plan else None,
            "progress_pct": active_plan.get("progress_pct") if active_plan else 0
        },
        "daily_items": daily_items,
        "estimated_time_minutes": sum(item.get("duration_minutes", 30) for item in daily_items)
    }


# Import datetime for daily plan
from datetime import datetime


# ============ Health & Metrics ============
class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    environment: str
    services: dict[str, str]


@app.get("/v1/agents/health", response_model=HealthResponse)
async def health_check():
    """Check system health and service statuses."""
    from shared.models import get_model_router
    router = get_model_router()
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        environment=settings.env,
        services={
            "gemini": "connected" if router._gemini_configured else "not_configured",
            "local_llm": "enabled" if settings.local_llm_enabled else "disabled",
            "firebase": "configured" if settings.firebase_project_id else "not_configured",
        },
    )


@app.get("/v1/agents/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi.responses import Response
    
    if not settings.metrics_enabled:
        raise HTTPException(status_code=404, detail="Metrics disabled")
    
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ============ Tenant/Usage Endpoint ============
@app.get("/v1/usage")
async def get_usage():
    """Get current tenant usage and quota information."""
    from shared.tenants import get_tenant_store
    
    store = get_tenant_store()
    tenant = store.get_tenant("default")
    usage = store.get_usage("default")
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {
        "tenant_id": tenant.tenant_id,
        "tier": tenant.tier.value,
        "limits": tenant.limits,
        "usage": {
            "tokens_used_today": usage.tokens_used_today,
            "requests_this_minute": usage.requests_this_minute,
        }
    }


@app.get("/")
async def root():
    """Root endpoint for API."""
    return {"message": "Teaching Assistant API is running", "docs_url": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "services.gateway.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
