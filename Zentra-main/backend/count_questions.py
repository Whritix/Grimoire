import json
import os
import sys

# Add the project root to sys.path to resolve imports
project_root = r"e:\zentra"
sys.path.insert(0, project_root)

# Mocking necessary parts for standalone execution if needed, but imports should work if path is correct
from backend.services.interview.router import get_chroma_collection

def count_questions():
    json_path = r"e:\zentra\backend\data\company_questions.json"
    json_count = 0
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                json_count = len(data)
                print(f"JSON File Count: {json_count}")
        except Exception as e:
            print(f"Error reading JSON: {e}")
    else:
        print("JSON file not found.")

    chroma_count = 0
    try:
        collection = get_chroma_collection()
        if collection:
            chroma_count = collection.count()
            print(f"Chroma DB Count: {chroma_count}")
        else:
            print("Chroma Collection not found.")
    except Exception as e:
        print(f"Error reading Chroma: {e}")
        
    print(f"TOTAL DETECTED: {json_count + chroma_count} (Note: JSON and Chroma might overlap if seeded, but currently they are likely distinct sources or copies)")

if __name__ == "__main__":
    count_questions()
