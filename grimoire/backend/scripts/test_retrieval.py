
import os
import chromadb
import random
import sys
import json

def test_retrieval(company, role, level):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    chroma_dir = os.path.join(base_dir, "data", "chroma_db")
    
    print(f"Connecting to ChromaDB at {chroma_dir}...")
    try:
        client = chromadb.PersistentClient(path=chroma_dir)
        collection = client.get_collection("interview_questions")
    except Exception as e:
        print(f"Failed to connect: {e}")
        return False

    print(f"1. Querying for: Company={company}")
    results_c = collection.get(where={"company": company})
    print(f"   Found {len(results_c['ids'])} results for company.")
    if len(results_c['ids']) > 0:
        print(f"   First meta: {results_c['metadatas'][0]}")

    print(f"2. Querying for: Role={role}")
    results_r = collection.get(where={"role": role})
    print(f"   Found {len(results_r['ids'])} results for role.")

    print(f"3. Querying for: Company={company} AND Role={role}")
    results = collection.get(
        where={
            "$and": [
                {"company": company},
                {"role": role}
            ]
        }
    )
    
    questions = []
    if results and results.get("metadatas"):
        for meta in results["metadatas"]:
            try:
                q_data = json.loads(meta["full_json"])
                questions.append(q_data)
            except:
                pass
                
    print(f"   Found {len(questions)} matching questions.")
    
    if questions:
        print("Sample question:", questions[0]["question"])
        return True
    else:
        print("No questions found!")
        return False

if __name__ == "__main__":
    print("--- Test Case 1: Google Software Engineer ---")
    success1 = test_retrieval("google", "software_engineer", "mid")
