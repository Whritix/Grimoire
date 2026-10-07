"""
Planner Agent - Creates personalized learning roadmaps.
"""

from pathlib import Path
from typing import Any
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import asyncio
from typing import List, Dict

from shared.middleware import AuthenticatedUser, heavy_limit
from shared.middleware.sanitizer import sanitize_message_content, sanitize_string_field
from shared.models import get_model_router, AgentType
from shared.utils import create_response, safe_validate, get_logger
from shared.utils.schema_validator import extract_json_from_text

logger = get_logger(__name__)

router = APIRouter()

# Load prompt template
PROMPT_PATH = Path(__file__).parent.parent.parent / "shared" / "prompts" / "planner.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else ""


def _build_fallback_lessons(title: str) -> list[dict[str, Any]]:
    """Build fallback lesson links only when the model returned no usable lessons/resources."""
    search_query = title.replace(" ", "+").lower()
    return [
        {
            "id": f"fallback_{search_query}_yt",
            "lessonId": f"fallback_{search_query}_yt",
            "title": f"YouTube: {title} Tutorial",
            "url": f"https://www.youtube.com/results?search_query={search_query}+tutorial",
            "type": "youtube",
            "duration": 30,
            "estMin": 30,
        },
        {
            "id": f"fallback_{search_query}_web",
            "lessonId": f"fallback_{search_query}_web",
            "title": f"Web: Learn {title}",
            "url": f"https://www.google.com/search?q={search_query}+tutorial+guide",
            "type": "article",
            "duration": 20,
            "estMin": 20,
        },
    ]


def _ensure_module_resources(module: dict[str, Any]) -> None:
    """Normalize module resources so both `lessons` and legacy `resources` are available."""
    lessons = module.get("lessons")
    resources = module.get("resources")

    has_lessons = isinstance(lessons, list) and len(lessons) > 0
    has_resources = isinstance(resources, list) and len(resources) > 0

    if has_lessons:
        if not has_resources:
            module["resources"] = lessons
        return

    if has_resources:
        module["lessons"] = resources
        return

    title = module.get("title", "topic")
    fallback = _build_fallback_lessons(title)
    module["lessons"] = fallback
    module["resources"] = fallback
    logger.info(f"Added fallback resources for module: {title}")


class Message(BaseModel):
    """Chat message."""
    role: str
    content: str


class PlannerRequest(BaseModel):
    """Planner agent request."""
    model: str = "planner-v1"
    messages: list[Message]
    temperature: float = 0.1
    max_tokens: int = 8000
    schema_version: str = "1.0"
    
    # Additional planner-specific fields
    diagnostic_results: dict[str, Any] | None = None
    user_goal: str | None = None
    availability_hours_per_week: int | None = None
    plan_type: str = "curriculum"  # "curriculum" or "schedule"
    time_horizon_weeks: int | None = None
    prerequisite_updates: list[dict[str, Any]] | None = None  # User answers to prerequisites


class PrerequisiteRequest(BaseModel):
    topic: str
    level: str


@router.post("/planner/prerequisites")
@heavy_limit
async def get_prerequisites(
    request: Request,
    body: PrerequisiteRequest,
    api_key: AuthenticatedUser,
):
    """Generate prerequisite questions for a topic."""
    logger.info("Prerequisites request", topic=body.topic)
    
    # 1. Deterministic Check (Disabled in favor of Generalized LLM logic)
    # from services.planner.dependencies import get_deterministic_prerequisites
    # deterministic_questions = get_deterministic_prerequisites(body.topic)
    # if deterministic_questions: ...
    
    # 2. LLM Generation (Generalized)
    prompt_path = Path(__file__).parent.parent.parent / "shared" / "prompts" / "planner_prerequisites.md"
    system_prompt = prompt_path.read_text(encoding="utf-8") if prompt_path.exists() else ""
    logger.info(f"System Prompt Loaded: {len(system_prompt)} chars")
    
    user_content = f"Target Field/Technology: {body.topic}\nCurrent Level: {body.level}"
    
    model_router = get_model_router()
    logger.info("Calling LLM for prerequisites...")
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.PLANNER,
            prompt=user_content,
            system_prompt=system_prompt,
            temperature=0.2, # Low temp for consistent JSON
            max_tokens=2000,
        )
        
        # Parse JSON
        import json
        import re
        
        content = response.content
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            data = json.loads(json_match.group())
            return create_response(
                model="planner-v1",
                payload=data,
                payload_type="prerequisites",
                human_summary="Prerequisite questions generated.",
                confidence=0.9
            )
        else:
            raise ValueError("Could not parse JSON from response")
            
    except Exception as e:
        logger.error("Prerequisites generation failed", error=str(e))
        # Fallback if generation fails - return empty to skip check
        return create_response(
            model="planner-v1",
            payload={"questions": []},
            payload_type="prerequisites",
            human_summary="No prerequisites found.",
            confidence=0.5
        )


