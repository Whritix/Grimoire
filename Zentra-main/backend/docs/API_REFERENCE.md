# AI Agents API Documentation

Complete reference for all API endpoints with request/response examples.

---

## Base URL

```
http://localhost:8000/v1/agents
```

## Authentication

All endpoints require Bearer token authentication:
```
Authorization: Bearer your-api-key
```

---

## 1. Planner Agent

**Endpoint:** `POST /v1/agents/planner`

**Purpose:** Generate personalized learning roadmaps based on user goals, diagnostic results, and time availability.

### Request

```json
{
  "model": "planner-v1",
  "messages": [
    {"role": "user", "content": "Goal: Learn Python programming"}
  ],
  "plan_type": "curriculum",
  "diagnostic_results": {
    "python_basics": 0.2,
    "data_structures": 0.1,
    "algorithms": 0.0
  },
  "user_goal": "Python Developer",
  "availability_hours_per_week": 10,
  "time_horizon_weeks": 12,
  "temperature": 0.1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | array | ✅ | Chat messages with role and content |
| `plan_type` | string | ❌ | "curriculum" (default) or "schedule" |
| `diagnostic_results` | object | ❌ | Skill scores (0-1) from initial assessment |
| `user_goal` | string | ❌ | Target role or skill |
| `availability_hours_per_week` | int | ❌ | Weekly study hours |
| `time_horizon_weeks` | int | ❌ | Total weeks available |
| `temperature` | float | ❌ | AI creativity (0.0-1.0, default 0.1) |

### Response (Curriculum Mode)

```json
{
  "id": "resp_abc123",
  "model": "planner-v1",
  "agent_output": {
    "type": "roadmap",
    "payload": {
      "goal": "Python Developer",
      "estimated_weeks": 12,
      "total_hours": 120,
      "modules": [
        {
          "id": "mod_001",
          "title": "Python Fundamentals",
          "estimated_hours": 20,
          "outcomes": ["Write basic Python programs", "Understand syntax"],
          "prerequisites": [],
          "difficulty": "beginner"
        }
      ],
      "checkpoints": [
        {"week": 4, "criteria": "Complete Python basics quiz", "assessment_type": "quiz"}
      ]
    },
    "confidence": 0.9
  },
  "choices": [
    {"message": {"content": "12-week roadmap with 6 modules created."}}
  ]
}
```

### Response (Schedule Mode)

```json
{
  "agent_output": {
    "type": "schedule",
    "payload": {
      "schedule": [
        {
          "day": 1,
          "topic": "Intro to Python",
          "activities": ["Read Chapter 1", "Install Python"],
          "time_minutes": 60
        }
      ],
      "summary": "Week 1 schedule created."
    }
  }
}
```

---

## 2. Retriever Agent

**Endpoint:** `POST /v1/agents/retriever`

**Purpose:** Search and fetch relevant learning resources from YouTube and web.

### Request

```json
{
  "model": "retriever-v1",
  "query": "Python loops tutorial for beginners",
  "filters": {
    "type": "video",
    "language": "en"
  },
  "max_results": 10,
  "include_transcripts": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | ✅ | Search query |
| `filters` | object | ❌ | Filter by type, language, recency |
| `max_results` | int | ❌ | Max resources to return (default 10) |
| `include_transcripts` | bool | ❌ | Fetch YouTube transcripts |

### Response

```json
{
  "agent_output": {
    "type": "documents",
    "payload": {
      "documents": [
        {
          "id": "yt_abc123",
          "title": "Python Loops Tutorial",
          "url": "https://youtube.com/watch?v=abc123",
          "snippet": "Learn about for loops and while loops...",
          "source_type": "youtube",
          "credibility_score": 0.85,
          "transcript": "..."
        }
      ],
      "query": "Python loops tutorial",
      "total_found": 5
    },
    "confidence": 0.85
  }
}
```

---

## 3. Composer Agent

**Endpoint:** `POST /v1/agents/composer`

**Purpose:** Synthesize structured lessons from retrieved documents.

### Request

```json
{
  "model": "composer-v1",
  "topic": "Python For Loops",
  "documents": [
    {
      "id": "yt_abc123",
      "title": "Python Loops Tutorial",
      "text": "A for loop iterates over a sequence...",
      "url": "https://youtube.com/watch?v=abc123"
    }
  ],
  "difficulty": "beginner",
  "temperature": 0.3
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | ✅ | Lesson topic |
| `documents` | array | ✅ | Source documents with id, text, url |
| `difficulty` | string | ❌ | beginner/intermediate/advanced |

### Response
 
 ```json
 {
   "agent_output": {
     "type": "lesson",
     "payload": {
       "id": "lesson_001",
       "title": "Mastering Python For Loops",
       "objectives": ["Understand loop syntax", "Iterate over lists"],
       "items": [
         {
           "type": "video", 
           "title": "Watch: Loops Explained", 
           "source_id": "yt_abc123",
           "description": "Video tutorial on loops",
           "content": "Detailed markdown content of the video summary or transcript..."
         }
       ],
       "notes": {
         "summary": "For loops iterate over sequences...",
         "bullets": ["Use for x in list: syntax", "range() generates numbers"]
       },
       "quiz_seed": [
         {"id": "q1", "q": "What does range(5) return?", "type": "mcq"}
       ]
     },
     "sources": [{"id": "yt_abc123", "url": "..."}],
     "confidence": 0.88
   }
 }
 ```
 
 ---
 
 ## 4. Assessment Agent
 
 **Endpoint:** `POST /v1/agents/assessment`
 
 **Purpose:** Generate quiz questions, flashcards, or grade student answers.
 
 ### Generate Mode Request
 
 ```json
 {
   "mode": "generate",
   "lesson_content": "Python for loops iterate over sequences using...",
   "question_count": 5,
   "difficulty_distribution": {"easy": 2, "medium": 2, "hard": 1}
 }
 ```
 
 | Field | Type | Required | Description |
 |-------|------|----------|-------------|
 | `mode` | string | ✅ | "generate", "flashcards", or "grade" |
 | `lesson_content` | string | ✅ | Content to base quiz on |
 | `question_count` | int | ❌ | Number of questions (default 5) |
 | `difficulty_distribution` | object | ❌ | {"easy": n, "medium": n, "hard": n} |
 
 ### Generate Mode Response
 
 ```json
 {
   "agent_output": {
     "type": "quiz",
     "payload": {
       "questions": [
         {
           "id": "q1",
           "q": "Which keyword starts a for loop in Python?",
           "type": "mcq",
           "choices": ["for", "loop", "iterate", "each"],
           "correct_answer": "for",
           "difficulty": "easy",
           "rationale": "The 'for' keyword initializes the loop."
         }
       ],
       "total_points": 5
     }
   }
 }
 ```

 ### Flashcards Mode Request

 ```json
 {
   "mode": "flashcards",
   "lesson_content": "Python lists are mutable...",
   "question_count": 5
 }
 ```

 ### Flashcards Mode Response

 ```json
 {
   "agent_output": {
     "type": "flashcards",
     "payload": {
       "flashcards": [
         {"front": "What is a list?", "back": "A mutable sequence..."}
       ]
     }
   }
 }
 ```
 
 ### Grade Mode Request
 
 ```json
 {
   "mode": "grade",
   "question_id": "q1",
   "question_text": "Explain what a for loop does.",
   "user_answer": "A for loop repeats code for each item in a list.",
   "rubric": {"completeness": 2, "accuracy": 2, "clarity": 1}
 }
 ```
 
 ### Grade Mode Response
 
 ```json
 {
   "agent_output": {
     "type": "grading_result",
     "payload": {
       "question_id": "q1",
       "score": 0.85,
       "feedback": "Good explanation! Consider mentioning iterables beyond lists.",
       "confidence": 0.9,
       "suggested_topics": ["Python iterables", "Generator functions"]
     }
   }
 }
 ```
 
 ---
 
 ## 5. Doubt Assistant (RAG)
 
 **Endpoint:** `POST /v1/agents/doubt-assistant` (`/ws/doubt-assistant` for WebSocket)
 
 **Purpose:** Answer learner questions. Uses RAG when documents provided, General Knowledge otherwise.
 
 ### Live Chat (WebSocket)
 
 Connect to `/ws/doubt-assistant`.
 
 **Features:**
 - **High Token Limit**: Supports up to 8192 output tokens.
 - **Markdown Formatting**: Responses in rich Markdown with code blocks.
 - **Streaming**: Real-time token streaming.
 
 ### REST Request
 
 ```json
 {
   "model": "doubt-v1",
   "messages": [
     {"role": "user", "content": "What's the difference between a list and tuple?"}
   ],
   "documents": [
     {"id": "doc1", "text": "Lists are mutable, tuples are immutable..."}
   ],
   "current_lesson": {"id": "lesson_001", "title": "Python Data Structures"},
   "use_general_knowledge": true
 }
 ```
 
 ### Response
 
 ```json
 {
   "agent_output": {
     "type": "doubt_response",
     "payload": {
       "answer": "**Lists** are mutable (can be changed), while **tuples** are immutable...",
       "citations": [
         {"id": "doc1", "span": "Lists are mutable, tuples are immutable"}
       ],
       "confidence": 0.92,
       "mode": "rag"
     }
   }
 }
 ```

---

## 6. RL Controller

**Endpoint:** `POST /v1/agents/rl-controller`

**Purpose:** Decide whether to adjust content difficulty based on performance signals.

### Request

```json
{
  "signals": {
    "recent_quiz_scores": [0.8, 0.9, 0.85],
    "hints_used": 1,
    "time_spent_minutes": 45,
    "streak_days": 5
  },
  "current_difficulty": "intermediate"
}
```

### Response

```json
{
  "agent_output": {
    "type": "rl_decision",
    "payload": {
      "action": "harder",
      "confidence": 0.85,
      "reason": "Strong performance (avg 85%) with minimal hints.",
      "suggested_adjustments": ["Introduce advanced topics"]
    }
  }
}
```

---

## 7. Badge Service

**Endpoint:** `POST /v1/agents/badge`

**Purpose:** Issue verifiable achievement badges.

### Request

```json
{
  "user_id": "user_123",
  "roadmap_id": "roadmap_456",
  "badge_name": "Python Fundamentals",
  "evidence": [
    {"type": "assessment", "id": "quiz_1", "score": 0.9},
    {"type": "lesson_completion", "id": "lesson_1"}
  ]
}
```

### Response

```json
{
  "agent_output": {
    "type": "badge",
    "payload": {
      "badge_id": "badge_abc123",
      "status": "issued",
      "signed_claim": "badge_abc123:user_123:2:...:signature",
      "verify_url": "/v1/badges/verify/badge_abc123",
      "metadata": {"name": "Python Fundamentals"}
    }
  }
}
```

---

## 8. Summarize Agent

**Endpoint:** `POST /v1/agents/summarize`

**Purpose:** Fast text summarization for preprocessing or quick overviews.

### Request

```json
{
  "text": "Python is a high-level, interpreted programming language...",
  "max_length": 100,
  "style": "bullets"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | ✅ | Text to summarize |
| `max_length` | int | ❌ | Target word count (default 150) |
| `style` | string | ❌ | concise/detailed/bullets |

### Response

```json
{
  "agent_output": {
    "type": "summary",
    "payload": {
      "summary": "Python is a versatile programming language...",
      "bullets": [
        "High-level interpreted language",
        "Easy to learn syntax",
        "Large standard library"
      ],
      "word_count": 45
    }
  }
}
```

---

## 9. Health Check

**Endpoint:** `GET /v1/agents/health`

**Purpose:** Check system status and service availability.

### Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "gemini": "connected",
    "local_llm": "disabled",
    "firebase": "configured"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable message",
    "type": "error_type"
  }
}
```

| Code | HTTP | Description |
|------|------|-------------|
| `401` | 401 | Invalid or missing API key |
| `429` | 429 | Rate limit exceeded |
| `schema_validation_failed` | 400 | Response didn't match schema |
| `internal_error` | 500 | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/planner`, `/composer` | 10 req/min |
| All others | 60 req/min |

Rate limit exceeded responses include `Retry-After` header.
