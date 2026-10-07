
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from shared.storage.firebase_client import get_firebase_client
from shared.activity import log_activity, ActivityLogger

async def seed_and_verify():
    print("Initializing Firebase...")
    db = get_firebase_client()
    
    user_id = "test_user_portfolio"
    
    print(f"Seeding data for {user_id}...")
    
    # 1. Seed User Profile
    await db.save_user_profile(user_id, {
        "name": "Test Portfolio User",
        "email": "test@Zentra.app",
        "bio": "Automated test user for portfolio verification.",
        "joined_at": "2024-01-01"
    })
    
    # 2. Seed Badges
    badge_data = {
        "badge_id": "badge_test_1",
        "metadata": {
            "name": "Beta Tester",
            "description": "Verified portfolio feature",
            "criteria": "Run verification script"
        },
        "issued_at": "2024-12-23T12:00:00Z"
    }
    await db.save_badge("badge_test_1", {**badge_data, "user_id": user_id})
    
    # 3. Seed Progress
    print("Seeding progress...")
    progress_data = {
        "history": [],
        "stats": {
            "lessons": 5,
            "quizzes": 2,
            "avg_score": 95.5,
            "difficulty_level": "Intermediate"
        }
    }
    # Direct access to firestore client for collections not wrapped in FirebaseClient
    db.db.collection("user_progress").document(user_id).set(progress_data)
    
    # 4. Log some activity for stats
    log_activity(user_id, ActivityLogger.LESSON_COMPLETED, {"title": "Intro to AI"})
    
    print("Data seeded. Now you can test the endpoint:")
    print(f"http://localhost:8000/v1/agents/portfolio/public/{user_id}")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_and_verify())
