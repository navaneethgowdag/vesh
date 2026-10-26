import logging
import time
from typing import Optional, Dict, Any
from urllib.parse import urlsplit
import redis
import redis.asyncio as aioredis
from redis.retry import Retry
from redis.backoff import ExponentialBackoff

from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton client handles
_sync_client: Optional[redis.Redis] = None
_async_client: Optional[aioredis.Redis] = None
_sync_pool: Optional[redis.ConnectionPool] = None
_async_pool: Optional[aioredis.ConnectionPool] = None


def get_redis_connection_kwargs() -> Dict[str, Any]:
    """Extract connection parameters with bounded timeouts and TLS config."""
    kwargs: Dict[str, Any] = {
        "socket_connect_timeout": settings.REDIS_CONNECT_TIMEOUT,
        "socket_timeout": settings.REDIS_SOCKET_TIMEOUT,
        "max_connections": settings.REDIS_MAX_CONNECTIONS,
        "decode_responses": True,
    }
    if settings.REDIS_RETRY_ON_TIMEOUT:
        kwargs["retry_on_timeout"] = True
        kwargs["retry"] = Retry(ExponentialBackoff(cap=2.0, base=0.2), retries=2)

    url = settings.redis_connection_url
    if url:
        parsed = urlsplit(url)
        if parsed.scheme == "rediss":
            kwargs["ssl_cert_reqs"] = "required"

    return kwargs


def init_redis() -> Optional[redis.Redis]:
    """
    Initialize Redis connection pools.
    Safe: does not crash if Redis is unavailable or disabled.
    """
    global _sync_client, _async_client, _sync_pool, _async_pool

    url = settings.redis_connection_url
    if not settings.REDIS_ENABLED or not url:
        logger.info("Redis is disabled (REDIS_ENABLED=false). Caching and rate limiting will run in fallback mode.")
        return None

    try:
        settings.validate_redis_settings()
        kwargs = get_redis_connection_kwargs()

        # Sync pool
        _sync_pool = redis.ConnectionPool.from_url(url, **kwargs)
        _sync_client = redis.Redis(connection_pool=_sync_pool)

        # Async pool
        _async_pool = aioredis.ConnectionPool.from_url(url, **kwargs)
        _async_client = aioredis.Redis(connection_pool=_async_pool)

        # Test ping with bounded timeout
        _sync_client.ping()
        logger.info("Successfully connected to Upstash / Redis.")
        return _sync_client
    except Exception as e:
        logger.warning(
            f"Redis connection failed during startup ({e.__class__.__name__}: {e}). "
            "Continuing with Redis disabled for this process."
        )
        _sync_client = None
        _async_client = None
        return None


def get_redis_client() -> Optional[redis.Redis]:
    """Return the shared sync Redis client, or None if disabled/unreachable."""
    global _sync_client
    if not settings.REDIS_ENABLED or not settings.redis_connection_url:
        return None
    if _sync_client is None:
        init_redis()
    return _sync_client


def get_async_redis_client() -> Optional[aioredis.Redis]:
    """Return the shared async Redis client, or None if disabled/unreachable."""
    global _async_client
    if not settings.REDIS_ENABLED or not settings.redis_connection_url:
        return None
    if _async_client is None:
        init_redis()
    return _async_client


def close_redis() -> None:
    """Explicit lifecycle cleanup for Redis pools."""
    global _sync_client, _async_client, _sync_pool, _async_pool
    try:
        if _sync_client is not None:
            _sync_client.close()
            _sync_client = None
        if _sync_pool is not None:
            _sync_pool.disconnect()
            _sync_pool = None
    except Exception as e:
        logger.warning(f"Error closing sync Redis pool: {e}")

    try:
        if _async_client is not None:
            _async_client = None
        if _async_pool is not None:
            _async_pool = None
    except Exception as e:
        logger.warning(f"Error closing async Redis pool: {e}")


def check_redis_health() -> Dict[str, Any]:
    """
    Lightweight health/readiness check.
    CRITICAL: Never leaks credentials, tokens, or URL details.
    """
    if not settings.REDIS_ENABLED:
        return {
            "status": "disabled",
            "enabled": False,
            "connected": False,
        }

    client = get_redis_client()
    if client is None:
        return {
            "status": "unreachable",
            "enabled": True,
            "connected": False,
        }

    try:
        t0 = time.perf_counter()
        pong = client.ping()
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        if pong:
            return {
                "status": "ok",
                "enabled": True,
                "connected": True,
                "latency_ms": latency_ms,
            }
    except Exception as e:
        logger.warning(f"Redis health check failed: {e.__class__.__name__}")

    return {
        "status": "error",
        "enabled": True,
        "connected": False,
    }

