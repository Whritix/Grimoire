"""
Vector Storage Module - Handles semantic memory using ChromaDB.
"""

import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb import Documents, EmbeddingFunction, Embeddings
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from shared.utils import get_logger

logger = get_logger(__name__)

# Basic embedding function using sentence-transformers if available, or a simple fallback
# For now, we'll try to use the default all-MiniLM-L6-v2 which Chroma downloads automatically.
# If that fails in some environments, we might need a custom one.

class VectorStore:
    def __init__(self, collection_name: str = "user_memory"):
        self.data_dir = Path(os.getcwd()) / "data" / "chroma_db"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            self.client = chromadb.PersistentClient(path=str(self.data_dir))
            
            # Create or get collection
            self.collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info(f"VectorStore initialized at {self.data_dir}")
        except Exception as e:
            logger.error("Failed to initialize VectorStore", error=str(e))
            self.client = None
            self.collection = None

    def add_memory(self, user_id: str, text: str, metadata: Dict[str, Any] = None) -> bool:
        """Add a memory to the vector store."""
        if not self.collection:
            return False

        try:
            if metadata is None:
                metadata = {}
            
            # Ensure metadata values are primitives supported by Chroma
            clean_metadata = {
                "user_id": user_id,
                "timestamp": datetime.now().isoformat(),
                "type": metadata.get("type", "general"),
            }
            
            # Add extra metadata recursively if needed, but for now flatten important bits
            if "topic" in metadata: clean_metadata["topic"] = str(metadata["topic"])
            if "score" in metadata: clean_metadata["score"] = float(metadata["score"])
            
            self.collection.add(
                documents=[text],
                metadatas=[clean_metadata],
                ids=[f"{user_id}_{datetime.now().timestamp()}_{os.urandom(4).hex()}"]
            )
            return True
        except Exception as e:
            logger.error("Failed to add memory", error=str(e))
            return False

    def search_memories(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for relevant memories for a user."""
        if not self.collection:
            return []

        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=limit,
                where={"user_id": user_id}
            )
            
            memories = []
            if results["documents"]:
                for i, doc in enumerate(results["documents"][0]):
                    meta = results["metadatas"][0][i]
                    memories.append({
                        "text": doc,
                        "metadata": meta,
                        "distance": results["distances"][0][i] if "distances" in results else 0
                    })
            
            return memories
        except Exception as e:
            logger.error("Failed to search memories", error=str(e))
            return []

# Singleton
_vector_store = VectorStore()

def get_vector_store() -> VectorStore:
    return _vector_store
