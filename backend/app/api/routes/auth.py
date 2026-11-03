import logging
import os
from typing import Optional
from urllib.parse import quote, urlsplit, parse_qsl
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from jose import jwt
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.core.config import settings
from app.core.security import AUTH_COOKIE_NAME, create_access_token
from app.core.rate_limiter import RateLimit
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    Token,
    GoogleAuthUrlResponse,
    GoogleExchangeRequest,
    GoogleExchangeResponse,
    GoogleLinkRequest,
    GoogleStatusResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.services.google_oauth_service import (
    GoogleOAuthService,
    store_exchange_ticket,
    consume_exchange_ticket,
    AccountCollisionException,
    is_allowed_frontend_origin,
)
from app.services.user_identity_service import UserIdentityService
from app.models.user import User
from app.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_MAX_AGE = 60 * 60 * 24  # 1 day; JWT expiry still governs real validity


def _is_production() -> bool:
    return settings.APP_ENV.lower() in ("production", "prod") or bool(os.getenv("RENDER"))


def _set_session_cookie(response: Response, token: str) -> None:
    """Set the HttpOnly session cookie (browser transport for the JWT)."""
    is_prod = _is_production()
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    is_prod = _is_production()
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
    )


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimit(requests=10, window=3600, scope="register"))],
)
def register(request: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    service = AuthService(db)
    user, token = service.register(
        username=request.username,
        email=request.email,
        password=request.password,
        display_name=request.display_name,
        bio=request.bio,
        profile_image_url=request.profile_image_url,
        location=request.location,
    )
    _set_session_cookie(response, token)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
    }


@router.post(
    "/login",
    response_model=Token,
    dependencies=[Depends(RateLimit(requests=10, window=60, scope="login"))],
)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    service = AuthService(db)
    user, token = service.authenticate_user(
        username_or_email=request.username_or_email,
        password=request.password,
    )
    _set_session_cookie(response, token)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = UserService(db)
    return service.get_by_username(current_user.username, viewer_id=current_user.id)


@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user)):
    _clear_session_cookie(response)
    return {"message": "Successfully logged out"}


# ==============================================================================
# Google OAuth 2.0 / OpenID Connect Endpoints
# ==============================================================================

