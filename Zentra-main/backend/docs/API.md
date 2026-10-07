# 📚 API Documentation

Base URL: `http://localhost:8000/v1`

## 🔐 Authentication
All endpoints require a Bearer token.
Header: `Authorization: Bearer <your-api-key>`

**How to get an API Key:**
- **Development**: You can use any non-empty string as a key (e.g., `Bearer test-key`).
- **Production**: Keys are validated against the `api_key_secret` set in your `.env` file (default: `development_secret_key_change_in_prod`).

---

## 🤖 Agent Endpoints

### 1. Planner Agent
**Endpoint**: `/agents/planner`
**Method**: `POST`
**Description**: Generates personalized learning roadmaps or schedules.

**Request Body**:
```json
{
  "model": "planner-v1",
  "messages": [{"role": "user", "content": "Learn Python"}],
  "user_goal": "Learn Python",
  "availability_hours_per_week": 10,
  "time_horizon_weeks": 4,
  "plan_type": "curriculum" // or "schedule"
}
```

### 2. Retriever Agent
**Endpoint**: `/agents/retriever`
**Method**: `POST`
**Description**: Fetches external resources (YouTube, Web).

**Request Body**:
```json
{
  "query": "Python tutorials",
  "max_results": 5,
  "include_transcripts": false
}
```

### 3. Doubt Assistant (RAG)
**Endpoint**: `/agents/doubt-assistant`
**Method**: `POST`
**Description**: QA System with Retrieval Augmented Generation.

**Request Body**:
```json
{
  "messages": [{"role": "user", "content": "What is a variable?"}],
  "documents": [], // Optional context docs
  "use_general_knowledge": true
}
```

### 4. Composer Agent
**Endpoint**: `/agents/composer`
**Method**: `POST`
**Description**: Synthesizes structured lessons from multiple documents.

**Request Body**:
```json
{
  "topic": "Python Basics",
  "documents": [{"id": "1", "text": "..."}],
  "difficulty": "intermediate"
}
```

### 5. Assessment Agent
**Endpoint**: `/agents/assessment`
**Method**: `POST`
**Description**: Generates quizzes, flashcards, or grades answers.

**Request Body (Quiz)**:
```json
{
  "mode": "generate",
  "lesson_content": "Python Basics...",
  "question_count": 5
}
```

**Request Body (Flashcards)**:
```json
{
  "mode": "flashcards",
  "lesson_content": "Python Basics...",
  "question_count": 10
}
```

### 6. Badge Service
**Endpoint**: `/agents/badge`
**Method**: `POST`
**Description**: Issues verifiable badges with cryptographic signatures.

**Request Body**:
```json
{
  "user_id": "user123",
  "badge_name": "Python Master",
  "evidence": [{"type": "assessment", "id": "quiz1", "score": 0.9}]
}
```

**Verify Endpoint**: `/agents/badges/verify/{badge_id}`
**Method**: `GET`
**Description**: Public verification of a badge ID.

### 7. Summarize Agent
**Endpoint**: `/agents/summarize`
**Method**: `POST`
**Description**: Fast, local-LLM optimized text summarization.

**Request Body**:
```json
{
  "text": "Long text content...",
  "max_length": 150,
  "style": "concise"
}
```

### 8. RL Controller
**Endpoint**: `/agents/rl-controller`
**Method**: `POST`
**Description**: Adaptive difficulty decision engine.

**Request Body**:
```json
{
  "signals": {
    "recent_quiz_scores": [0.8, 0.9],
    "hints_used": 1
  },
  "current_difficulty": "intermediate"
}
```

---

## 👤 User & Progress Endpoints

### User Profile & Activity
- **GET** `/user/profile/{user_id}`: Get user preferences and stats.
- **POST** `/user/profile`: Update user profile.
- **GET** `/user/activity/{user_id}`: Get recent activity log.
- **GET** `/user/context/{user_id}`: Get aggregated personalization context.

### Progress Tracking
- **POST** `/agents/progress/update`: specific progress update (lesson/quiz).
- **POST** `/agents/progress/flashcards/review`: Review a flashcard (Spaced Repetition).
- **GET** `/agents/progress/{user_id}`: Get comprehensive user progress.

### Plan Management
- **POST** `/plans/save`: Save a generated roadmap.
- **GET** `/plans/{user_id}`: List saved plans.
- **GET** `/plans/{user_id}/{plan_id}`: Get plan details.
- **POST** `/plans/progress`: Mark plan items as complete.
- **DELETE** `/plans/{user_id}/{plan_id}`: Delete a plan.

### Recommendations
- **GET** `/recommendations/{user_id}`: Get personalized content suggestions.
- **GET** `/study-session/{user_id}`: Generate a dynamic study session.
- **GET** `/daily-plan/{user_id}`: Get a generated daily todo list.

---

## 🛠️ System Endpoints

### Health & Metrics
- **GET** `/agents/health`: System health status (Gemini, Firebase, Redis).
- **GET** `/agents/metrics`: Prometheus metrics.
- **GET** `/usage`: Token usage and rate limits.

### Functions (Tools)
- **POST** `/functions/execute`: Execute server-side tools (transcript extraction, etc.).
- **GET** `/functions/available`: List available tools.

### WebSockets
- **WS** `/ws/doubt-assistant`: Real-time chat connection.
