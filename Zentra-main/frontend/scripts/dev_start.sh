#!/bin/bash

# Development startup script for learning platform backend
# This script sets up the development environment and starts the Next.js dev server

set -e

echo "🚀 Starting Learning Platform Backend Development Environment"
echo ""

# Check if .env.local exists, otherwise copy from .env.example
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "✅ .env.local created. Please update it with your configuration if needed."
  echo ""
fi

# Load environment variables
if [ -f .env.local ]; then
  echo "📦 Loading environment variables from .env.local..."
  export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f ../.env ]; then
  echo "📦 Loading environment variables from root .env..."
  export $(cat ../.env | grep -v '^#' | xargs)
fi

# Check if Docker is installed
if command -v docker &> /dev/null; then
  echo "🐳 Docker detected. Starting Redis..."
  
  # Start Redis using docker-compose
  if [ -f infra/docker-compose.yml ]; then
    cd infra
    docker-compose up -d redis
    cd ..
    echo "✅ Redis started successfully"
  else
    echo "⚠️  docker-compose.yml not found in infra/ directory"
  fi
  echo ""
else
  echo "⚠️  Docker not installed. Skipping Redis setup."
  echo "   Backend will use in-memory cache instead."
  echo ""
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies..."
  pnpm install
  echo ""
fi

# Start the development server
echo "🎯 Starting Next.js development server..."
echo "   Backend API will be available at http://localhost:3000/api"
echo "   Mock mode: $USE_MOCK"
echo ""

pnpm dev
