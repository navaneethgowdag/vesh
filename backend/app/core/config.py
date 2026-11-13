import os
import re
import socket
import time
from functools import lru_cache
from typing import Optional, List
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from pydantic_settings import BaseSettings, SettingsConfigDict


# Public resolvers used when the OS resolver (common with consumer routers /
# ISP DNS on Windows) refuses or times out on long CNAME chains such as the
# Neon pooler hostnames.
_FALLBACK_DNS_SERVERS = ("8.8.8.8", "1.1.1.1", "9.9.9.9")

# Resolution retries bounded for fast startup
_RESOLVE_ATTEMPTS = 2
_RESOLVE_BACKOFF_SECONDS = 0.5


def _split_url(database_url: str):
    return urlsplit(database_url)


def _configured_dns_servers() -> List[str]:
    """Best-effort list of DNS servers this machine is already configured with."""
    servers: List[str] = []
    try:
        import dns.resolver  # noqa: F401

        resolver = dns.resolver.Resolver()
        servers.extend(list(resolver.nameservers))
    except Exception:
        pass
    return [s for s in servers if s]


def _resolve_once(host: str) -> Optional[str]:
    """Resolve `host` to a single IPv4 address, or return None on failure."""
    # 1. OS resolver (fastest path).
    try:
        return socket.gethostbyname(host)
    except OSError:
        pass

    # In cloud environments (e.g. Render / Docker), bypass external raw DNS queries
    if os.getenv("RENDER") == "true" or bool(os.getenv("RENDER_SERVICE_ID")) or os.getenv("APP_ENV") == "production":
        return None

    # 2. Explicit DNS queries against system + public resolvers (Windows ISP workaround only).
    try:
        import dns.resolver
        import dns.exception
    except ImportError:
        return None

    for server in _dedupe(_configured_dns_servers() + list(_FALLBACK_DNS_SERVERS)):
        try:
            resolver = dns.resolver.Resolver(configure=False)
            resolver.nameservers = [server]
            resolver.timeout = 1.0
            resolver.lifetime = 1.5
            answers = resolver.resolve(host, "A")
            for answer in answers:
                return answer.to_text()
        except (dns.exception.DNSException, OSError, ValueError):
            continue
    return None


def _dedupe(values: List[str]) -> List[str]:
    return list(dict.fromkeys(v for v in values if v))


def _resolve_with_retries(host: str) -> Optional[str]:
    last_error: Optional[Exception] = None
    for attempt in range(_RESOLVE_ATTEMPTS):
        ip = _resolve_once(host)
        if ip:
            return ip
        if attempt < _RESOLVE_ATTEMPTS - 1:
            time.sleep(_RESOLVE_BACKOFF_SECONDS)
    return None


def _without_query_param(database_url: str, key: str) -> str:
    parts = _split_url(database_url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != key]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _with_query_param(database_url: str, key: str, value: str) -> str:
    parts = _split_url(database_url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != key]
    query.append((key, value))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _pin_host_address(database_url: str) -> str:
    """
    Resolve the database host once and pin it via libpq's `hostaddr`.
    Only enabled on local Windows when ENABLE_DNS_PINNING=true.
    Disabled by default on Render and Linux to avoid breaking cloud DNS.
    """
    if os.getenv("RENDER") == "true" or bool(os.getenv("RENDER_SERVICE_ID")) or os.getenv("ENABLE_DNS_PINNING", "false").lower() != "true":
        return database_url

    parts = _split_url(database_url)
    host = parts.hostname
    if not host:
        return database_url

    # Already pinned, or a local socket that never needs resolving.
    already_pinned = any(k == "hostaddr" for k, _ in parse_qsl(parts.query, keep_blank_values=True))
    if already_pinned or host in ("localhost", "::1"):
        return database_url
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", host):
        return database_url

    ip = _resolve_with_retries(host)
    if not ip:
        return database_url
    return _with_query_param(database_url, "hostaddr", ip)


