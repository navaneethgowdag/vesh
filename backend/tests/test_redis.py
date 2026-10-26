import pytest
from app.core.config import Settings
from app.core.redis import check_redis_health


def test_redis_settings_disabled():
    """When REDIS_ENABLED is False, empty REDIS_URL is valid."""
    s = Settings(REDIS_ENABLED=False, REDIS_URL="", APP_ENV="development")
    s.validate_redis_settings()  # Should not raise


def test_redis_settings_missing_url():
    """When REDIS_ENABLED is True, empty REDIS_URL raises ValueError."""
    s = Settings(REDIS_ENABLED=True, REDIS_URL="", APP_ENV="development")
    with pytest.raises(ValueError, match="REDIS_ENABLED is true, but REDIS_URL is not set"):
        s.validate_redis_settings()


def test_redis_settings_invalid_scheme():
    """REDIS_URL must use redis:// or rediss://."""
    s = Settings(REDIS_ENABLED=True, REDIS_URL="http://localhost:6379", APP_ENV="development")
    with pytest.raises(ValueError, match="Invalid REDIS_URL scheme"):
        s.validate_redis_settings()


def test_redis_settings_production_requires_tls():
    """In production, remote Upstash Redis must use rediss:// (TLS)."""
    s_insecure = Settings(
        REDIS_ENABLED=True,
        REDIS_URL="redis://upstash-cluster.upstash.io:6379",
        APP_ENV="production",
    )
    with pytest.raises(ValueError, match="secure 'rediss://'"):
        s_insecure.validate_redis_settings()

    # Secure rediss:// passes validation
    s_secure = Settings(
        REDIS_ENABLED=True,
        REDIS_URL="rediss://upstash-cluster.upstash.io:6379",
        APP_ENV="production",
    )
    s_secure.validate_redis_settings()


def test_redis_health_disabled_sanitized():
    """Health check when Redis is disabled does not expose sensitive URLs or credentials."""
    health = check_redis_health()
    assert "password" not in health
    assert "token" not in health
    assert "url" not in health
    assert health["status"] in ("ok", "disabled", "unreachable", "error")


def test_health_redis_endpoint(client):
    """GET /health/redis returns valid sanitized status."""
    res = client.get("/health/redis")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "connected" in data
    # Ensure no credentials leaked
    assert "password" not in data
    assert "url" not in data

