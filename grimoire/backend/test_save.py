import requests
import json

url = "http://localhost:8000/v1/agents/notes-intelligence/save"
payload = {
    "user_id": "test_user",
    "subject": "Test Subject",
    "goal": "exam_prep",
    "notes": "This is a test note with at least 50 characters to pass validation requirements.",
    "analysis_result": {"summary": "Test summary"},
    "mindmap_result": None
}

response = requests.post(url, json=payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
