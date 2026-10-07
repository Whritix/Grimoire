
import requests
import json
import sys

def verify_portfolio(user_id="user_36jolCOw9oUhBVIT0Yf002vddAH"):
    url = f"http://localhost:8000/v1/agents/portfolio/public/{user_id}"
    print(f"Testing URL: {url}")
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}") # Print full error if any
        
        if response.status_code == 200:
            data = response.json()
            # Verify critical structure
            if "stats" in data and "profile" in data:
                print("✅ Success: Data retrieved.")
                return True
            else:
                print("❌ Failure: Missing keys.")
                return False
        else:
            print(f"❌ API Request Failed.")
            return False
            
    except Exception as e:
        print(f"❌ Script Error: {e}")
        return False

if __name__ == "__main__":
    verify_portfolio()