@router.get("/google/url", response_model=GoogleAuthUrlResponse)
def get_google_auth_url(
    request: Request,
    destination: str = "/home",
    action: str = "login",
    frontend_url: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Generate a Google OAuth 2.0 authorization URL with a cryptographically signed state token.
    Allows frontend clients to initiate redirect with clean UI feedback.
    """
    service = GoogleOAuthService(db)
    user_id = current_user.id if current_user else None

    # Detect client frontend origin if not explicitly provided
    resolved_frontend = frontend_url
    if not resolved_frontend:
        origin = request.headers.get("origin")
        if not origin:
            referer = request.headers.get("referer")
            if referer:
                p = urlsplit(referer)
                origin = f"{p.scheme}://{p.netloc}"
        resolved_frontend = origin

    url = service.generate_authorization_url(
        destination=destination,
        action=action,
        user_id=user_id,
        frontend_url=resolved_frontend,
        request=request,
    )
    parsed = urlsplit(url)
    state = dict(parse_qsl(parsed.query)).get("state", "")
    return {"authorization_url": url, "state": state}


@router.get("/google/login")
def google_login_redirect(
    request: Request,
    destination: str = "/home",
    action: str = "login",
    frontend_url: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Direct 302 browser redirect to Google's OAuth authorization endpoint."""
    service = GoogleOAuthService(db)
    user_id = current_user.id if current_user else None

    resolved_frontend = frontend_url
    if not resolved_frontend:
        origin = request.headers.get("origin")
        if not origin:
            referer = request.headers.get("referer")
            if referer:
                p = urlsplit(referer)
                origin = f"{p.scheme}://{p.netloc}"
        resolved_frontend = origin

    url = service.generate_authorization_url(
        destination=destination,
        action=action,
        user_id=user_id,
        frontend_url=resolved_frontend,
        request=request,
    )
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get("/google/callback")
async def google_oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Handle Google OAuth callback:
    1. Validates user consent / cancellation.
    2. Validates CSRF state parameter.
    3. Exchanges authorization code with Google token endpoint.
    4. Validates Google ID token signatures, audience, issuer, expiry, and email verification.
    5. Authenticates existing user, creates new account, or prevents unauthorized account takeover on email collision.
    6. Issues a secure, single-use exchange ticket and sets HttpOnly session cookie.
    """
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    if state:
        try:
            unverified = jwt.get_unverified_claims(state)
            candidate_base = unverified.get("frontend_url")
            if candidate_base and is_allowed_frontend_origin(candidate_base):
                frontend_base = candidate_base.rstrip("/")
        except Exception:
            pass

    # 1. User cancellation or provider error
    if error:
        logger.info(f"[GoogleOAuth] Provider returned error: {error} ({error_description})")
        err_msg = quote(error_description or "Google sign-in was cancelled.")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=cancelled&message={err_msg}",
            status_code=status.HTTP_302_FOUND,
        )

    if not code or not state:
        logger.warning("[GoogleOAuth] Callback invoked without code or state parameter.")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=invalid_request&message=Missing+code+or+state+parameter.",
            status_code=status.HTTP_302_FOUND,
        )

    service = GoogleOAuthService(db)

    # 2. Validate state parameter
    try:
        state_data = service.verify_state(state)
    except HTTPException as he:
        logger.warning(f"[GoogleOAuth] State validation failed: {he.detail}")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=invalid_state&message=Invalid+or+expired+session.+Please+try+again.",
            status_code=status.HTTP_302_FOUND,
        )

    # Use cryptographically verified frontend origin if present
    state_frontend = state_data.get("frontend_url")
    if state_frontend and is_allowed_frontend_origin(state_frontend):
        frontend_base = state_frontend.rstrip("/")

    destination = state_data.get("dest") or "/home"
    action = state_data.get("action") or "login"
    linking_user_id = state_data.get("user_id")

    # Resolve matching redirect_uri used during authorization
    redirect_uri = state_data.get("redirect_uri") or service.resolve_redirect_uri(
        frontend_url=state_frontend,
        request=request,
    )

    # Handle Google Calendar connection callback
    if action == "connect_calendar" and linking_user_id:
        try:
            from app.services.google_calendar_service import GoogleCalendarService
            cal_service = GoogleCalendarService(db)
            cal_user_uuid = UUID(linking_user_id)
            await cal_service.complete_connection(cal_user_uuid, code, redirect_uri=redirect_uri)
            try:
                await cal_service.sync_events(cal_user_uuid)
            except Exception as se:
                logger.warning(f"[GoogleCalendar] Initial sync warning: {se}")
            return RedirectResponse(
                url=f"{frontend_base}/calendar?google_calendar_connected=true",
                status_code=status.HTTP_302_FOUND,
            )
        except Exception as e:
            logger.error(f"[GoogleCalendar] Failed to complete calendar connection: {e}")
            err_msg = quote(str(e) or "Failed to connect Google Calendar.")
            return RedirectResponse(
                url=f"{frontend_base}/calendar?error=connection_failed&message={err_msg}",
                status_code=status.HTTP_302_FOUND,
            )

    # 3. Exchange authorization code securely with Google
    try:
        token_data = await service.exchange_code_for_tokens(code, redirect_uri=redirect_uri)
    except HTTPException as he:
        logger.error(f"[GoogleOAuth] Token exchange failed: {he.detail}")
        err_msg = quote(he.detail or "Failed to exchange authorization code with Google.")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=token_exchange_failed&message={err_msg}",
            status_code=status.HTTP_302_FOUND,
        )

    id_token_str = token_data.get("id_token")
    if not id_token_str:
        logger.error("[GoogleOAuth] No ID token returned by Google.")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=missing_id_token&message=Google+did+not+provide+an+identity+token.",
            status_code=status.HTTP_302_FOUND,
        )

    # 4. Verify ID token signature, issuer, audience, and claims
    try:
        id_info = service.verify_id_token(id_token_str)
    except HTTPException as he:
        logger.warning(f"[GoogleOAuth] ID token verification failed: {he.detail}")
        err_msg = quote(he.detail or "Invalid Google ID token.")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=invalid_token&message={err_msg}",
            status_code=status.HTTP_302_FOUND,
        )

    # 5. Handle account linking for logged-in user
    if action == "link" and linking_user_id:
        try:
            target_uid = UUID(linking_user_id)
            service.link_google_account_to_user(target_uid, id_info)
            return RedirectResponse(
                url=f"{frontend_base}/settings?google_linked=true",
                status_code=status.HTTP_302_FOUND,
            )
        except HTTPException as he:
            err_msg = quote(he.detail or "Failed to link Google account.")
            return RedirectResponse(
                url=f"{frontend_base}/settings?error=link_failed&message={err_msg}",
                status_code=status.HTTP_302_FOUND,
            )

    # 6. Authenticate existing or register new user
    try:
        user, is_new = service.authenticate_or_register_google_user(id_info)
    except AccountCollisionException as ace:
        # Existing email/password user collision
        logger.info(f"[GoogleOAuth] Collision detected for {ace.email}. Prompting user to authenticate.")
        enc_email = quote(ace.email)
        enc_msg = quote("An account with this email already exists. Please sign in with your password to link Google.")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=account_collision&email={enc_email}&message={enc_msg}",
            status_code=status.HTTP_302_FOUND,
        )
    except HTTPException as he:
        err_msg = quote(he.detail or "Authentication failed.")
        return RedirectResponse(
            url=f"{frontend_base}/login?error=auth_failed&message={err_msg}",
            status_code=status.HTTP_302_FOUND,
        )

    # 7. Generate single-use exchange ticket (60s TTL)
    target_dest = "/onboarding" if is_new else destination
    ticket = store_exchange_ticket(
        user_id=str(user.id),
        username=user.username,
        destination=target_dest,
    )

    # 8. Set session cookie and redirect to frontend callback receiver
    token = create_access_token(subject=str(user.id))
    redirect_url = f"{frontend_base}/auth/callback?ticket={ticket}&destination={quote(target_dest)}"
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    _set_session_cookie(response, token)
    return response


@router.post("/google/exchange", response_model=GoogleExchangeResponse)
def exchange_google_ticket(
    request: GoogleExchangeRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Exchange single-use temporary ticket for persistent JWT access token.
    Prevents long-lived access tokens from being exposed in browser URL history.
    """
    ticket_data = consume_exchange_ticket(request.ticket)
    if not ticket_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already-consumed exchange ticket.",
        )

    user_id_str = ticket_data["user_id"]
    user_repo = UserRepository(db)
    try:
        user = user_repo.get_by_id(UUID(user_id_str))
    except Exception:
        user = None

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found.",
        )

    token = create_access_token(subject=str(user.id))
    _set_session_cookie(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
        "destination": ticket_data.get("destination", "/home"),
    }


