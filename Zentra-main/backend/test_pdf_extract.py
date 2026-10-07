import requests
import os

url = "http://127.0.0.1:8000/v1/agents/extract-pdf"
file_path = "AI_Engineer_Resume.pdf"

if not os.path.exists(file_path):
    print(f"File {file_path} not found.")
    exit(1)

with open(file_path, "rb") as f:
    files = {"file": f}
    try:
        response = requests.post(url, files=files)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            # Print first 200 chars of text to verify
            print("Response Text (first 200 chars):", response.json().get("text", "")[:200])
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Request failed: {e}")
