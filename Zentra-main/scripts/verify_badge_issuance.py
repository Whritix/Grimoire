
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from shared.storage.firebase_client import get_firebase_client
from services.progress.router import update_user_progress_internal

async def verify_badge_auto_issue():
    print("Initializing Firebase...")
    db = get_firebase_client()
    
    user_id = "test_badge_auto_user"
    
    # Reset user progress if exists (simplification: just overwrite)
    print(f"Updates progress for {user_id}...")
    
    # Simulate completing 1st lesson
    # We need to manually reset stats first to ensure it triggers 'lessons == 1'
    # Or just use a unique user ID
    
    # 1. Clear stats for test user
    # Direct access to firestore client for collections not wrapped in FirebaseClient
    db.db.collection("user_progress").document(user_id).set({
        "history": [],
        "stats": {"lessons": 0, "quizzes": 0, "avg_score": 0.0}
    })

    # 2. Complete Lesson
    await update_user_progress_internal(
        user_id=user_id,
        item_type="lesson",
        item_id="lesson_101",
        title="Introduction to Auto-Badges"
    )
    
    print("Lesson completed. Checking for badge...")
    
    # 3. Check Badges
    badges = await db.get_user_badges(user_id)
    if badges:
        print(f"✅ SUCCESS: Found {len(badges)} badges for user.")
        print(f"Badge: {badges[0]['metadata']['name']}")
        print(f"Description: {badges[0]['metadata']['description']}")
    else:
        print("❌ FAILURE: No badges found.")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_badge_auto_issue())
