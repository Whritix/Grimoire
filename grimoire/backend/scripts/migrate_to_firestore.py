import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

# Add parent directory to path to import shared modules
# We need to make sure we are adding the 'backend' directory
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from shared.storage.firebase_client import get_firebase_client
from firebase_admin import firestore

def migrate():
    firebase = get_firebase_client()
    db = firebase.db

    # 1. Migrate user_activity.json -> users collection
    activity_path = backend_dir / "data" / "user_activity.json"
    if activity_path.exists():
        print(f"Loading activity data from {activity_path}...")
        with open(activity_path, "r", encoding="utf-8") as f:
            activity_data = json.load(f)
        
        total_users = len(activity_data)
        print(f"Found {total_users} users in activity data.")

        for i, (user_id, data) in enumerate(activity_data.items()):
            print(f"[{i+1}/{total_users}] Migrating activity for: {user_id}")
            user_ref = db.collection("users").document(user_id)
            
            profile = data.get("profile", {})
            stats = data.get("stats", {})
            
            # Clean up stats
            if "agents_used" in stats and not isinstance(stats["agents_used"], dict):
                stats["agents_used"] = dict(stats["agents_used"])
            if "topics_explored" in stats and not isinstance(stats["topics_explored"], dict):
                stats["topics_explored"] = dict(stats["topics_explored"])
                
            user_ref.set({"profile": profile, "stats": stats}, merge=True)

            activities = data.get("activities", [])
            if activities:
                batch = db.batch()
                for j, activity in enumerate(activities):
                    act_ref = user_ref.collection("activities").document()
                    batch.set(act_ref, activity)
                    if (j + 1) % 400 == 0:
                        batch.commit()
                        batch = db.batch()
                batch.commit()
    else:
        print(f"No activity file found at {activity_path}")

    # 2. Migrate user_progress.json -> user_progress collection
    progress_path = backend_dir / "data" / "user_progress.json"
    if progress_path.exists():
        print(f"\nLoading progress data from {progress_path}...")
        with open(progress_path, "r", encoding="utf-8") as f:
            progress_data = json.load(f)
        
        total_progress = len(progress_data)
        for i, (user_id, data) in enumerate(progress_data.items()):
            print(f"[{i+1}/{total_progress}] Migrating progress for: {user_id}")
            db.collection("user_progress").document(user_id).set(data)
    else:
        print(f"No progress file found at {progress_path}")

    # 3. Migrate saved_plans.json -> roadmaps collection
    plans_path = backend_dir / "data" / "saved_plans.json"
    if plans_path.exists():
        print(f"\nLoading saved plans from {plans_path}...")
        with open(plans_path, "r", encoding="utf-8") as f:
            plans_data = json.load(f)
        
        total_plans_users = len(plans_data)
        for i, (user_id, data) in enumerate(plans_data.items()):
            plans = data.get("plans", [])
            print(f"[{i+1}/{total_plans_users}] Migrating {len(plans)} plans for: {user_id}")
            for plan in plans:
                plan_id = plan.get("plan_id")
                if plan_id:
                    db.collection("roadmaps").document(plan_id).set(plan)
    else:
        print(f"No plans file found at {plans_path}")

    print("\nFull migration completed successfully!")

if __name__ == "__main__":
    migrate()
