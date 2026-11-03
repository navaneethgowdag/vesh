import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple
from urllib.parse import urlencode, quote
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.user_identity_service import UserIdentityService

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
GOOGLE_SCOPES = "openid email profile"

# In-memory single-use ticket store for secure frontend token handoff (60-second TTL)
_TICKET_STORE: Dict[str, Dict[str, Any]] = {}


def _cleanup_expired_tickets() -> None:
    now = time.time()
    expired = [k for k, v in _TICKET_STORE.items() if v.get("exp", 0) < now]
    for k in expired:
        _TICKET_STORE.pop(k, None)


def store_exchange_ticket(user_id: str, username: str, destination: str = "/home") -> str:
    """Create a single-use exchange ticket valid for 60 seconds."""
    _cleanup_expired_tickets()
    ticket = secrets.token_urlsafe(32)
    _TICKET_STORE[ticket] = {
        "user_id": user_id,
        "username": username,
        "destination": destination,
        "exp": time.time() + 60,
    }
    return ticket


def consume_exchange_ticket(ticket: str) -> Optional[Dict[str, Any]]:
    """Retrieve and immediately invalidate a single-use exchange ticket."""
    _cleanup_expired_tickets()
    data = _TICKET_STORE.pop(ticket, None)
    if not data:
        return None
    if data.get("exp", 0) < time.time():
        return None
    return data


class AccountCollisionException(Exception):
    """Raised when Google email matches an existing password account that is not yet linked."""
    def __init__(self, email: str, sub: str, name: Optional[str] = None):
        self.email = email
        self.sub = sub
        self.name = name
        super().__init__(f"An account with email '{email}' already exists. Please log in with password to link Google.")


def is_allowed_frontend_origin(origin: Optional[str]) -> bool:
    """Validate if an origin URL is a permitted frontend application host."""
    if not origin or not isinstance(origin, str):
        return False
    clean = origin.rstrip("/").lower()
    if clean in (
        "https://tailorbird.tech",
        "https://www.tailorbird.tech",
        "https://vesh.onrender.com",
        "https://vesh-backend-5sx2.onrender.com",
    ):
        return True
    if clean.startswith("http://localhost:") or clean.startswith("http://127.0.0.1:"):
        return True
    if clean.endswith(".onrender.com"):
        return True
    if settings.FRONTEND_URL and clean == settings.FRONTEND_URL.rstrip("/").lower():
        return True
    return False


class GoogleOAuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.identity_service = UserIdentityService(db)

    def generate_state_token(
        self,
        destination: str = "/home",
        action: str = "login",
        user_id: Optional[UUID] = None,
        frontend_url: Optional[str] = None,
    ) -> str:
        """Generate signed state token with 10-minute validity and CSRF protection."""
        safe_dest = destination if destination.startswith("/") and not destination.startswith("//") else "/home"
        safe_frontend = frontend_url.rstrip("/") if is_allowed_frontend_origin(frontend_url) else None
        state_payload = {
            "csrf": secrets.token_urlsafe(24),
            "dest": safe_dest,
            "action": action,
            "user_id": str(user_id) if user_id else None,
            "frontend_url": safe_frontend,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        return jwt.encode(state_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    def generate_authorization_url(
        self,
        destination: str = "/home",
        action: str = "login",
        user_id: Optional[UUID] = None,
        frontend_url: Optional[str] = None,
    ) -> str:
        """
        Generate Google OAuth 2.0 authorization URL with secure signed state.
        Validates that Google client ID is configured.
        """
        if not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in the environment.",
            )

        signed_state = self.generate_state_token(
            destination=destination,
            action=action,
            user_id=user_id,
            frontend_url=frontend_url,
        )

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_SCOPES,
            "state": signed_state,
            "access_type": "offline",
            "prompt": "select_account",
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    def verify_state(self, state: str) -> Dict[str, Any]:
        """Verify the integrity, signature, and expiration of the OAuth state parameter."""
        try:
            payload = jwt.decode(state, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state parameter.",
            )

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code with Google's token endpoint.
        Uses POST with client_secret kept strictly on the backend.
        """
        if not settings.GOOGLE_CLIENT_SECRET or not settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google OAuth client credentials are not configured.",
            )

        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(GOOGLE_TOKEN_URL, data=data)
            except Exception as e:
                logger.error(f"[GoogleOAuth] Network error communicating with Google token endpoint: {e}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to connect to Google authentication service.",
                )

        if response.status_code != 200:
            logger.error(f"[GoogleOAuth] Token exchange failed ({response.status_code}): {response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code with Google. The code may be invalid or expired.",
            )

        return response.json()

    def verify_id_token(self, id_token_str: str) -> Dict[str, Any]:
        """
        Verify Google's ID token using Google's trusted authentication library.
        Validates signature, issuer, audience, expiry, and email verification.
        """
        try:
            req = google_requests.Request()
            id_info = google_id_token.verify_oauth2_token(
                id_token_str,
                req,
                audience=settings.GOOGLE_CLIENT_ID,
            )
        except Exception as e:
            logger.warning(f"[GoogleOAuth] ID token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Google ID token verification failed: {str(e)}",
            )

        # 1. Validate issuer
        iss = id_info.get("iss")
        if iss not in GOOGLE_ISSUERS:
            logger.warning(f"[GoogleOAuth] Invalid token issuer: {iss}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Google token issuer: {iss}",
            )

        # 2. Validate email is present and verified
        email = id_info.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google account did not provide an email address.",
            )

        if not id_info.get("email_verified", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Google account email address is not verified.",
            )

        # 3. Validate subject identifier (sub)
        sub = id_info.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google account did not provide a stable subject identifier (sub).",
            )

        return id_info

    def _generate_unique_username(self, email: str, name: Optional[str] = None) -> str:
        """Derive a unique, URL-safe username from email or display name."""
        base = ""
        if name:
            clean_name = "".join(c for c in name.lower() if c.isalnum() or c in ("_", "-")).strip()
            if len(clean_name) >= 3:
                base = clean_name[:20]

        if not base:
            email_prefix = email.split("@")[0].lower()
            clean_prefix = "".join(c for c in email_prefix if c.isalnum() or c in ("_", "-")).strip()
            base = clean_prefix[:20] if len(clean_prefix) >= 3 else f"user_{secrets.token_hex(4)}"

        # Check availability
        candidate = base
        counter = 1
        while self.user_repo.get_by_username(candidate) is not None:
            suffix = f"_{counter}"
            candidate = f"{base[:25 - len(suffix)]}{suffix}"
            counter += 1

        return candidate

    def authenticate_or_register_google_user(self, id_info: Dict[str, Any]) -> Tuple[User, bool]:
        """
        Authenticates an existing Google-linked user, or creates a new user.
        If an account with this email already exists but is not linked to this Google sub,
        raises AccountCollisionException to prevent unauthorized account takeover.
        """
        sub = str(id_info["sub"]).strip()
        email = str(id_info["email"]).strip().lower()
        name = id_info.get("name") or ""
        picture = id_info.get("picture")

        # 1. Check if this Google sub is already linked
        existing_user = self.identity_service.find_user_by_provider_sub("google", sub)
        if existing_user:
            if not existing_user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is deactivated.",
                )
            # Update avatar if missing and provided by Google
            if picture and not existing_user.avatar_url:
                try:
                    existing_user.avatar_url = picture
                    self.db.commit()
                except Exception:
                    self.db.rollback()
            return existing_user, False

        # 2. Check if a user with this email already exists (Collision check)
        user_by_email = self.user_repo.get_by_email(email)
        if user_by_email:
            # Email collision: An existing account with this email exists with password auth!
            # REQUIREMENT: "Do not automatically link accounts solely because their email addresses match.
            # Require authentication to the existing account before linking another identity."
            logger.warning(
                f"[GoogleOAuth] Account collision: Email '{email}' exists but is not linked to Google sub '{sub}'."
            )
            raise AccountCollisionException(email=email, sub=sub, name=name)

        # 3. Create a brand new user
        username = self._generate_unique_username(email, name)
        # Unusable secure placeholder password hash for OAuth-only users
        unusable_pw = f"!oauth_google_{secrets.token_urlsafe(32)}"

        try:
            new_user = self.user_repo.create(
                username=username,
                email=email,
                password=unusable_pw,
                display_name=name or username,
                avatar_url=picture,
                bio="Fashion enthusiast on TailorBird",
            )
            # Set explicit OAuth sentinel hash to identify OAuth-only accounts
            new_user.password_hash = unusable_pw
            self.db.commit()
            self.db.refresh(new_user)

            # Link Google identity
            self.identity_service.link_identity(
                user_id=new_user.id,
                provider="google",
                provider_user_id=sub,
                email=email,
            )
            logger.info(f"[GoogleOAuth] Successfully registered new user '{username}' ({email}) via Google.")
            return new_user, True
        except Exception as e:
            self.db.rollback()
            logger.error(f"[GoogleOAuth] Failed to create new Google user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create user account from Google authentication.",
            )

    def link_google_account_to_user(
        self,
        user_id: UUID,
        id_info: Dict[str, Any],
    ) -> None:
        """Link Google OAuth identity to an already-authenticated user."""
        sub = str(id_info["sub"]).strip()
        email = str(id_info.get("email", "")).strip().lower()

        # Check if Google sub is already linked to another user
        existing_owner = self.identity_service.find_user_by_provider_sub("google", sub)
        if existing_owner:
            if existing_owner.id == user_id:
                return  # already linked to this user
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This Google account is already linked to another TailorBird profile.",
            )

        self.identity_service.link_identity(
            user_id=user_id,
            provider="google",
            provider_user_id=sub,
            email=email,
        )
