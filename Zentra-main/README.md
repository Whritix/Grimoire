# GRIMOIRE

GRIMOIRE is an AI-powered learning platform with a Next.js frontend and a Python/FastAPI backend. The frontend is the main user experience layer: it handles onboarding, dashboards, roadmaps, lessons, assessments, chat, interview practice, notes, and public portfolios. The backend provides the API, AI orchestration, persistence, and long-running processing.

## Project Overview

This repository is split into three practical layers:

- `frontend/` for the web app and presentation UI
- `backend/` for FastAPI services, AI agents, and data processing
- `scripts/`, `start_all.ps1`, and `first_time_setup.ps1` for local setup and automation

## Frontend First

The frontend is built with TypeScript and React on Next.js App Router. It is responsible for the main product experience and for calling backend APIs through either direct requests or Next.js API proxy routes.

### Frontend Stack

| Part | Tech used | Why it is used |
| --- | --- | --- |
| App framework | Next.js 16 | Routing, server/client rendering, page structure |
| UI language | TypeScript | Type-safe UI and API code |
| View library | React 19 | Component-driven screens |
| Styling | Tailwind CSS 4 | Fast, utility-based styling |
| UI primitives | Radix UI | Accessible dialogs, menus, tabs, selects, and controls |
| Motion | Framer Motion, GSAP, Lenis | Smooth transitions and premium interaction feel |
| Icons | lucide-react | Consistent app iconography |
| Forms and validation | React Hook Form, Zod, @hookform/resolvers | Input handling and schema validation |
| Charts | Recharts | Dashboard analytics and progress visualization |
| Workflow visuals | React Flow | Roadmaps and node-based learning flows |
| Markdown and code rendering | react-markdown, remark-gfm, react-syntax-highlighter | Lessons, notes, and generated explanations |
| Notifications | sonner | Toast feedback and UX messaging |
| Auth | Clerk | Sign-in, sign-up, session handling, and user identity |
| PDF and document support | pdf-parse, pdfjs-dist, mammoth | Resume and document intake flows |

### Frontend Pages and Their Role

| Route / area | Purpose | Main tech pattern |
| --- | --- | --- |
| `app/(home)` | Marketing and landing experience | Next.js + motion UI |
| `app/dashboard` | Learning progress and analytics | Recharts + authenticated data fetches |
| `app/roadmap` | AI-generated study plan builder | React Flow + form state |
| `app/lesson` | Lesson viewer and study flow | Markdown rendering + backend content |
| `app/assessment` | Quiz and assessment UI | Forms, validation, scoring |
| `app/chat` | Doubt assistant conversation UI | Streaming fetch and Clerk auth |
| `app/interview` | Voice interview practice | Web Speech API + camera/audio APIs |
| `app/notes` | Notes intelligence workspace | Markdown/text processing |
| `app/space` | YouTube learning workspace | Video/content analysis pipeline |
| `app/profile`, `app/u/[userId]` | Public portfolio and profile view | Clerk + public API reads |
| `app/sign-in`, `app/sign-up` | Authentication entry points | Clerk components |
| `app/api/*` | Frontend proxy and helper routes | Next.js route handlers |

## Backend And API Pipeline

The frontend connects to the backend through a clear request pipeline:

1. The user interacts with a page in `frontend/app/`.
2. The page calls a Next.js route in `frontend/app/api/*` or sends a direct request to `NEXT_PUBLIC_API_URL`.
3. The FastAPI gateway in `backend/` receives the request and routes it to the right service.
4. Service modules in `backend/services/` handle planning, assessment, interview analysis, notes, retrieval, portfolio, progress, and more.
5. Data is stored or read from Firebase Firestore, ChromaDB, Redis, and related storage layers.

### Backend Stack

| Part | Tech used | Why it is used |
| --- | --- | --- |
| Core language | Python 3.11+ | Backend services and agent logic |
| API framework | FastAPI | HTTP endpoints and service orchestration |
| Server runtime | Uvicorn | Local and production ASGI serving |
| Data validation | Pydantic | Typed API contracts and schemas |
| Auth and security | python-jose, passlib, slowapi | Tokens, password support, and rate limiting |
| Persistence | Firebase Admin / Firestore | User data, roadmaps, progress, and content |
| Vector search | ChromaDB | Retrieval and assistant context |
| Cache | Redis / ioredis | Response caching and performance |
| Media and scraping | yt-dlp, requests, httpx | YouTube and external content ingestion |
| Observability | structlog, prometheus-client | Logs and metrics |
| LLM integration | google-generativeai and related model routing | Agent generation and reasoning workflows |

## Where The Tech Is Used

- Frontend UX, routing, and rendering are handled by Next.js, React, TypeScript, and Tailwind.
- Reusable controls and overlays use Radix UI, Sonner, and Clerk UI flows.
- Motion-heavy screens use Framer Motion, GSAP, and Lenis.
- Dashboards use Recharts.
- Roadmap and knowledge graph style views use React Flow.
- Lesson and note content uses Markdown rendering and syntax highlighting.
- Interview flows use browser media APIs and the Web Speech API.
- API calls, streaming chat, and profile sync use Next.js route handlers plus backend endpoints.
- Backend orchestration, AI agents, and storage live in Python/FastAPI services.
- Firestore stores persistent user and learning data.
- ChromaDB supports retrieval-style features.
- Redis supports fast cached responses.

## Development Setup

Run the full local setup from Windows with:

```powershell
.\first_time_setup.ps1
```

Or start the frontend and backend separately from their respective folders.

## Presentation Summary

GRIMOIRE is best described as a frontend-led learning platform backed by API-driven AI services. The frontend presents the product, manages user interaction, and visualizes learning progress, while the backend supplies intelligent agents, persistence, retrieval, and automated content generation.
