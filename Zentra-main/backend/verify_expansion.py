import sys
import os

# Add the project root to sys.path to resolve imports
project_root = r"e:\zentra"
sys.path.insert(0, project_root)

# Mocking necessary parts for standalone execution if needed, but imports should work if path is correct
from backend.services.interview.companies import get_all_companies
from backend.services.interview.router import get_interviewer_prompt, get_chroma_collection

def verify_companies():
    print("Verifying Companies...")
    companies = get_all_companies()
    company_ids = [c["id"] for c in companies]
    
    expected_new = ["tcs", "goldman_sachs"]
    all_present = all(c in company_ids for c in expected_new)
    
    if all_present:
        print(f"SUCCESS: Found {expected_new} in {company_ids}")
    else:
        print(f"FAILURE: Missing {expected_new} in {company_ids}")
        
    # Check roles for TCS
    tcs = next((c for c in companies if c["id"] == "tcs"), None)
    if tcs:
        roles = [r["id"] for r in tcs["roles"]]
        print(f"TCS Roles: {roles}")
        if "digital_innovator" in roles:
             print("SUCCESS: Found 'digital_innovator' in TCS roles")
        else:
             print("FAILURE: Missing 'digital_innovator' in TCS roles")

def verify_chroma_init():
    print("\nVerifying Chroma DB Init...")
    try:
        collection = get_chroma_collection()
        if collection:
            print(f"SUCCESS: Chroma Collection retrieved: {collection.name}")
        else:
            print("FAILURE: Chroma Collection is None")
    except Exception as e:
        print(f"FAILURE: Chroma Init raised exception: {e}")

if __name__ == "__main__":
    verify_companies()
    verify_chroma_init()
