
import os
import chromadb
import sys

def debug_db():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    chroma_dir = os.path.join(base_dir, "data", "chroma_db")
    
    print(f"Connecting to ChromaDB at {chroma_dir}...")
    try:
        client = chromadb.PersistentClient(path=chroma_dir)
        collection = client.get_collection("interview_questions")
    except Exception as e:
        print(f"Failed to connect or find collection: {e}")
        return

    count = collection.count()
    print(f"Total documents: {count}")
    
    if count > 0:
        print("Peeking at first 2 items:")
        peek = collection.peek(limit=2)
        print("IDs:", peek['ids'])
        print("Metadatas:", peek['metadatas'])
    else:
        print("Collection is empty.")

if __name__ == "__main__":
    debug_db()
