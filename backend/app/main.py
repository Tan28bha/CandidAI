import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.db.session import get_db
from app.utils.redis import verify_redis_connection
from app.api.routes import router as api_router

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Starting up FastAPI application...")
    yield
    # Shutdown logic
    logger.info("Shutting down FastAPI application...")


# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for the Multi-Agent AI Interview Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration
# Allowed origins can be configured in settings in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR, tags=["Platform"])



# Base API Routes
@app.get("/", tags=["Root"])
def root_route():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API",
        "docs": "/docs",
        "version": "1.0.0",
    }


@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
def get_health():
    """
    General health check endpoint for container probes.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0"
    }


@app.get(f"{settings.API_V1_STR}/health/db", tags=["Health"])
def get_db_health(db: Session = Depends(get_db)):
    """
    Checks database connection by executing a fast query.
    """
    try:
        # Execute basic query
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "service": "database",
            "message": "Database connection verified successfully"
        }
    except Exception as e:
        logger.error(f"Database healthcheck failure: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed"
        )


@app.get(f"{settings.API_V1_STR}/health/redis", tags=["Health"])
def get_redis_health():
    """
    Checks Redis connectivity.
    """
    is_alive = verify_redis_connection()
    if is_alive:
        return {
            "status": "healthy",
            "service": "redis",
            "message": "Redis connection verified successfully"
        }
    else:
        logger.error("Redis healthcheck failure: unable to ping Redis host")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis connection failed"
        )
