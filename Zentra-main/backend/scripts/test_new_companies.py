
import os
import chromadb
import random
import sys
import json

def test_retrieval(company, role):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    chroma_dir = os.path.join(base_dir, "data", "chroma_db")
    
    try:
        client = chromadb.PersistentClient(path=chroma_dir)
        collection = client.get_collection("interview_questions")
    except Exception as e:
        print(f"Failed to connect: {e}")
        return False

    print(f"Querying for: Company={company} AND Role={role}")
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
                
    print(f"Found {len(questions)} matching questions.")
    
    if questions:
        print("Sample question:", questions[0]["question"])
        return True
    else:
        print("No questions found!")
        return False

if __name__ == "__main__":
    print("--- Test Case: Infosys Software Engineer ---")
    success1 = test_retrieval("infosys", "software_engineer")
    
    print("\n--- Test Case: Goldman Sachs Technology Analyst ---")
    success2 = test_retrieval("goldmansachs", "technology_analyst")
    
    if success1 and success2:
        print("\nSUCCESS: Verification Passed")
    else:
        print("\nFAILURE: Verification Failed")
