import pytest
from app.services.cache_service import CacheService


def test_cache_key_builder_format():
    """Verify consistent hierarchical and versioned cache key formatting."""
    key = CacheService.build_key("weather", "12.34:56.78")
    assert key == "stylesphere:v1:weather:12.34:56.78"

    key_stories = CacheService.build_key("stories", "user_123")
    assert key_stories == "stylesphere:v1:stories:user_123"


def test_user_key_isolation():
    """Different users querying the same resource get distinct keys."""
    k1 = CacheService.build_key("profile", "usr:1")
    k2 = CacheService.build_key("profile", "usr:2")
    assert k1 != k2
    assert "usr:1" in k1
    assert "usr:2" in k2


def test_cache_aside_fallback_when_disabled(monkeypatch):
    """When Redis is not available, get_or_set transparently executes fallback producer."""
    monkeypatch.setattr("app.services.cache_service.get_redis_client", lambda: None)
    cs = CacheService()
    call_count = 0

    def expensive_query():
        nonlocal call_count
        call_count += 1
        return {"data": "fresh_from_postgres", "count": call_count}

    # First call calls producer
    result1 = cs.get_or_set_sync("stylesphere:v1:test:fallback_key", expensive_query, ttl_seconds=60)
    assert result1["data"] == "fresh_from_postgres"
    assert call_count == 1

    # In fallback mode, each call invokes producer
    result2 = cs.get_or_set_sync("stylesphere:v1:test:fallback_key", expensive_query, ttl_seconds=60)
    assert call_count == 2


@pytest.mark.asyncio
async def test_async_cache_aside_fallback(monkeypatch):
    """Async cache-aside falls back cleanly to coroutine producer when Redis is offline."""
    monkeypatch.setattr("app.services.cache_service.get_async_redis_client", lambda: None)
    cs = CacheService()
    async_call_count = 0

    async def async_fetch():
        nonlocal async_call_count
        async_call_count += 1
        return {"weather": "Sunny", "temp": 22.5}

    res = await cs.get_or_set_async("stylesphere:v1:weather:test_city_fallback", async_fetch, ttl_seconds=60)
    assert res["weather"] == "Sunny"
    assert async_call_count == 1


def test_domain_invalidation_methods():
    """Invalidation helpers execute safely without throwing exceptions."""
    cs = CacheService()
    # When Redis is disabled or offline, invalidations return gracefully
    cs.invalidate_stories()
    cs.invalidate_feed()
    cs.invalidate_weather("paris")
    cs.invalidate_user_profile("alice")


def test_cache_metrics_tracking():
    """Cache metrics track operations without leaking secret content."""
    cs = CacheService()
    metrics = cs.get_metrics()
    assert "hits" in metrics
    assert "misses" in metrics
    assert "writes" in metrics
    assert "invalidations" in metrics
    assert "errors" in metrics

