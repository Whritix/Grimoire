
import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from shared.config import get_settings
from services.retriever.router import search_youtube

async def test_youtube():
    print("Testing YouTube API...")
    
    # Reload settings to pick up new env vars
    settings = get_settings()
    print(f"API Key configured: {'Yes' if settings.youtube_api_key else 'No'}")
    
    if not settings.youtube_api_key:
        print("ERROR: YouTube API key not found in settings!")
        return

    query = "Python tutorial for beginners"
    print(f"Searching for: '{query}'")
    
    results = await search_youtube(query, max_results=3)
    
    print(f"\nFound {len(results)} results:")
    for i, res in enumerate(results):
        print(f"Result {i+1}:")
        print(f"  ID: {res['id']}")
        print(f"  Title: {res['title']}")
        print(f"  URL: {res['url']}")
        
        if "yt_demo_" in res['id']:
            print("  [FAIL] This is a MOCK result.")
        else:
            print("  [PASS] This appears to be a REAL result.")

if __name__ == "__main__":
    asyncio.run(test_youtube())
