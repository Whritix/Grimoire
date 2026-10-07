
import json
import os
import chromadb
from chromadb.utils import embedding_functions

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "company_questions.json")
CHROMA_DB_DIR = os.path.join(BASE_DIR, "data", "chroma_db")

def seed_data():
    print(f"Loading data from {DATA_FILE}...")
    try:
        with open(DATA_FILE, "r") as f:
            questions = json.load(f)
    except FileNotFoundError:
        print(f"Error: Data file not found at {DATA_FILE}")
        return

    print(f"Found {len(questions)} questions.")

    # Initialize ChromaDB
    print(f"Initializing ChromaDB at {CHROMA_DB_DIR}...")
    client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    
    # Create or get collection
    collection_name = "interview_questions"
    
    # Reset collection if it exists
    try:
        client.delete_collection(name=collection_name)
        print(f"Deleted existing collection '{collection_name}'")
    except Exception as e:
        # Ignore if collection doesn't exist
        print(f"Collection delete skipped (probably didn't exist): {e}")

    # Use default embedding function
    # Note: If this fails due to model download issues, we might need a backup, 
    # but strictly following the prompt instructions to build embeddings.
    ef = embedding_functions.DefaultEmbeddingFunction()
    
    print(f"Creating collection '{collection_name}'...")
    collection = client.create_collection(name=collection_name, embedding_function=ef)

    ids = []
    documents = [] # This will be the text to embed (QUESTION ONLY)
    metadatas = []

    for i, q in enumerate(questions):
        # Unique ID: company_role_questionIndex
        # Sanitize ID
        q_id = f"{q['company']}_{q['role']}_{i}"
        
        ids.append(q_id)
        
        # Embed ONLY the question text
        documents.append(q["question"])
        
        # Metadata
        # Context and full_json might be too large or complex for simple metadata filtering,
        # but Chroma handles strings fine.
        # We store the core fields for filtering and the rest for retrieval.
        meta = {
            "company": q["company"],
            "role": q["role"],
            "experience": q["experience"],
            "difficulty": q["difficulty"],
            "category": q["category"],
            "context": q["context"],
            # Flattening full_json a bit or just storing keys can be safer, 
            # but string dump is robust for retrieval.
            "full_json": json.dumps(q) 
        }
        metadatas.append(meta)

    # Add in batches to avoid hitting any limits (though 180 is small)
    batch_size = 50
    print(f"Ingesting {len(documents)} documents into ChromaDB in batches...")
    
    for i in range(0, len(ids), batch_size):
        end = min(i + batch_size, len(ids))
        print(f"  Batch {i} to {end}...")
        collection.add(
            ids=ids[i:end],
            documents=documents[i:end],
            metadatas=metadatas[i:end]
        )
    
    print("Seeding complete.")
    count = collection.count()
    print(f"Collection count: {count}")
    
    if count == 0:
        print("WARNING: Collection is empty after seeding!")

if __name__ == "__main__":
    seed_data()
