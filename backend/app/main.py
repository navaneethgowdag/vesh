from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import verify_database_connection
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
    
    # Load ML models if available
    model_manager.load_recommendation_model()
    yield
    # Shutdown tasks
    print("StyleSphere API shutting down...")


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


@app.get("/api/v1/health", tags=["health"])
def api_health_check():
    db_ok = verify_database_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "Neon PostgreSQL" if db_ok else "disconnected",
    }


# Include all v1 API routes
app.include_router(api_router, prefix="/api/v1")

