
import requests
import json
import sys

def verify_portfolio(user_id="test_user_verification"):
    url = f"http://localhost:8000/v1/agents/portfolio/public/{user_id}"
    print(f"Testing URL: {url}")
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response JSON keys: {list(data.keys())}")
            
            # Verify critical structure
            if "stats" in data and "profile" in data and "badges" in data:
                print("✅ Structure Validation Passed: 'stats', 'profile', and 'badges' are present.")
                print(f"Stats: {data['stats']}")
                return True
            else:
                print("❌ Structure Validation Failed: Missing required keys.")
                return False
        else:
            print(f"❌ API Request Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Script Error: {e}")
        return False

if __name__ == "__main__":
    success = verify_portfolio()
    sys.exit(0 if success else 1)
