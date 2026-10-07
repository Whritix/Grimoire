import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("Error: GROQ_API_KEY not found in .env")
    exit(1)

url = "https://api.groq.com/openai/v1/models"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    models = response.json()
    
    print("Available Groq Models:")
    for model in models['data']:
        print(f"- {model['id']}")
        
except Exception as e:
    print(f"Error fetching models: {e}")
    if 'response' in locals():
        print(response.text)
