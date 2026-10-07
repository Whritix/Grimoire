"""
Firebase Firestore client for data storage.
"""

import firebase_admin
from firebase_admin import credentials, firestore
from typing import Any
from functools import lru_cache

from shared.config import get_settings


class FirebaseClient:
    """
    Firebase Firestore client wrapper.
    Handles initialization and provides async-friendly methods.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._db: firestore.Client | None = None
        self._initialize()

    def _initialize(self) -> None:
        """Initialize Firebase Admin SDK."""
        try:
            # Check if already initialized
            if firebase_admin._apps:
                try:
                    self._db = firestore.client()
                    # Test connection briefly or just assume it works if no error
                    return
                except Exception as e:
                    print(f"Existing Firebase app faulty, re-initializing: {e}")
                    # delete existing apps to clean slate
                    for app in firebase_admin._apps.values():
                        firebase_admin.delete_app(app)

            cred = None
            
            # Debug credentials (redacted)
            email_len = len(self.settings.firebase_client_email) if self.settings.firebase_client_email else 0
            key_len = len(self.settings.firebase_private_key) if self.settings.firebase_private_key else 0
            project_id = self.settings.firebase_project_id
            print(f"Firebase Config: Project={project_id}, EmailLen={email_len}, KeyLen={key_len}")

            # Option 1: Direct Environment Variables (Best for Railway/Vercel)
            if self.settings.firebase_client_email and self.settings.firebase_private_key:
                # Handle possible escaped newlines in private key
                private_key = self.settings.firebase_private_key.replace("\\n", "\n")
                
                # Ensure header/footer are correct if missing (some env vars strip them)
                if "-----BEGIN PRIVATE KEY-----" not in private_key:
                     private_key = f"-----BEGIN PRIVATE KEY-----\n{private_key}\n-----END PRIVATE KEY-----"

                cred_dict = {
                    "type": "service_account",
                    "project_id": self.settings.firebase_project_id,
                    "private_key_id": "direct_env_var",
                    "private_key": private_key,
                    "client_email": self.settings.firebase_client_email,
                    "client_id": "direct_env_var",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{self.settings.firebase_client_email}"
                }
                cred = credentials.Certificate(cred_dict)
            
            # Option 2: JSON String/Path (Legacy/Local/Docker Fallback)
            # if not cred and hasattr(self.settings, "firebase_credentials_path") and self.settings.firebase_credentials_path:
            #      pass # Fallback removed to enforce environment variables


            if cred:
                print("Initializing Firebase with Service Account credentials.")
                firebase_admin.initialize_app(cred, {
                    "projectId": self.settings.firebase_project_id,
                })
            else:
                # Use default credentials (for Cloud Run, GCE, etc.)
                print("Initializing Firebase with Application Default Credentials (ADC).")
                firebase_admin.initialize_app()
            
            self._db = firestore.client()
            print("Firebase initialized successfully.")
        except Exception as e:
            print(f"Warning: Firebase initialization failed: {e}")
            # Do NOT set self._db to None if we want to retry or if we want to fail gracefully elsewhere
            # But the ActivityLogger expects it to potentially fail safe.
            self._db = None

    @property
    def db(self) -> firestore.Client:
        """Get Firestore client."""
        if self._db is None:
            raise RuntimeError("Firebase not initialized")
        return self._db

    # User Profiles
    async def get_user_profile(self, user_id: str) -> dict[str, Any] | None:
        """Get user profile by ID."""
        doc = self.db.collection("users").document(user_id).get()
        return doc.to_dict() if doc.exists else None

    async def save_user_profile(self, user_id: str, data: dict[str, Any]) -> None:
        """Save or update user profile."""
        self.db.collection("users").document(user_id).set(data, merge=True)

    # Roadmaps
    async def get_roadmap(self, roadmap_id: str) -> dict[str, Any] | None:
        """Get roadmap by ID."""
        doc = self.db.collection("roadmaps").document(roadmap_id).get()
        return doc.to_dict() if doc.exists else None

    async def save_roadmap(self, roadmap_id: str, data: dict[str, Any]) -> None:
        """Save roadmap."""
        self.db.collection("roadmaps").document(roadmap_id).set(data)

    async def get_user_roadmaps(self, user_id: str) -> list[dict[str, Any]]:
        """Get all roadmaps for a user."""
        docs = self.db.collection("roadmaps").where("user_id", "==", user_id).stream()
        return [doc.to_dict() for doc in docs]

    async def delete_roadmap(self, roadmap_id: str) -> None:
        """Delete roadmap."""
        self.db.collection("roadmaps").document(roadmap_id).delete()

    # Lessons
    async def get_lesson(self, lesson_id: str) -> dict[str, Any] | None:
        """Get lesson by ID."""
        doc = self.db.collection("lessons").document(lesson_id).get()
        return doc.to_dict() if doc.exists else None

    async def save_lesson(self, lesson_id: str, data: dict[str, Any]) -> None:
        """Save lesson."""
        self.db.collection("lessons").document(lesson_id).set(data)

    # Assessments
    async def save_assessment_result(
        self, user_id: str, question_id: str, result: dict[str, Any]
    ) -> None:
        """Save assessment result."""
        self.db.collection("assessment_results").add({
            "user_id": user_id,
            "question_id": question_id,
            **result,
        })

    async def get_user_assessment_history(
        self, user_id: str, limit: int = 50
    ) -> list[dict[str, Any]]:
        """Get assessment history for a user."""
        docs = (
            self.db.collection("assessment_results")
            .where("user_id", "==", user_id)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    # Badges
    async def save_badge(self, badge_id: str, data: dict[str, Any]) -> None:
        """Save badge."""
        self.db.collection("badges").document(badge_id).set(data)

    async def get_badge(self, badge_id: str) -> dict[str, Any] | None:
        """Get badge by ID."""
        doc = self.db.collection("badges").document(badge_id).get()
        return doc.to_dict() if doc.exists else None

    async def get_user_badges(self, user_id: str) -> list[dict[str, Any]]:
        """Get all badges for a user."""
        docs = self.db.collection("badges").where("user_id", "==", user_id).stream()
        return [doc.to_dict() for doc in docs]

    # RL Signals
    async def log_rl_signal(self, user_id: str, signal: dict[str, Any]) -> None:
        """Log RL signal for offline training."""
        self.db.collection("rl_signals").add({
            "user_id": user_id,
            **signal,
        })

    # Notes Intelligence
    async def save_note_analysis(self, note_data: dict[str, Any]) -> str:
        """Save note analysis to Firestore."""
        # Check if updating existing or creating new
        if "id" not in note_data:
            import uuid
            note_data["id"] = f"note_{uuid.uuid4().hex}"
        
        self.db.collection("user_notes").document(note_data["id"]).set(note_data, merge=True)
        return note_data["id"]

    async def get_user_notes(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """Get summary list of notes for a user."""
        # Query without ordering first to avoid index requirement
        docs = (
            self.db.collection("user_notes")
            .where("user_id", "==", user_id)
            .limit(limit)
            .stream()
        )
        
        notes = [doc.to_dict() for doc in docs]
        # Sort in memory
        notes.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return notes

    async def get_note(self, note_id: str) -> dict[str, Any] | None:
        """Get specific note details."""
        doc = self.db.collection("user_notes").document(note_id).get()
        return doc.to_dict() if doc.exists else None

    async def delete_note(self, note_id: str) -> bool:
        """Delete a note by ID."""
        try:
            self.db.collection("user_notes").document(note_id).delete()
            return True
        except Exception:
            return False


_client: FirebaseClient | None = None


def get_firebase_client() -> FirebaseClient:
    """Get or create the global Firebase client."""
    global _client
    if _client is None:
        _client = FirebaseClient()
    return _client
