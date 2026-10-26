# StyleSphere: Upstash Redis Architecture, Operations & Deployment Guide

This document describes the design, configuration, local workflow, cloud deployment, and operational procedures for the Redis integration within **StyleSphere / AI Wardrobe**.

---

## 1. Architectural Principles

1. **PostgreSQL as the Durable Source of Truth**:
   - Neon PostgreSQL stores all permanent application entities (users, clothes, outfits, calendar events, posts, likes, notifications, and background job records).
   - Redis **never** replaces PostgreSQL. Redis is strictly used for transient speed, distributed coordination, and temporary state.

2. **Upstash Redis Responsibilities**:
   - **Selective Caching**: Cache-aside for expensive read operations (Weather forecast, Social stories, and User profile).
   - **Distributed Rate Limiting**: Sliding-window rate limiting on sensitive and resource-heavy endpoints (`/auth/login`, `/auth/register`, `/clothing-ai/analyze`).
   - **Background Job Coordination**: Redis Queue (RQ) distributes asynchronous clothing-image processing jobs to dedicated worker processes.

3. **Resilience & Zero Fatal Crashes**:
   - If Redis is unreachable, misconfigured, or disabled via `REDIS_ENABLED=false`:
     - Cache queries gracefully fall back to direct PostgreSQL / upstream requests.
     - Rate limiters fail open with warning logs.
     - Job submissions execute synchronously or log non-fatal warnings.
     - The FastAPI application remains fully functional and responsive.

---

## 2. Environment Variables & Configuration

All Redis settings are loaded through `app.core.config.Settings` and defined in `.env`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `REDIS_ENABLED` | boolean | `false` | Set to `true` to enable caching, rate limiting, and RQ queuing. |
| `REDIS_URL` | string | `""` | Connection URL. Must start with `redis://` or `rediss://`. |
| `REDIS_CONNECT_TIMEOUT` | float | `2.0` | Connection timeout in seconds to prevent blocking API threads. |
| `REDIS_SOCKET_TIMEOUT` | float | `2.0` | Read/write socket timeout in seconds. |
| `REDIS_MAX_CONNECTIONS` | integer | `20` | Maximum connections in the Redis connection pool. |
| `REDIS_RETRY_ON_TIMEOUT` | boolean | `true` | Whether to automatically retry once on socket timeout. |

### Upstash Cloud Requirement (TLS)
Production environments connecting to Upstash **must** use TLS (`rediss://` scheme). The application's `validate_redis_settings()` validator automatically enforces this in production.

Example `.env` for Upstash Cloud:
```env
REDIS_ENABLED=true
REDIS_URL=rediss://default:your-upstash-password@your-endpoint.upstash.io:6379
REDIS_CONNECT_TIMEOUT=2.0
REDIS_SOCKET_TIMEOUT=2.0
REDIS_MAX_CONNECTIONS=20
REDIS_RETRY_ON_TIMEOUT=true
```

---

## 3. Upstash Cloud Setup