@router.post("/planner")
@heavy_limit
async def create_roadmap(
    request: Request,
    body: PlannerRequest,
    api_key: AuthenticatedUser,
):
    """
    Generate a personalized learning roadmap or schedule.
    
    Type 'curriculum': Creates a structured roadmap based on diagnostic results.
    Type 'schedule': Creates a day-by-day learning calendar.
    """
    logger.info("Planner request received", model=body.model, type=body.plan_type)
    logger.info(f"Full Planner Request Body: {body.model_dump_json()}")
    
    # Sanitize user input messages to prevent prompt injection
    sanitized_messages = sanitize_message_content([{"role": m.role, "content": m.content} for m in body.messages])
    sanitized_goal = sanitize_string_field(body.user_goal, max_length=500) if body.user_goal else None
    
    # Build the user prompt from sanitized content
    user_content = ""
    for i, msg in enumerate(body.messages):
        if msg.role == "user":
            user_content += sanitized_messages[i]["content"] + "\n"
    
    if body.diagnostic_results:
        user_content += f"\nDiagnostic Results: {body.diagnostic_results}"
    if body.user_goal:
        user_content += f"\nGoal: {body.user_goal}"
    if body.availability_hours_per_week:
        user_content += f"\nAvailability: {body.availability_hours_per_week} hours/week"
    # Force "Unlimited" if frontend sends the default 12, or if explicitly requested
    if body.time_horizon_weeks and body.time_horizon_weeks != 12:
        user_content += f"\nTime Horizon: {body.time_horizon_weeks} weeks"
    else:
        # Ignore "12" or None. Force the LLM to think "Unlimited".
        user_content += "\nTime Horizon: Flexible/Unlimited. Do not limit the roadmap. Target comprehensive mastery (20+ modules)."
    
    # --- Prerequisite & Readiness Logic ---
    # --- Prerequisite & Readiness Logic ---
    if body.prerequisite_updates:
        # 1. Deterministic Check: Look for explicit missing topics
        explicit_missing_topics = []
        for update in body.prerequisite_updates:
            # Check for negative answers
            ans_id = str(update.get("answer", "")).lower()
            ans_text = str(update.get("answer_text", "")).lower()
            
            if (ans_id == "no" or "new to this" in ans_text or "basic" in ans_id) and update.get("topics_if_no"):
                 explicit_missing_topics.extend(update.get("topics_if_no", []))
                 
        if explicit_missing_topics:
            from services.planner.dependencies import get_dependent_gaps
            
            # Expand with inference engine
            all_gaps = get_dependent_gaps(explicit_missing_topics)
            logger.info(f"Inferred missing topics: {all_gaps} (from {explicit_missing_topics})")
            
            # Deduplicate and Sort based on typical progression complexity
            # This is a heuristic sort to ensure foundations come before advanced topics
            ORDER_HEURISTIC = [
                "python", "javascript", "math", "linear algebra", "calculus", 
                "react", "backend", "machine learning", "deep learning", "large language models"
            ]
            
            def sort_key(topic):
                t = topic.lower()
                for i, key in enumerate(ORDER_HEURISTIC):
                    if key in t:
                        return i
                return 999 

            foundations = sorted(list(set(all_gaps)), key=sort_key)
            reasoning = "Based on your answers, we've identified specific foundational topics you need to cover first."
             
            # Plan sequence: [Foundation 1, Foundation 2, ..., Main Goal]
            plan_sequence = foundations + [body.user_goal]
            
            generated_roadmaps = []
            from services.progress.saved_plans import save_plan
            
            for i, topic in enumerate(plan_sequence):
                is_main = (i == len(plan_sequence) - 1)
                topic_goal = topic if is_main else f"Learn {topic} (Foundation for {body.user_goal})"
                
                logger.info(f"Generating roadmap for step {i+1}: {topic_goal}")
                
                # Generate standard roadmap for this topic
                formatted_prompt = f"Goal: {topic_goal}\nAvailability: {body.availability_hours_per_week or 10} hours/week"
                
                # Generate
                topic_response = await get_model_router().generate(
                    agent_type=AgentType.PLANNER,
                    prompt=formatted_prompt,
                    system_prompt=SYSTEM_PROMPT, 
                    temperature=0.2,
                    max_tokens=8000
                )
                
                # Validate & Parse
                validation = safe_validate(topic_response.content, "roadmap")
                if validation.success and validation.data:
                    roadmap_data = validation.data
                    roadmap_title = roadmap_data.get("title") or topic
                    
                    # Post-process resources/lessons while preserving legacy field compatibility.
                    if roadmap_data.get("modules"):
                        for module in roadmap_data["modules"]:
                            _ensure_module_resources(module)

                    # Save to DB with metadata for UI
                    # First one is ACTIVE, others are LOCKED
                    status = "active" if i == 0 else "locked"
                    
                    saved_plan = save_plan(
                            user_id=api_key.user_id,
                            title=roadmap_title,
                            goal=topic_goal,
                            items=roadmap_data.get("modules", []),
                            difficulty="Beginner" if not is_main else "Intermediate",
                            source="planner_guided",
                            metadata={
                                "is_foundation": not is_main, 
                                "main_goal": body.user_goal,
                                "sequence_order": i + 1,
                                "status": status
                            }
                    )
                    
                    generated_roadmaps.append({
                        "title": roadmap_title,
                        "id": saved_plan.get("plan_id"),
                        "description": f"Step {i+1}: {topic}",
                        "status": status
                    })

            logger.info(f"Returning deterministic guided path with {len(generated_roadmaps)} roadmaps")
            return create_response(
                model="planner-v1",
                payload={
                    "roadmaps": generated_roadmaps,
                    "explanation": reasoning,
                    "ready": False
                },
                payload_type="guided_learning_path",
                human_summary=f"Analysis complete. {reasoning}",
                confidence=1.0
            )

        # 2. Start Analyst LLM Check (Fallback if no explicit topics found)
        readiness_prompt_path = Path(__file__).parent.parent.parent / "shared" / "prompts" / "planner_readiness.md"
        readiness_system_prompt = readiness_prompt_path.read_text(encoding="utf-8") if readiness_prompt_path.exists() else ""
        
        readiness_user_content = f"Target Goal: {body.user_goal}\nCurrent Level: {body.prerequisite_updates[0].get('level', 'Beginner')}\n\nPrerequisite Context:"
        for update in body.prerequisite_updates:
            readiness_user_content += f"\n- Question: {update.get('question_text')}\n  User Answer: {update.get('answer_text')}"
            
        model_router = get_model_router()
        try:
            readiness_response = await model_router.generate(
                agent_type=AgentType.PLANNER,
                prompt=readiness_user_content,
                system_prompt=readiness_system_prompt,
                temperature=0.1,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            logger.info(f"Readiness Prompt: {readiness_user_content}")
            logger.info(f"Readiness Response: {readiness_response.content}")
            
            import json
            import re
            readiness_data = {}
            json_match = re.search(r"\{[\s\S]*\}", readiness_response.content)
            if json_match:
                readiness_data = json.loads(json_match.group())
            
            logger.info(f"Readiness Decision: Ready={readiness_data.get('ready')}")
            logger.info(f"Readiness Reasoning: {readiness_data.get('reasoning')}")
            logger.info(f"Foundations Needed: {readiness_data.get('foundations_needed')}")
                
            if readiness_data.get("ready") is False:
                logger.info("User is NOT ready. Generating guided path...")
                # User is NOT ready. Generate Guided Path.
                foundations = readiness_data.get("foundations_needed", [])
                reasoning = readiness_data.get("reasoning", "You need some foundational knowledge first.")
                
                # Plan sequence: [Foundation 1, Foundation 2, ..., Main Goal]
                plan_sequence = foundations + [body.user_goal]
                
                generated_roadmaps = []
                from services.progress.saved_plans import save_plan
                
                # We need to generate roadmaps clearly for each
                # This could take time, so we do it serially or parallel. Serially is safer for rate limits.
                
                for i, topic in enumerate(plan_sequence):
                    is_main = (i == len(plan_sequence) - 1)
                    topic_goal = topic if is_main else f"Learn {topic} (Foundation for {body.user_goal})"
                    
                    logger.info(f"Generating roadmap for step {i+1}: {topic_goal}")
                    
                    # Generate standard roadmap for this topic
                    # Reuse the same planner prompt but specific goal
                    formatted_prompt = f"Goal: {topic_goal}\nAvailability: {body.availability_hours_per_week or 10} hours/week"
                    
                    # Generate
                    topic_response = await model_router.generate(
                        agent_type=AgentType.PLANNER,
                        prompt=formatted_prompt,
                        system_prompt=SYSTEM_PROMPT, 
                        temperature=0.2,
                        max_tokens=8000
                    )
                    
                    # Validate & Parse
                    validation = safe_validate(topic_response.content, "roadmap")
                    if validation.success and validation.data:
                        roadmap_data = validation.data
                        roadmap_title = roadmap_data.get("title") or topic
                        
                        # Post-process resources/lessons while preserving legacy field compatibility.
                        if roadmap_data.get("modules"):
                            for module in roadmap_data["modules"]:
                                _ensure_module_resources(module)

                        # Save to DB
                        saved_plan = save_plan(
                             user_id=api_key.user_id, # Assumes api_key has user_id, need to check middleware
                             title=roadmap_title,
                             goal=topic_goal,
                             items=roadmap_data.get("modules", []),
                             difficulty="Beginner" if not is_main else "Intermediate", # Heuristic
                             source="planner_guided",
                             metadata={"is_foundation": not is_main, "main_goal": body.user_goal}
                        )
                        
                        generated_roadmaps.append({
                            "title": roadmap_title,
                            "id": saved_plan.get("plan_id"),
                            "description": f"Step {i+1}: {topic}"
                        })

                logger.info(f"Returning guided path with {len(generated_roadmaps)} roadmaps")
                return create_response(
                    model="planner-v1",
                    payload={
                        "roadmaps": generated_roadmaps,
                        "explanation": reasoning,
                        "ready": False
                    },
                    payload_type="guided_learning_path",
                    human_summary=f"Analysis complete. {reasoning}",
                    confidence=0.95
                )

        except Exception as e:
            logger.error("Readiness check failed", error=str(e))
            # Fallthrogh to standard generation if check fails
            pass
            
    # --- End Readiness Logic ---

    if body.prerequisite_updates:
        user_content += "\n\nUser Prerequisite Context (Adjust roadmap based on this):"
        for update in body.prerequisite_updates:
            q_text = update.get("question_text", "Question")
            answer = update.get("answer_text", "Answer")
            # If answer indicates lack of knowledge, explicit instruction
            user_content += f"\n- Question: {q_text}\n  User Answer: {answer}"
            
        user_content += "\n\nINSTRUCTION: Ensure the roadmap addresses any gaps identified in the Prerequisite Context. Add specific modules at the beginning if the user lacks prerequisites."

    model_router = get_model_router()
    
    # Handle Schedule Mode
    if body.plan_type == "schedule":
        user_content += "\n\nCRITICAL: Output a day-by-day study schedule in JSON format."
        system_prompt = """
You are an expert Study Planner. Create a detailed day-by-day learning schedule.

Response JSON Schema:
{
  "schedule": [
    {
      "day": 1,
      "topic": "Topic Name",
      "activities": ["Read X", "Practice Y"],
      "time_minutes": 60
    }
  ],
  "summary": "Brief summary of the plan"
}
"""
        validation_schema = "schedule" # We will use generic validation or loose parsing
    else:
        system_prompt = SYSTEM_PROMPT
        validation_schema = "roadmap"
    
    try:
        response = await model_router.generate(
            agent_type=AgentType.PLANNER,
            prompt=user_content,
            system_prompt=system_prompt,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
            response_format={"type": "json_object"}
        )
    except Exception as e:
        logger.error("Model generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Model error: {str(e)}")
    
    # Parse Response
    import json
    import re
    
    if body.plan_type == "schedule":
         # Custom parsing for schedule since we don't have a rigid schema file for it yet
         # or we can reuse safe_validate if we add a schema. For now, loose parsing.
         content = response.content
         json_match = re.search(r"\{[\s\S]*\}", content)
         if json_match:
             try:
                 data = json.loads(json_match.group())
                 return create_response(
                    model=body.model,
                    payload=data,
                    payload_type="schedule",
                    human_summary=data.get("summary", "Schedule created."),
                    confidence=0.9
                 )
             except:
                 pass
         
         # Fallback
         return create_response(
            model=body.model,
            payload={"raw_response": content},
            payload_type="schedule",
            human_summary="Schedule generated (raw).",
            confidence=0.7
         )

    # Standard Roadmap Validation
    # Pass the raw response to the validator so it can handle wrappers,
    # markdown fences, and truncated JSON repair in one place.
    validation = safe_validate(response.content, "roadmap")
    
    if not validation.success:
        best_effort_data = extract_json_from_text(response.content)
        payload = {"raw_response": response.content}
        if isinstance(best_effort_data, dict):
            payload["parsed_data"] = best_effort_data

        logger.warning(
            "Schema validation failed",
            errors=validation.errors,
            raw_response=response.content[:500],
        )
        return create_response(
            model=body.model,
            payload=payload,
            payload_type="roadmap",
            human_summary="Roadmap generated with caveats; strict schema validation failed.",
            confidence=0.5,
            caveat=True,
            caveat_reason="; ".join(validation.errors),
            tokens_used=response.tokens_used,
        )
    
    # Post-process: Ensure all modules have lessons/resources.
    if validation.data and validation.data.get("modules"):
        for module in validation.data["modules"]:
            _ensure_module_resources(module)
    
    # Extract human summary
    human_summary = "Learning roadmap generated successfully."
    if validation.data:
        goal = validation.data.get("goal", "your goal")
        weeks = validation.data.get("estimated_weeks", "N/A")
        modules = len(validation.data.get("modules", []))
        human_summary = f"Created a {weeks}-week roadmap for '{goal}' with {modules} modules."
    
    # Ensure we have valid data with modules
    payload_data = validation.data or {}
    if not payload_data.get("modules"):
        logger.warning("Validation succeeded but no modules found in data", data=payload_data)
        # Return raw response fallback
        return create_response(
            model=body.model,
            payload={"raw_response": response.content, "parsed_data": payload_data},
            payload_type="roadmap",
            human_summary="Roadmap generated but modules could not be parsed.",
            confidence=0.5,
            caveat=True,
            caveat_reason="No modules found in response",
            tokens_used=response.tokens_used,
        )
    
    return create_response(
        model=body.model,
        payload=payload_data,
        payload_type="roadmap",
        human_summary=human_summary,
        confidence=0.9 if not validation.warnings else 0.8,
        caveat=response.caveat,
        caveat_reason=response.caveat_reason,
        tokens_used=response.tokens_used,
    )

