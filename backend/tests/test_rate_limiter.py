import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from app.core.rate_limiter import _get_client_identifier, check_rate_limit, RateLimit
from app.models.user import User
import uuid


def test_rate_limiter_identifier_authenticated():
    """Authenticated requests rate-limit by user ID."""
    u = User(id=uuid.uuid4(), username="stylist", email="s@test.com")
    req = MagicMock()
    req.client.host = "192.168.1.1"

    ident = _get_client_identifier(req, u)
    assert ident == f"usr:{u.id}"
    assert "192.168.1.1" not in ident


def test_rate_limiter_identifier_unauthenticated_hashed():
    """Unauthenticated requests use hashed IP to avoid storing raw IP in Redis."""
    req = MagicMock()
    req.client.host = "203.0.113.42"

    ident = _get_client_identifier(req, None)
    assert ident.startswith("ip:")
    assert "203.0.113.42" not in ident
    assert len(ident) > 5


@pytest.mark.asyncio
async def test_rate_limiter_fallback_when_redis_disabled():
    """Rate limiter fails open gracefully when Redis is disabled/offline."""
    allowed, retry_after = await check_rate_limit(
        key="stylesphere:v1:ratelimit:login:test",
        max_requests=5,
        window_seconds=60,
    )
    assert allowed is True
    assert retry_after == 0


@pytest.mark.asyncio
async def test_rate_limiter_dependency_disabled(client):
    """When REDIS_ENABLED=False, RateLimit dependency allows requests without error."""
    limiter = RateLimit(requests=2, window=60, scope="test")
    req = MagicMock()
    req.client.host = "127.0.0.1"
    # Should not raise HTTPException
    await limiter(request=req, current_user=None)

