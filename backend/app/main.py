import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import verify_database_connection
from app.core.redis import init_redis, close_redis, check_redis_health
from app.api.routes import api_router
from app.ai.model_manager import model_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    print("StyleSphere API starting up...")
    db_connected = verify_database_connection()
    if db_connected:
        print("Connected to Neon PostgreSQL.")
    else:
        print("Warning: Database connection verification failed during startup.")
    
    # Initialize Upstash / Redis if enabled
    init_redis()

    # Load ML models if available
    model_manager.load_recommendation_model()
    yield
    # Shutdown tasks
    print("StyleSphere API shutting down...")
    close_redis()


app = FastAPI(
    title="StyleSphere API",
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
        "service": "StyleSphere API",
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
        "app": "StyleSphere",
        "version": "1.0.0",
        "env": settings.APP_ENV,
    }


@app.get("/ready", tags=["health"])
@app.get("/health/ready", tags=["health"])
@app.get("/api/v1/ready", tags=["health"])
def readiness_check(response: Response):
    """
    Dependency readiness probe. Verifies that Neon PostgreSQL is reachable
    via a lightweight SELECT 1 query before orchestrators route live traffic.
    Returns HTTP 200 when ready, HTTP 503 when dependencies fail.
    """
    db_ok = verify_database_connection()
    redis_health = check_redis_health()
    is_ready = db_ok

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "not_ready",
            "app": "StyleSphere",
            "database": "disconnected",
            "redis": redis_health["status"],
            "detail": "Database connection check failed",
        }

    return {
        "status": "ready",
        "app": "StyleSphere",
        "database": "Neon PostgreSQL",
        "redis": redis_health["status"],
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


