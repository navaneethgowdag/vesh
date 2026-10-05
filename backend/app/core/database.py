import time
from typing import Generator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings, _without_query_param

# --- Engine construction ----------------------------------------------------
# The resolved URL may carry a pinned `hostaddr=<ip>`. If that IP ever goes
# away (pooler rotation, network change), we transparently fall back to a
# hostname-only engine so the API never hard-fails on a stale DNS answer.


_RESOLVED_URL = settings.sync_database_url
_HOSTNAME_URL = _without_query_param(_RESOLVED_URL, "hostaddr")
# Only worth a second engine if pinning actually happened.
_HAS_PINNED_IP = _HOSTNAME_URL != _RESOLVED_URL


def _build_engine(url: str) -> Engine:
    return create_engine(
        url,
        pool_pre_ping=True,      # transparently recycle dead connections
        pool_recycle=300,        # Neon closes idle pooled connections
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        echo=False,
        connect_args={"application_name": "stylesphere-api"},
    )


engine = _build_engine(_RESOLVED_URL)
_fallback_engine: Optional[Engine] = None
_using_fallback = False


def get_engine() -> Engine:
    """Return the engine currently known to be reachable."""
    return _fallback_engine if (_using_fallback and _fallback_engine is not None) else engine


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _rebuild_session_factory() -> None:
    """Rebind SessionLocal to whichever engine is currently active."""
    SessionLocal.configure(bind=get_engine())


def _activate_fallback() -> None:
    """Switch to the hostname-only engine after a connectivity failure."""
    global _fallback_engine, _using_fallback
    if _using_fallback:
        return
    print("Database: pinned host address failed, falling back to hostname resolution.")
    _fallback_engine = _build_engine(_HOSTNAME_URL)
    _using_fallback = True
    _rebuild_session_factory()


def _activate_primary() -> None:
    """Switch back to the primary engine once it recovers."""
    global _using_fallback
    if not _using_fallback:
        return
    print("Database: primary connection restored.")
    _using_fallback = False
    _rebuild_session_factory()


def _connect_with_failover(retries: int = 2, backoff: float = 1.0) -> None:
    """
    Open a connection, switching engines on failure.

    Tries the pinned-IP engine first, then the hostname-only engine. Raises the
    last OperationalError if neither could connect.
    """
    global _fallback_engine

    # Only two distinct URLs exist when an IP was pinned; otherwise one engine
    # is enough.
    attempts: list = [(False, engine)]
    if _HAS_PINNED_IP:
        attempts.append((True, _fallback_engine or _build_engine(_HOSTNAME_URL)))

    # Try the currently-active configuration first.
    if _using_fallback and len(attempts) > 1:
        attempts.reverse()

    last_error: Optional[Exception] = None
    for use_hostname, candidate in attempts:
        for attempt in range(retries):
            try:
                with candidate.connect() as conn:
                    conn.execute(text("SELECT 1")).scalar()
                if use_hostname:
                    _fallback_engine = candidate
                    _activate_fallback()
                else:
                    _activate_primary()
                return
            except OperationalError as exc:
                last_error = exc
                if attempt < retries - 1:
                    time.sleep(backoff * (attempt + 1))

    raise last_error if last_error is not None else RuntimeError("Could not establish a database connection.")


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for yielding database sessions."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def verify_database_connection() -> bool:
    """Verify Neon PostgreSQL connectivity via SELECT 1 (with failover)."""
    try:
        _connect_with_failover()
        return True
    except Exception as e:
        print(f"Database connection verification error: {e}")
        return False

