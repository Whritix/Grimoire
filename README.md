# GRIMOIRE - Autonomous AI Career Platform

[![AI Manthan 2.0](https://img.shields.io/badge/Competition-AI%20Manthan%202.0-blue.svg)](https://github.com/Whritix/Grimoire)
[![Team](https://img.shields.io/badge/Team-BotS-indigo.svg)](https://github.com/Whritix/Grimoire)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Learn. Interview. Get Hired.**  
> An autonomous, multimodal AI platform that bridges the gap between learning and getting hired—diagnosing skill gaps, generating adaptive roadmaps, conducting real-time voice and vision mock interviews, and issuing cryptographic proof-of-skill badges.

---

## 🚀 Key Modules

1. **Diagnostic Assessment (Planner Agent)**
   - Smart baseline testing identifying individual student skill gaps.
   - Evaluates prerequisites and dynamically builds customized study tracks.

2. **Adaptive Learning Roadmap**
   - Week-by-week personalized learning curriculum.
   - Automatically adapts module pacing if student checkpoint scores drop.
   - Dynamic search permutations with link verification preventing dead resources.

3. **Contextual Multi-Modal Doubt Assistant**
   - Real-time Q&A via WebSockets and RAG (`ChromaDB`).
   - Supports audio explanations and code snippet debugging.

4. **Real-time Multimodal Mock Interview (Interview Agent)**
   - **Voice:** Bi-directional low-latency speech interaction (Web Speech API STT/TTS).
   - **Vision:** Real-time posture tracking, eye-contact ratio, and engagement scoring via `MediaPipe` and `OpenCV`.
   - **Code:** Live in-browser coding playground (`Monaco`) with test cases and AST analysis.
   - **AI Interviewer:** Persona-driven technical interviewer simulating real company standards (e.g. Amazon, TCS, Goldman Sachs).

5. **Verifiable Cryptographic Credentials**
   - Ed25519-signed, tamper-proof digital certificates and badges.
   - Verifiable public proof-of-work replacing keyword-stuffed resumes.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, Framer Motion |
| **Backend** | Python 3.13, FastAPI, Uvicorn, WebSockets |
| **AI / LLMs** | Groq (Llama 3 70B/8B), Google Gemini 1.5, Ollama fallback |
| **Computer Vision & Audio** | Google MediaPipe, OpenCV, Web Speech API (Client-Side STT/TTS) |
| **Data & Storage** | ChromaDB (Vector Search), Redis (Session Cache), Firebase Firestore, PostgreSQL / Neon |
| **Security** | Ed25519 asymmetric cryptographic signing, JWT |

---

## 📂 Project Structure

```
.
├── grimoire/                      # Main application codebase
│   ├── backend/                   # FastAPI microservices gateway & agents
│   │   ├── services/              # Agent implementations (interview, planner, doubt, etc.)
│   │   ├── core/                  # Configuration, LLM router & settings
│   │   └── data/                  # Company questions & schemas
│   ├── frontend/                  # Next.js 16 web application
│   │   ├── app/                   # App Router pages (interview, roadmap, etc.)
│   │   ├── components/            # UI & modular interview components
│   │   └── lib/                   # Client-side hooks, state machine & mocks
│   └── scripts/                   # Database seed and verification utilities
├── BotS_GRIMOIRE.pdf              # Official AI Manthan 2.0 submission PDF
├── BotS_GRIMOIRE.pptx             # Official AI Manthan 2.0 submission PPTX
├── start_all.ps1                  # Single-command startup script
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+ and `pnpm`
- Python 3.11+
- Git

### 1. Configure Environment
```bash
cd grimoire
cp .env.example .env
# Edit .env with your GROQ_API_KEY and other credentials
```

### 2. Launch All Services
Run the automated launch script from PowerShell:
```powershell
.\start_all.ps1
```
Or start manually:
```bash
# Terminal 1 - Backend
cd grimoire/backend
python -m uvicorn services.gateway.main:app --reload --port 8000

# Terminal 2 - Frontend
cd grimoire/frontend
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏆 Competition Details
- **Event:** AI Manthan 2.0
- **Team Name:** BotS
- **Team Leader:** Aditya Bajantri
- **Institution:** Acropolis Institute of Technology and Research, Indore
- **Department:** Information Technology

---

## 📄 License
MIT License. Copyright (c) 2025 Grimoire.
