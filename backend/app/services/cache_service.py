import json
import logging
from typing import Any, Callable, Dict, Optional, TypeVar, Coroutine
import inspect

from app.core.config import settings
from app.core.redis import get_redis_client, get_async_redis_client

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Key namespace prefix and version
CACHE_KEY_PREFIX = "stylesphere:v1"

# Standard TTLs in seconds
TTL_WEATHER = 600       # 10 minutes (weather changes slowly; saves external Open-Meteo latency)
TTL_STORIES = 120       # 2 minutes (frequent updates)
TTL_FEED = 60           # 1 minute (high-traffic home feed)
TTL_USER_PROFILE = 300  # 5 minutes (invalidated on user update)


class CacheMetrics:
    """Low-cardinality in-memory operational metrics for cache activity."""
    def __init__(self):
        self.hits: int = 0
        self.misses: int = 0
        self.writes: int = 0
        self.invalidations: int = 0
        self.errors: int = 0

    def to_dict(self) -> Dict[str, int]:
        total_reads = self.hits + self.misses
        hit_ratio = round((self.hits / total_reads) * 100, 2) if total_reads > 0 else 0.0
        return {
            "hits": self.hits,
            "misses": self.misses,
            "writes": self.writes,
            "invalidations": self.invalidations,
            "errors": self.errors,
            "hit_ratio_percent": hit_ratio,
        }


metrics = CacheMetrics()


class CacheService:
    """
    Selective, safe cache-aside service backed by Redis.
    Transparently falls back to PostgreSQL / origin on Redis outage or when disabled.
    """

    @staticmethod
    def build_key(namespace: str, identifier: str) -> str:
        clean_ns = namespace.strip().lower()
        clean_id = identifier.strip().lower().replace(" ", "_")
        return f"{CACHE_KEY_PREFIX}:{clean_ns}:{clean_id}"

    def get(self, key: str) -> Optional[Any]:
        """Synchronously get and deserialize a cached value."""
        client = get_redis_client()
        if client is None:
            return None

        try:
            raw = client.get(key)
            if raw is not None:
                metrics.hits += 1
                return json.loads(raw)
            metrics.misses += 1
            return None
        except Exception as e:
            metrics.errors += 1
            logger.warning(f"Cache read error for key '{key}': {e.__class__.__name__}")
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> bool:
        """Synchronously serialize and set a value with bounded TTL."""
        client = get_redis_client()
        if client is None:
            return False

        try:
            payload = json.dumps(value, default=str)
            client.set(name=key, value=payload, ex=ttl_seconds)
            metrics.writes += 1
            return True
        except Exception as e:
            metrics.errors += 1
            logger.warning(f"Cache write error for key '{key}': {e.__class__.__name__}")
            return False

    def delete(self, key: str) -> bool:
        """Synchronously delete a single key."""
        client = get_redis_client()
        if client is None:
            return False

        try:
            client.delete(key)
            metrics.invalidations += 1
            return True
        except Exception as e:
            metrics.errors += 1
            logger.warning(f"Cache delete error for key '{key}': {e.__class__.__name__}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Synchronously delete keys matching a pattern (e.g. invalidating a feed partition)."""
        client = get_redis_client()
        if client is None:
            return 0

        try:
            full_pattern = f"{CACHE_KEY_PREFIX}:{pattern}"
            keys = client.keys(full_pattern)
            if keys:
                client.delete(*keys)
                metrics.invalidations += len(keys)
                return len(keys)
            return 0
        except Exception as e:
            metrics.errors += 1
            logger.warning(f"Cache delete_pattern error for '{pattern}': {e.__class__.__name__}")
            return 0

    async def get_async(self, key: str) -> Optional[Any]:
        """Asynchronously get and deserialize a cached value."""
        client = get_async_redis_client()
        if client is None:
            return None

        try:
            raw = await client.get(key)
            if raw is not None:
                metrics.hits += 1
                return json.loads(raw)
            metrics.misses += 1
            return None
        except Exception as e:
            metrics.errors += 1
            logger.warning(f"Async cache read error for key '{key}': {e.__class__.__name__}")
            return None

    async def set_async(self, key: str, value: Any, ttl_seconds: int = 300) -> bool:
        """Asynchronously serialize and set a value with bounded TTL."""
        client = get_async_redis_client()
        if client is None:
            return False

        try:
            payload = json.dumps(value, default=str)
            await client.set(name=key, value=payload, ex=ttl_seconds)
            metrics.writes += 1
            return True
        except Exception as e:
            metrics.errors += 1
            logger.warning(f"Async cache write error for key '{key}': {e.__class__.__name__}")
            return False

    async def get_or_set_async(
        self,
        key: str,
        producer: Callable[[], Coroutine[Any, Any, T]],
        ttl_seconds: int = 300,
    ) -> T:
        """
        Async cache-aside helper.
        Checks cache; on miss, awaits producer(), caches result, and returns.
        Graceful fallback: executes producer() directly if Redis is down.
        """
        cached = await self.get_async(key)
        if cached is not None:
            return cached

        res = await producer()
        if res is not None:
            await self.set_async(key, res, ttl_seconds=ttl_seconds)
        return res

    def get_or_set_sync(
        self,
        key: str,
        producer: Callable[[], T],
        ttl_seconds: int = 300,
    ) -> T:
        """
        Sync cache-aside helper.
        Checks cache; on miss, calls producer(), caches result, and returns.
        """
        cached = self.get(key)
        if cached is not None:
            return cached

        res = producer()
        if res is not None:
            self.set(key, res, ttl_seconds=ttl_seconds)
        return res

    # --- Domain Specific Invalidation Helpers ---

    def invalidate_stories(self, user_id: Optional[Any] = None) -> None:
        """Invalidate cached recent stories."""
        if user_id:
            self.delete(self.build_key("stories", f"user_{user_id}"))
        self.delete(self.build_key("stories", "recent"))
        self.delete_pattern("stories:*")

    def invalidate_feed(self) -> None:
        """Invalidate cached feed segments."""
        self.delete_pattern("feed:*")

    def invalidate_moments(self, user_id: Optional[Any] = None) -> None:
        """Invalidate cached moment feeds."""
        if user_id:
            self.delete(self.build_key("moments", f"user_{user_id}"))
        self.delete_pattern("moments:*")

    def invalidate_user_profile(self, username: str) -> None:
        """Invalidate public user profile cache."""
        self.delete(self.build_key("users:profile", username))

    def invalidate_weather(self, identifier: str) -> None:
        """Invalidate weather cache for a city or coordinate key."""
        self.delete(self.build_key("weather", identifier))

    @staticmethod
    def get_metrics() -> Dict[str, Any]:
        """Return low-cardinality cache hit/miss/error metrics."""
        return metrics.to_dict()


# Global singleton instance
cache_service = CacheService()

