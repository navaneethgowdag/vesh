import hashlib
import logging
import time
from typing import Optional, Tuple
from fastapi import Request, HTTPException, status, Depends
from app.core.config import settings
from app.core.redis import get_async_redis_client, get_redis_client
from app.core.dependencies import get_current_user_optional
from app.models.user import User

logger = logging.getLogger(__name__)


def _get_client_identifier(request: Request, user: Optional[User] = None) -> str:
    """
    Extract reliable client identifier.
    Uses authenticated user ID if logged in; otherwise client IP.
    Protects against spoofed X-Forwarded-For unless explicitly running behind a proxy.
    """
    if user is not None:
        return f"usr:{user.id}"

    # Use direct client host by default
    client_ip = request.client.host if request.client else "unknown"
    # Anonymize/hash to prevent storing raw IP strings in Redis
    ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()[:16]
    return f"ip:{ip_hash}"


async def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
) -> Tuple[bool, int]:
    """
    Atomic sliding-window rate limiter using Redis sorted sets.
    Returns (is_allowed, retry_after_seconds).
    Graceful fallback: returns (True, 0) if Redis is disabled or unreachable.
    """
    client = get_async_redis_client()
    if client is None:
        return True, 0

    now = time.time()
    window_start = now - window_seconds

    try:
        pipe = client.pipeline(transaction=True)
        # 1. Remove timestamps older than window
        pipe.zremrangebyscore(key, 0, window_start)
        # 2. Count requests in current window
        pipe.zcard(key)
        # 3. Add current timestamp
        member = f"{now}"
        pipe.zadd(key, {member: now})
        # 4. Set TTL on set
        pipe.expire(key, window_seconds * 2)

        results = await pipe.execute()
        current_count = results[1]

        if current_count >= max_requests:
            # Over limit -> calculate retry-after
            # Remove the tentatively added current timestamp
            try:
                await client.zrem(key, member)
            except Exception:
                pass
            return False, max(1, int(window_seconds))

        return True, 0
    except Exception as e:
        logger.warning(f"Rate limiter Redis error on '{key}': {e.__class__.__name__}. Failing open.")
        return True, 0


class RateLimit:
    """
    FastAPI route dependency for distributed rate limiting.
    Usage:
        @router.post("/login", dependencies=[Depends(RateLimit(requests=10, window=60, scope="login"))])
    """

    def __init__(self, requests: int, window: int, scope: str = "general"):
        self.requests = requests
        self.window = window
        self.scope = scope

    async def __call__(
        self,
        request: Request,
        current_user: Optional[User] = Depends(get_current_user_optional),
    ) -> None:
        if not settings.REDIS_ENABLED:
            return

        # Bypass rate limit for in-memory TestClient runs unless explicitly requested
        if request.client and request.client.host == "testclient" and not request.headers.get("x-enforce-rate-limit"):
            return

        identifier = _get_client_identifier(request, current_user)
        key = f"stylesphere:v1:ratelimit:{self.scope}:{identifier}"

        allowed, retry_after = await check_rate_limit(
            key=key,
            max_requests=self.requests,
            window_seconds=self.window,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {self.scope}. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

