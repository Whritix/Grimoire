from pathlib import Path
import sys
import os

# Add 'Teaching assistant' to python path so imports work
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "Teaching assistant"
sys.path.append(str(backend_dir))

# Import the FastAPI app
try:
    from services.gateway.main import app
except ImportError as e:
    # Debug response if import fails (logs will show on Vercel)
    from fastapi import FastAPI
    app = FastAPI()
    @app.get("/{path:path}")
    def error_handler(path: str):
        return {"error": "ImportError", "details": str(e), "path": str(backend_dir)}

# Vercel needs 'app' named variable exposed
