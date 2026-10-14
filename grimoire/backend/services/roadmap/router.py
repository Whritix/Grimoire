"""
Roadmap Service - Stores and retrieves user learning roadmaps.
Uses Firebase Firestore for storage.
"""

import asyncio
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.middleware import AuthenticatedUser
from shared.utils import get_logger
from shared.storage.firebase_client import get_firebase_client

logger = get_logger(__name__)

router = APIRouter()

db = get_firebase_client()


class SaveRoadmapRequest(BaseModel):
    userId: str
    technology: str
    level: str
    roadmap: List[Dict[str, Any]]  # modules array


@router.post("/roadmap/save")
async def save_roadmap(request: SaveRoadmapRequest, _api_key: AuthenticatedUser):
    """Save a learning roadmap to Firebase."""
    try:
        roadmap_data = {
            "user_id": request.userId,
            "userId": request.userId,  # Keep for backward compatibility
            "technology": request.technology,
            "level": request.level,
            "modules": request.roadmap,
            "status": "active",
            "progress": 0,
            "progress_pct": 0,  # Sync with saved_plans
            "createdAt": __import__('datetime').datetime.now().isoformat()
        }
        
        # Save to Firebase
        doc_ref = db.db.collection("roadmaps").document()
        doc_ref.set(roadmap_data)
        
        # Log activity
        from shared.activity import log_activity, ActivityLogger
        log_activity(request.userId, ActivityLogger.ROADMAP_GENERATED, {
            "topic": request.technology,
            "level": request.level,
            "roadmap_id": doc_ref.id
        })
        
        return {
            "success": True,
            "roadmap": {"id": doc_ref.id, **roadmap_data}
        }
    except Exception as e:
        logger.error("Failed to save roadmap", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save roadmap: {str(e)}")


@router.get("/roadmap/list")
async def list_roadmaps(userId: str, _api_key: AuthenticatedUser):
    """Get all roadmaps for a user from Firebase."""
    try:
        if not userId:
            return {"roadmaps": []}

        # Run both field-name queries in parallel (sync Firestore SDK → thread pool)
        loop = asyncio.get_event_loop()

        def _query_camel():
            return list(db.db.collection("roadmaps").where("userId", "==", userId).stream())

        def _query_snake():
            return list(db.db.collection("roadmaps").where("user_id", "==", userId).stream())

        docs_camel, docs_snake = await asyncio.gather(
            loop.run_in_executor(None, _query_camel),
            loop.run_in_executor(None, _query_snake),
        )

        seen_ids = set()
        roadmaps = []

        for doc in docs_camel:
            if doc.id not in seen_ids:
                data = doc.to_dict()
                data["id"] = doc.id
                roadmaps.append(data)
                seen_ids.add(doc.id)

        for doc in docs_snake:
            if doc.id not in seen_ids:
                data = doc.to_dict()
                data["id"] = doc.id
                roadmaps.append(data)
                seen_ids.add(doc.id)

        # Sort by createdAt descending
        roadmaps.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

        return {"roadmaps": roadmaps}
    except Exception as e:
        logger.error("Failed to fetch roadmaps", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to fetch roadmaps: {str(e)}")


@router.delete("/roadmap/delete")
async def delete_roadmap(roadmap_id: str, user_id: str, _api_key: AuthenticatedUser):
    """Delete a roadmap from Firebase."""
    try:
        # Verify ownership
        roadmap = await db.get_roadmap(roadmap_id)
        if not roadmap:
             raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Check userId field (might be camelCase in DB)
        owner_id = roadmap.get("userId") or roadmap.get("user_id")
        if owner_id != user_id:
             raise HTTPException(status_code=403, detail="Not authorized to delete this roadmap")
             
        await db.delete_roadmap(roadmap_id)
        return {"success": True}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error("Failed to delete roadmap", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete roadmap: {str(e)}")


async def add_prerequisite_to_roadmap(user_id: str, target_topic: str, prerequisite_module: Dict[str, Any]):
    """
    Internal function to inject a prerequisite module into a user's active roadmap.
    Finds the module matching 'target_topic' and inserts 'prerequisite_module' before it.
    """
    try:
        # 1. Fetch user's roadmaps (assuming the most recent/active one)
        # Avoid order_by in query to prevent index requirements
        docs = db.db.collection("roadmaps").where("userId", "==", user_id).stream()
        all_roadmaps = list(docs)
        
        if not all_roadmaps:
             # Try snake_case
            docs = db.db.collection("roadmaps").where("user_id", "==", user_id).stream()
            all_roadmaps = list(docs)
        
        if not all_roadmaps:
            logger.warning(f"No active roadmap found for user {user_id} to add prerequisite.")
            return False

        # Sort in memory by createdAt descending
        def get_sort_key(doc):
            data = doc.to_dict()
            val = data.get("createdAt") or data.get("created_at")
            return str(val) if val else ""

        all_roadmaps.sort(key=get_sort_key, reverse=True)
        active_roadmap_doc = all_roadmaps[0]

        roadmap_data = active_roadmap_doc.to_dict()
        modules = roadmap_data.get("modules", [])
        
        # 2. Find target index
        insert_index = -1
        # Normalize target topic for comparison (simple check)
        target_clean = target_topic.lower().strip()
        
        for i, module in enumerate(modules):
            # Check title or topic
            title = module.get("title", "").lower()
            if target_clean in title or title in target_clean:
                insert_index = i
                break
        
        if insert_index == -1:
            # If we can't find the exact topic, maybe user just finished it? 
            # Or maybe we just append it? For now, if we can't find context, we might skip 
            # OR we can prepend it to the whole list if it's really fundamental.
            # Let's log it and maybe append check if it's already there?
            logger.info(f"Target topic '{target_topic}' not found in roadmap. Prepending prerequisite.")
            insert_index = 0
            
        # 3. Insert prerequisite
        # Check if already exists to avoid dupes or update
        prereq_title = prerequisite_module.get("title", "Prerequisite")
        existing_module_index = -1
        
        for idx, mod in enumerate(modules):
            if mod.get("title") == prereq_title:
                existing_module_index = idx
                break
        
        if existing_module_index != -1:
            logger.info("Prerequisite already exists in roadmap. Merging topics.")
            existing_mod = modules[existing_module_index]
            current_topics = existing_mod.get("topics", [])
            new_topics = prerequisite_module.get("topics", [])
            
            # Merge unique topics
            updated_topics = list(current_topics)
            for t in new_topics:
                if t not in updated_topics:
                    updated_topics.append(t)
            
            # Update the module
            existing_mod["topics"] = updated_topics
            existing_mod["status"] = "pending" # Reset status to pending so user sees it again
            modules[existing_module_index] = existing_mod
        else:
            modules.insert(insert_index, prerequisite_module)
        
        # 4. Save back to Firestore
        db.db.collection("roadmaps").document(active_roadmap_doc.id).update({
            "modules": modules
        })
        
        logger.info(f"Added prerequisite '{prereq_title}' to roadmap {active_roadmap_doc.id}")
        return True

    except Exception as e:
        logger.error("Failed to add prerequisite", error=str(e))
        return False
