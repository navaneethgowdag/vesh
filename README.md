# StyleSphere / AI Wardrobe

A modern, full-stack AI-powered personal wardrobe management and fashion social platform.

## Architecture

```text
React 18 + Vite Frontend
         │
         ▼
FastAPI REST API (Python 3.13)
    ├── Services & AI Modules
    ├── Cache Layer (Upstash Redis)
    ├── Rate Limiter (Redis Sorted Sets)
    └── Background Job Queue (RQ)
         │
         ├──► PostgreSQL Database (Neon) [Durable Source of Truth]
         └──► RQ Background Worker (`python -m app.worker`)
```

---

## Key Features

1. **AI Wardrobe & Personalization**:
   - Automated clothing image feature extraction (dominant colors, harmony analysis, category classification).
   - Smart daily outfit recommendations based on live weather and user feedback history.
   - Wardrobe calendar event planning with idempotency guarantees.

2. **Fashion Social Network**:
   - Feed with "For You" and "Following" filters.
   - Interactive swipeable Stories with avatar highlights.
   - Like, comment, post creation, and safe post deletion with cascading cleanup.

3. **Performance, Caching & Distributed Jobs (Upstash Redis)**:
   - Cache-aside layer for high-volume read endpoints (Weather forecast, Social stories, and User profile).
   - Distributed sliding-window rate limiting on login, registration, and AI analysis.
   - Asynchronous clothing analysis job coordination with RQ and fallback execution.
   - Full resilience: seamless fallback to PostgreSQL and direct execution when Redis is offline or disabled (`REDIS_ENABLED=false`).

---

## Quickstart Guide

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Neon DATABASE_URL and optional Upstash REDIS_URL

# Start API server
uvicorn app.main:app --reload --port 8000
```

### 2. Background Worker (Optional / Async Jobs)

```bash
cd backend
# Windows:
.\venv\Scripts\activate
python -m app.worker
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
```

---

## Upstash Redis Guide

For complete details on connecting Upstash Redis, TLS configuration, worker setup, cache TTLs, and rate limiting rules, see:
- [Upstash Redis Guide](backend/UPSTASH_REDIS_GUIDE.md)

---

## Verification & Testing

Run all backend tests:
```bash
cd backend
python -m pytest tests -v
```

Run frontend build check:
```bash
cd frontend
npm run build
```
