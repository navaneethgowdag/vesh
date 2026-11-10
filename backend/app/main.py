import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import verify_database_connection
from app.core.redis import init_redis, close_redis, check_redis_health
from app.api.routes import api_router
from app.ai.model_manager import model_manager
from app.ai.fashion_model import fashion_model_service

logger = logging.getLogger("tailorbird.startup")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    start_time = time.time()
    port = os.getenv("PORT", "8000")
    logger.info(f"[Startup:Begin] TailorBird API initializing on port {port} (env={settings.APP_ENV})...")

    # 1. Non-blocking database check (fast mode with strict timeout)
    try:
        db_connected = verify_database_connection(fast=True)
        if db_connected:
            logger.info("[Startup:Database] Neon PostgreSQL connected successfully.")
        else:
            logger.warning("[Startup:Database] Warning: Database connection verification failed during startup. Running in degraded mode.")
    except Exception as e:
        logger.warning(f"[Startup:Database] Database verification error: {e}")

    # 2. Initialize Upstash / Redis if enabled (bounded timeout)
    try:
        init_redis()
    except Exception as re:
        logger.warning(f"[Startup:Redis] Redis initialization notice: {re}")

    # 3. Model initialization (instantaneous background loading)
    try:
        model_manager.load_recommendation_model()
    except Exception as me:
        logger.warning(f"[Startup:Models] Recommendation model notice: {me}")

    # Dispatch fashion model loading in background thread so Uvicorn binds port immediately
    fashion_model_service.load_model_in_background()

    elapsed = time.time() - start_time
    logger.info(f"[Startup:Complete] Startup sequence completed in {elapsed:.3f}s. Binding socket and accepting traffic.")
    yield
    # Shutdown tasks
    logger.info("[Shutdown] TailorBird API shutting down...")
    close_redis()


app = FastAPI(
    title="TailorBird API",
    description="Production-grade AI Wardrobe & Social Fashion Platform API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS configuration - robust multi-origin support with trailing slash stripping
raw_origins = [
    settings.FRONTEND_URL,
    os.getenv("ADDITIONAL_CORS_ORIGINS", ""),
    "https://vesh.onrender.com",
    "https://vesh-backend-5sx2.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://tailorbird.tech",
    "https://www.tailorbird.tech",
]

allowed_origins: list[str] = []
for entry in raw_origins:
    if not entry:
        continue
    for item in entry.split(","):
        cleaned = item.strip().rstrip("/")
        if cleaned and cleaned not in allowed_origins:
            allowed_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.onrender\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static upload directory exists and mount static file serving with CORS support
class CORSStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Cache-Control"] = "public, max-age=86400"
        return response


static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
os.makedirs(os.path.join(static_dir, "uploads"), exist_ok=True)
app.mount("/static", CORSStaticFiles(directory=static_dir), name="static")


@app.get("/", tags=["root"], operation_id="root_endpoint")
def root_endpoint():
    """
    Root service endpoint directing developers to OpenAPI documentation and health checks.
    """
    return {
        "service": "TailorBird API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready",
    }


@app.head("/", include_in_schema=False)
def root_head():
    """Support HEAD / probes from Render and reverse proxies."""
    return Response(status_code=status.HTTP_200_OK)


@app.get("/favicon.ico", include_in_schema=False)
def favicon_endpoint():
    """Silence browser favicon requests without generating 404 warnings."""
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/health", tags=["health"])
def health_check():
    """
    Lightweight liveness probe for basic process uptime.
    Does not query database to keep heartbeat overhead zero.
    """
    return {
        "status": "ok",
        "app": "TailorBird",
        "version": "1.0.0",
        "env": settings.APP_ENV,
    }


@app.get("/ready", tags=["health"])
@app.get("/health/ready", tags=["health"])
@app.get("/api/v1/ready", tags=["health"])
def readiness_check(response: Response):
    """
    Dependency readiness probe. Reports actual operational status of dependencies:
    - Database (critical: HTTP 503 if disconnected)
    - Redis (optional: connected | degraded | disabled)
    - AI model (ready | loading | unavailable)
    - Background queue (active | thread_fallback_active)
    """
    db_ok = verify_database_connection(fast=True)
    redis_health = check_redis_health()

    if fashion_model_service.is_loaded:
        ai_status = "ready"
    elif fashion_model_service.is_loading:
        ai_status = "loading"
    else:
        ai_status = "unavailable"

    bg_status = "active" if redis_health.get("status") == "ok" else "thread_fallback_active"

    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "not_ready",
            "app": "TailorBird",
            "database": "disconnected",
            "redis": redis_health.get("status", "unknown"),
            "ai_model": ai_status,
            "background_jobs": bg_status,
            "detail": "Database connection check failed",
        }

    return {
        "status": "ready",
        "app": "TailorBird",
        "database": "Neon PostgreSQL",
        "redis": redis_health.get("status", "unknown"),
        "ai_model": ai_status,
        "background_jobs": bg_status,
    }


@app.get("/health/db", tags=["health"])
def health_db_check():
    db_ok = verify_database_connection()
    return {
        "status": "ok" if db_ok else "error",
        "database": "Neon PostgreSQL" if db_ok else "disconnected",
    }


@app.get("/health/redis", tags=["health"])
@app.get("/api/v1/health/redis", tags=["health"])
def health_redis_check():
    return check_redis_health()


@app.get("/api/v1/health", tags=["health"])
def api_health_check():
    db_ok = verify_database_connection()
    redis_health = check_redis_health()
    is_ok = db_ok and (redis_health["status"] in ("ok", "disabled"))
    return {
        "status": "ok" if is_ok else "degraded",
        "database": "Neon PostgreSQL" if db_ok else "disconnected",
        "redis": redis_health["status"],
    }


# Include all v1 API routes
app.include_router(api_router, prefix="/api/v1")


