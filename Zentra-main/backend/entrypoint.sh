#!/bin/sh
# Entrypoint script to handle PORT variable
PORT="${PORT:-8000}"
echo "Starting application on port $PORT"
exec uvicorn services.gateway.main:app --host 0.0.0.0 --port "$PORT"
