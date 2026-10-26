import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
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

# CORS configuration
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Deduplicate while preserving order
allowed_origins = list(dict.fromkeys(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static upload directory exists and mount static file serving
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
os.makedirs(os.path.join(static_dir, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "app": "StyleSphere",
        "version": "1.0.0",
        "env": settings.APP_ENV,
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

