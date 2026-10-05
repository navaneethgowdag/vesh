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

# Resolution can transiently fail (router DNS cache misses, VPN handshakes...).
_RESOLVE_ATTEMPTS = 4
_RESOLVE_BACKOFF_SECONDS = 1.5


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

    # 2. Explicit DNS queries against system + public resolvers.
    try:
        import dns.resolver
        import dns.exception
    except ImportError:
        return None

    for server in _dedupe(_configured_dns_servers() + list(_FALLBACK_DNS_SERVERS)):
        try:
            resolver = dns.resolver.Resolver(configure=False)
            resolver.nameservers = [server]
            resolver.timeout = 3.0
            resolver.lifetime = 5.0
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
    print(
        f"Warning: could not resolve database host '{host}' via system or public DNS. "
        "Falling back to the hostname; the connection may fail if DNS is still broken."
    )
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

    libpq can then connect straight to the IP, bypassing whatever is breaking
    hostname resolution for this process. The host name is still sent for
    TLS/SNI and routing purposes.
    """
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
    
    AI_MODEL_PATH: str = "./ai_models"
    AI_ENABLE_ML: bool = True
    AI_ENABLE_IMAGE_ANALYSIS: bool = True
    
    _cached_resolved_url: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

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