1. **Create an Upstash Redis Database**:
   - Log in to the [Upstash Console](https://console.upstash.com/).
   - Click **Create Database**.
   - Choose a database name (e.g., `stylesphere-redis`) and select the region closest to your Neon PostgreSQL database and API servers.
   - Choose **Serverless** mode with TLS enabled.

2. **Retrieve Connection Credentials**:
   - On the database overview page, locate the **Connect** tab.
   - Choose **redis-py** or **ioredis** and copy the `rediss://` connection URL:
     ```text
     rediss://default:<UPSTASH_PASSWORD>@<UPSTASH_ENDPOINT>:6379
     ```

3. **Configure Your Cloud Hosting (Render / Railway / Fly / AWS)**:
   - Add the environment variables `REDIS_ENABLED=true` and `REDIS_URL=rediss://...` to your hosting environment settings.
   - Do **NOT** expose this URL to the frontend Vite client. Only backend workers and FastAPI instances access Redis.

---

## 4. Background Worker (`app.worker`)

Background jobs for clothing image AI analysis are processed asynchronously through RQ.

### Cross-Platform Worker Support
- **Windows (Local Development)**: Uses `rq.SimpleWorker`, which executes tasks in the main thread without calling `os.fork()`.
- **Linux (Cloud / Docker / Production)**: Uses standard `rq.Worker` with process isolation and signal handling (`SIGINT`, `SIGTERM`).

### Starting the Worker
Activate your Python virtual environment and run the worker module:

```bash
# From the backend directory:
python -m app.worker
```

### Production Process Supervision

#### Render (Background Worker Service)
Create a new **Background Worker** on Render:
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python -m app.worker`
- **Environment Variables**: Same `DATABASE_URL` and `REDIS_URL` as web service.

#### Docker / Compose
```dockerfile
# Dockerfile.worker
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-m", "app.worker"]
```

---

## 5. Database Schema & Migration for Background Jobs

The durable job tracking table is defined in `backend/app/models/background_job.py` and managed by Alembic.

### Applying via Alembic
```bash
cd backend
alembic upgrade head
```

### Direct SQL DDL (Neon Owner Console)
If your Neon application user lacks schema DDL privileges, execute this DDL in the Neon SQL editor as the database owner (`neondb_owner`):

```sql
CREATE TABLE IF NOT EXISTS background_jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    payload JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_background_jobs_user_id ON background_jobs (user_id);
CREATE INDEX IF NOT EXISTS ix_background_jobs_status ON background_jobs (status);
CREATE INDEX IF NOT EXISTS ix_background_jobs_job_type ON background_jobs (job_type);
```

---

## 6. Rate Limiting Rules & Headers

Distributed sliding-window rate limits are enforced across all API instances using Redis sorted sets:

| Endpoint | Limit | Window | Client Key |
| :--- | :--- | :--- | :--- |
| `POST /api/v1/auth/login` | 10 requests | 1 minute | SHA-256(IP) |
| `POST /api/v1/auth/register` | 10 requests | 1 hour | SHA-256(IP) |
| `POST /api/v1/clothing-ai/analyze` | 15 requests | 1 minute | User ID or SHA-256(IP) |

### Rate Limit Response
When exceeded, the server returns HTTP 429:
```json
{
  "detail": "Too many requests. Please wait 45 seconds before retrying."
}
```
Response header:
`Retry-After: 45`

---

## 7. Caching & Invalidation Strategy

The cache layer (`backend/app/services/cache_service.py`) uses versioned key namespaces:
`stylesphere:v1:{namespace}:{identifier}`

| Domain | Key Pattern | TTL | Invalidation Trigger |
| :--- | :--- | :--- | :--- |
| Weather Forecast | `stylesphere:v1:weather:{lat}:{lon}` | 600s (10 min) | Natural TTL expiration |
| Social Stories | `stylesphere:v1:stories:usr:{user_id}` | 120s (2 min) | New post published |
| User Profile | `stylesphere:v1:profile:usr:{user_id}` | 300s (5 min) | `PUT /api/v1/users/profile` |

---

## 8. Health Checks & Verification

### Sanitized Redis Health Check
Check Redis connectivity at any time:
```http
GET /api/v1/health/redis
```

Response when operational:
```json
{
  "status": "healthy",
  "connected": true,
  "client": "redis-py",
  "error": null
}
```

Response when disabled or offline:
```json
{
  "status": "disabled",
  "connected": false,
  "client": null,
  "error": "Redis is disabled (REDIS_ENABLED=false)"
}
```
*(Notice: No endpoints, credentials, or internal IPs are ever exposed).*

### Automated Verification Tests
Run the test suite to verify configuration, caching, rate limiting, and background jobs:

```bash
cd backend
python -m pytest tests/test_redis.py tests/test_cache.py tests/test_rate_limiter.py tests/test_jobs.py -v
```

---

## 9. Failure Recovery & Credential Rotation

1. **Emergency Redis Outage**:
   - If Upstash experiences an outage or runs out of credits, set `REDIS_ENABLED=false` on your web services and restart.
   - The application will immediately continue operating via PostgreSQL without downtime.

2. **Credential Rotation**:
   - In the Upstash console, generate a new read-write password.
   - Update `REDIS_URL` in your hosting dashboard with the new password.
   - Perform a rolling restart of your API servers and background workers.
   - Delete the old password in Upstash after all services have reconnected.