class Settings(BaseSettings):
    # No credential defaults are allowed in source. These MUST come from the
    # backend `.env` file (or real environment variables in production).
    DATABASE_URL: str = ""
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    FRONTEND_URL: str = "http://localhost:5173"
    
    WEATHER_API_KEY: str = "mock_dev_key"
    WEATHER_API_BASE_URL: str = "https://api.openweathermap.org"
    
    APP_ENV: str = "development"
    
    # Redis / Upstash configuration
    REDIS_ENABLED: bool = False
    REDIS_URL: str = ""
    REDIS_TOKEN: str = ""
    REDIS_CONNECT_TIMEOUT: float = 5.0
    REDIS_SOCKET_TIMEOUT: float = 5.0
    REDIS_MAX_CONNECTIONS: int = 20
    REDIS_RETRY_ON_TIMEOUT: bool = True
    
    # AI Model Artifacts & Deployment
    AI_MODEL_PATH: str = "./ai_models"
    FASHION_MODEL_PATH: Optional[str] = None
    ARTIFACTS_DIR: Optional[str] = None
    FASHION_MODEL_DOWNLOAD_URL: Optional[str] = None
    FASHION_MODEL_EXPECTED_SIZE: Optional[int] = None
    FASHION_MODEL_SHA256: Optional[str] = None
    ALLOW_BACKGROUND_THREAD_FALLBACK: bool = False
    AI_ENABLE_ML: bool = True
    AI_ENABLE_IMAGE_ANALYSIS: bool = True
    
    # Feature flags for non-required / deferred modules
    ENABLE_COMMUNITIES: bool = False
    ENABLE_MESSAGES: bool = False
    ENABLE_EXPLORE: bool = False
    ENABLE_TRENDING: bool = False
    
    # Google OAuth 2.0 / OpenID Connect
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    BACKEND_URL: str = "http://localhost:8000"
    
    # Administrator credentials (securely provisioned from environment)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = ""
    
    _cached_resolved_url: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def google_redirect_uri(self) -> str:
        """Normalized OAuth callback redirect URI."""
        is_render_or_prod = (
            self.APP_ENV.lower() == "production"
            or os.getenv("RENDER") == "true"
            or bool(os.getenv("RENDER_EXTERNAL_URL"))
            or bool(os.getenv("RENDER_SERVICE_ID"))
        )

        if self.GOOGLE_REDIRECT_URI and self.GOOGLE_REDIRECT_URI.strip():
            raw_uri = self.GOOGLE_REDIRECT_URI.strip()
            # If in production or on Render, prevent accidental localhost redirects
            if is_render_or_prod and ("localhost" in raw_uri or "127.0.0.1" in raw_uri):
                backend = (os.getenv("RENDER_EXTERNAL_URL") or "https://vesh-backend-5sx2.onrender.com").rstrip("/")
                return f"{backend}/api/v1/auth/google/callback"
            return raw_uri

        render_external = os.getenv("RENDER_EXTERNAL_URL")
        if render_external and render_external.strip():
            return f"{render_external.strip().rstrip('/')}/api/v1/auth/google/callback"

        if is_render_or_prod:
            return "https://vesh-backend-5sx2.onrender.com/api/v1/auth/google/callback"

        backend = (self.BACKEND_URL or "http://localhost:8000").rstrip("/")
        return f"{backend}/api/v1/auth/google/callback"

    @property
    def is_google_oauth_configured(self) -> bool:
        """True if Google OAuth credentials are provided."""
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    @property
    def redis_connection_url(self) -> str:
        """
        Return the normalized Redis connection URL.
        Accepts direct redis:// / rediss:// schemes, or auto-converts
        Upstash REST URLs (https://...) with REDIS_TOKEN into a rediss:// URL.
        """
        if not self.REDIS_URL:
            return ""
        url = self.REDIS_URL.strip().strip('"').strip("'")
        if url.startswith("https://") and self.REDIS_TOKEN:
            parsed = urlsplit(url)
            token = self.REDIS_TOKEN.strip().strip('"').strip("'")
            port = parsed.port or 6379
            return f"rediss://default:{token}@{parsed.hostname}:{port}"
        return url

    def validate_redis_settings(self) -> None:
        if not self.REDIS_ENABLED:
            return
        effective_url = self.redis_connection_url
        if not effective_url or not effective_url.strip():
            raise ValueError("REDIS_ENABLED is true, but REDIS_URL is not set.")
        parsed = urlsplit(effective_url)
        if parsed.scheme not in ("redis", "rediss"):
            raise ValueError(f"Invalid REDIS_URL scheme '{parsed.scheme}'. Must be redis:// or rediss://")
        if self.APP_ENV.lower() == "production":
            is_local = parsed.hostname in ("localhost", "127.0.0.1", "::1", "host.docker.internal")
            if not is_local and parsed.scheme != "rediss":
                raise ValueError("In production, remote/hosted REDIS_URL must use the secure 'rediss://' (TLS) scheme.")

    @property
    def sync_database_url(self) -> str:
        if not self.DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy backend/.env.example to backend/.env "
                "and paste your Neon connection string."
            )
        if self._cached_resolved_url:
            return self._cached_resolved_url
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        if not url.startswith("postgresql+psycopg://"):
            raise RuntimeError(
                "DATABASE_URL must use the psycopg 3 driver, e.g. "
                "postgresql+psycopg://user:password@host/dbname?sslmode=require"
            )
        url = _with_query_param(url, "connect_timeout", "10")
        resolved = _pin_host_address(url)
        self._cached_resolved_url = resolved
        return resolved


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

