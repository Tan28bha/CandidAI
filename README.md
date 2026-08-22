# Multi-Agent AI Interview Platform

A production-grade platform for simulating realistic technical, DSA, system-design, and behavioral interviews using adaptive, stateful, multi-agent AI systems built with LangGraph, FastAPI, and Next.js.

## Tech Stack Overview

- **Frontend**: Next.js (App Router, Tailwind CSS, TypeScript, Shadcn UI)
- **Backend**: FastAPI, Pydantic, SQLAlchemy, Alembic, PostgreSQL (with pgvector), Redis
- **AI Engine**: LangGraph, LangChain, LLM Provider Abstraction (e.g. Gemini)

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) installed.

### Setup Instructions

1. **Environment Setup**:
   Clone or duplicate the `.env.example` file to create a local `.env`:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and add your custom API keys (e.g., `GEMINI_API_KEY`, if running LLM features locally).

2. **Start the Platform**:
   Use Docker Compose to build and launch all services:
   ```bash
   docker-compose up --build -d
   ```
   This will spin up four services:
   - **Database (`interview_db`)**: PostgreSQL with pgvector at `localhost:5432`
   - **Cache (`interview_redis`)**: Redis at `localhost:6379`
   - **Backend (`interview_backend`)**: FastAPI server at `http://localhost:8000`
   - **Frontend (`interview_frontend`)**: Next.js web application at `http://localhost:3000`

3. **Verify the Installation**:
   - Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Backend Health Endpoint: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
   - Next.js Web Landing: [http://localhost:3000](http://localhost:3000)

4. **Shutdown Services**:
   ```bash
   docker-compose down -v
   ```
