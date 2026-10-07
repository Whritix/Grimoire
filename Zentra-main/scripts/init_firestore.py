import os
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent / 'backend'))
from shared.storage.firebase_client import get_firebase_client

def init_db():
    print("Testing Firebase initialization...")
    client = get_firebase_client()
    db = client.db
    
    print("Firebase DB connected.")
    
    collections = ['users', 'roadmaps', 'lessons', 'assessment_results', 'badges', 'rl_signals', 'user_notes']
    for coll in collections:
        print(f"Ensuring collection '{coll}' has at least one document...")
        try:
            # Check if there's any doc
            docs = list(db.collection(coll).limit(1).stream())
            if not docs:
                db.collection(coll).document('_init_').set({'_status': 'initialized'})
                print(f"Collection '{coll}' initialized.")
            else:
                print(f"Collection '{coll}' already has documents.")
        except Exception as e:
            print(f"Error checking/creating {coll}: {e}")

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / 'backend' / '.env')
    init_db()
