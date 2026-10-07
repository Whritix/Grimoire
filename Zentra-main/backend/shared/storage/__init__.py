"""Storage module exports."""
from shared.storage.firebase_client import FirebaseClient, get_firebase_client

__all__ = ["FirebaseClient", "get_firebase_client"]