@router.post("/google/link", response_model=Token)
async def link_google_with_credentials(
    request: GoogleLinkRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Safely link a Google identity to an existing email/password account after verifying password.
    Requires user's current password to prevent unauthorized account takeover.
    """
    auth_service = AuthService(db)
    user, token = auth_service.authenticate_user(
        username_or_email=request.username_or_email,
        password=request.password,
    )

    google_service = GoogleOAuthService(db)
    id_info = None

    if request.id_token:
        id_info = google_service.verify_id_token(request.id_token)
    elif request.code:
        token_data = await google_service.exchange_code_for_tokens(request.code)
        id_token_str = token_data.get("id_token")
        if id_token_str:
            id_info = google_service.verify_id_token(id_token_str)

    if not id_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing valid Google id_token or authorization code.",
        )

    google_service.link_google_account_to_user(user.id, id_info)
    _set_session_cookie(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
    }


@router.get("/google/status", response_model=GoogleStatusResponse)
def get_google_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the current authenticated user has linked a Google account."""
    ident_service = UserIdentityService(db)
    identities = ident_service.get_identities_for_user(current_user.id)
    is_linked = any(i.get("provider") == "google" for i in identities)
    return {
        "is_google_linked": is_linked,
        "identities": identities,
    }


@router.delete("/google/unlink")
def unlink_google_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unlink Google identity from current user if they have another login method."""
    if current_user.password_hash.startswith("!oauth_google_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unlink Google account without first setting a password.",
        )

    ident_service = UserIdentityService(db)
    unlinked = ident_service.unlink_identity(current_user.id, "google")
    return {"message": "Google account unlinked successfully" if unlinked else "No Google account was linked"}
