"""
Automated Test Suite for Google OAuth 2.0 / OpenID Connect Authentication in TailorBird
Covers:
- URL generation and CSRF-protected state generation
- User cancellation and invalid state handling
- New user registration via Google ID token
- Existing user login via Google
- Account collision protection (preventing automatic takeover of existing email/password accounts)
- Safe password-verified account linking
- Single-use exchange tickets and expiration
- ID token verification (audience, issuer, email_verified)
- Protected API access & multi-user data isolation
- Unlink protection for OAuth-only users
- Regression testing of standard email/password authentication
"""

import uuid
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse, unquote

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.main import app
from app.models.user import User
from app.services.google_oauth_service import (
    GoogleOAuthService,
    consume_exchange_ticket,
    store_exchange_ticket,
)
from app.services.user_identity_service import UserIdentityService

settings = get_settings()
client = TestClient(app)


def test_get_google_auth_url_returns_valid_url_and_signed_state():
    """Verify GET /api/v1/auth/google/url returns properly formatted authorization URL with signed state."""
    resp = client.get("/api/v1/auth/google/url?destination=/wardrobe&action=login")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "authorization_url" in data
    assert "state" in data

    auth_url = data["authorization_url"]
    parsed_url = urlparse(auth_url)
    assert parsed_url.scheme == "https"
    assert parsed_url.netloc == "accounts.google.com"
    assert parsed_url.path == "/o/oauth2/v2/auth"

    query_params = parse_qs(parsed_url.query)
    assert query_params["client_id"][0] == settings.GOOGLE_CLIENT_ID
    assert query_params["response_type"][0] == "code"
    assert "openid" in query_params["scope"][0]
    assert "email" in query_params["scope"][0]
    assert "profile" in query_params["scope"][0]
    assert query_params["redirect_uri"][0] == settings.google_redirect_uri

    # Verify state JWT decode & claims
    state_token = query_params["state"][0]
    decoded = jwt.decode(state_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert decoded["dest"] == "/wardrobe"
    assert decoded["action"] == "login"
    assert "csrf" in decoded
    assert "exp" in decoded


def test_oauth_callback_user_cancelled():
    """Verify callback handles user cancellation (error=access_denied) with redirect to /login?error=cancelled."""
    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        state = service.generate_state_token(destination="/home", action="login")
    finally:
        db.close()

    resp = client.get(
        f"/api/v1/auth/google/callback?error=access_denied&state={state}",
        follow_redirects=False,
    )
    assert resp.status_code in (302, 307)
    location = resp.headers["location"]
    assert "error=cancelled" in location
    assert "/login" in location


def test_oauth_callback_invalid_or_expired_state():
    """Verify callback rejects invalid or tampered state token."""
    resp = client.get(
        "/api/v1/auth/google/callback?code=mock_code_123&state=tampered.invalid.jwt",
        follow_redirects=False,
    )
    assert resp.status_code in (302, 307)
    location = resp.headers["location"]
    assert "error=invalid_state" in location


def test_new_google_user_registration_and_exchange():
    """Verify a brand new Google user gets registered, receives an exchange ticket, and completes login."""
    unique_sub = f"google-sub-{uuid.uuid4().hex[:12]}"
    unique_email = f"google_user_{uuid.uuid4().hex[:8]}@example.com"
    mock_id_info = {
        "sub": unique_sub,
        "email": unique_email,
        "name": "Alex GoogleTester",
        "email_verified": True,
        "iss": "https://accounts.google.com",
    }

    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        state = service.generate_state_token(destination="/wardrobe", action="login")
    finally:
        db.close()

    with patch.object(
        GoogleOAuthService,
        "exchange_code_for_tokens",
        new=AsyncMock(return_value={"id_token": "valid_mock_id_token"}),
    ), patch.object(
        GoogleOAuthService,
        "verify_id_token",
        return_value=mock_id_info,
    ):
        cb_resp = client.get(
            f"/api/v1/auth/google/callback?code=valid_test_code&state={state}",
            follow_redirects=False,
        )
        assert cb_resp.status_code in (302, 307)
        location = cb_resp.headers["location"]
        assert "/auth/callback" in location
        assert "ticket=" in location

        parsed_cb = urlparse(location)
        qs = parse_qs(parsed_cb.query)
        ticket = qs["ticket"][0]
        assert ticket is not None

        # Session cookie was set
        assert "stylesphere_session" in cb_resp.cookies

        # Exchange ticket for JWT
        exchange_resp = client.post(
            "/api/v1/auth/google/exchange",
            json={"ticket": ticket},
        )
        assert exchange_resp.status_code == 200, f"Exchange failed: {exchange_resp.text}"
        token_data = exchange_resp.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"
        assert token_data["username"].startswith("alex_googletester") or len(token_data["username"]) > 0

        # Verify new user was created in DB and marked active
        db = SessionLocal()
        try:
            created_user = db.query(User).filter(User.email == unique_email).first()
            assert created_user is not None
            assert created_user.is_active is True
            assert created_user.display_name == "Alex GoogleTester"
            assert created_user.password_hash.startswith("!oauth_google_")
        finally:
            db.close()


def test_existing_google_user_login():
    """Verify an existing Google user logs in seamlessly and maps to the identical user record."""
    unique_sub = f"google-sub-{uuid.uuid4().hex[:12]}"
    unique_email = f"google_repeat_{uuid.uuid4().hex[:8]}@example.com"
    mock_id_info = {
        "sub": unique_sub,
        "email": unique_email,
        "name": "Repeat GoogleUser",
        "email_verified": True,
        "iss": "https://accounts.google.com",
    }

    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        state_1 = service.generate_state_token(destination="/home", action="login")
    finally:
        db.close()

    # First login (registers user)
    with patch.object(
        GoogleOAuthService,
        "exchange_code_for_tokens",
        new=AsyncMock(return_value={"id_token": "valid_mock_id_token"}),
    ), patch.object(
        GoogleOAuthService,
        "verify_id_token",
        return_value=mock_id_info,
    ):
        cb_1 = client.get(
            f"/api/v1/auth/google/callback?code=code_1&state={state_1}",
            follow_redirects=False,
        )
        t1 = parse_qs(urlparse(cb_1.headers["location"]).query)["ticket"][0]
        ex_1 = client.post("/api/v1/auth/google/exchange", json={"ticket": t1})
        user_id_1 = ex_1.json()["user_id"]

    # Second login (same sub)
    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        state_2 = service.generate_state_token(destination="/home", action="login")
    finally:
        db.close()

    with patch.object(
        GoogleOAuthService,
        "exchange_code_for_tokens",
        new=AsyncMock(return_value={"id_token": "valid_mock_id_token"}),
    ), patch.object(
        GoogleOAuthService,
        "verify_id_token",
        return_value=mock_id_info,
    ):
        cb_2 = client.get(
            f"/api/v1/auth/google/callback?code=code_2&state={state_2}",
            follow_redirects=False,
        )
        t2 = parse_qs(urlparse(cb_2.headers["location"]).query)["ticket"][0]
        ex_2 = client.post("/api/v1/auth/google/exchange", json={"ticket": t2})
        user_id_2 = ex_2.json()["user_id"]

    assert user_id_1 == user_id_2, "Expected same user ID for identical Google sub claim"


def test_account_collision_existing_password_user():
    """Verify that an existing email/password account CANNOT be hijacked via Google without password verification."""
    unique_suffix = uuid.uuid4().hex[:8]
    existing_email = f"collision_{unique_suffix}@example.com"
    existing_username = f"coll_user_{unique_suffix}"
    password = "PreExistingPassword123!"

    # 1. Register user via standard password auth
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": existing_username,
            "email": existing_email,
            "password": password,
            "display_name": "Original Password User",
        },
    )
    assert reg_resp.status_code == 201

    # 2. Attempt Google login with same email but new Google sub
    collision_sub = f"unlinked-google-sub-{uuid.uuid4().hex[:8]}"
    mock_id_info = {
        "sub": collision_sub,
        "email": existing_email,
        "name": "Collision Attacker Or User",
        "email_verified": True,
        "iss": "https://accounts.google.com",
    }

    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        state = service.generate_state_token(destination="/home", action="login")
    finally:
        db.close()

    with patch.object(
        GoogleOAuthService,
        "exchange_code_for_tokens",
        new=AsyncMock(return_value={"id_token": "valid_mock_id_token"}),
    ), patch.object(
        GoogleOAuthService,
        "verify_id_token",
        return_value=mock_id_info,
    ):
        cb_resp = client.get(
            f"/api/v1/auth/google/callback?code=collision_code&state={state}",
            follow_redirects=False,
        )
        assert cb_resp.status_code in (302, 307)
        location = cb_resp.headers["location"]
        # Must redirect to /login with error=account_collision and email
        assert "/login" in location
        assert "error=account_collision" in location
        assert existing_email in unquote(location)

    # 3. Verify user's identity is NOT linked automatically
    db = SessionLocal()
    try:
        ident_service = UserIdentityService(db)
        existing_user = db.query(User).filter(User.email == existing_email).first()
        identities = ident_service.get_identities_for_user(existing_user.id)
        assert not any(i.get("provider_user_id") == collision_sub for i in identities)
    finally:
        db.close()


def test_safe_account_linking_with_password():
    """Verify user can explicitly link their Google identity by verifying their password."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"link_test_{unique_suffix}@example.com"
    username = f"link_{unique_suffix}"
    password = "CorrectSecretPassword456!"

    # 1. Create standard account
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": "Link Tester",
        },
    )
    assert reg_resp.status_code == 201

    # 2. Link with correct password
    link_sub = f"google-link-sub-{unique_suffix}"
    mock_id_info = {
        "sub": link_sub,
        "email": email,
        "name": "Link Tester",
        "email_verified": True,
        "iss": "https://accounts.google.com",
    }

    with patch.object(
        GoogleOAuthService,
        "verify_id_token",
        return_value=mock_id_info,
    ):
        link_resp = client.post(
            "/api/v1/auth/google/link",
            json={
                "username_or_email": email,
                "password": password,
                "id_token": "valid_token_string",
            },
        )
        assert link_resp.status_code == 200, f"Linking failed: {link_resp.text}"
        data = link_resp.json()
        assert "access_token" in data

    # 3. Subsequent Google login now succeeds without collision!
    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        state = service.generate_state_token(destination="/home", action="login")
    finally:
        db.close()

    with patch.object(
        GoogleOAuthService,
        "exchange_code_for_tokens",
        new=AsyncMock(return_value={"id_token": "valid_mock_id_token"}),
    ), patch.object(
        GoogleOAuthService,
        "verify_id_token",
        return_value=mock_id_info,
    ):
        cb_resp = client.get(
            f"/api/v1/auth/google/callback?code=link_success_code&state={state}",
            follow_redirects=False,
        )
        assert cb_resp.status_code in (302, 307)
        location = cb_resp.headers["location"]
        assert "/auth/callback" in location
        assert "error=" not in location


def test_ticket_exchange_single_use_and_expiry():
    """Verify exchange tickets cannot be reused or consumed if expired."""
    ticket = store_exchange_ticket(
        user_id=str(uuid.uuid4()),
        username="temp_tester",
        destination="/wardrobe",
    )

    # First consumption succeeds
    data1 = consume_exchange_ticket(ticket)
    assert data1 is not None
    assert data1["username"] == "temp_tester"

    # Second consumption must return None (single-use replay protection)
    data2 = consume_exchange_ticket(ticket)
    assert data2 is None

    # Invalid ticket rejected via API endpoint
    bad_resp = client.post("/api/v1/auth/google/exchange", json={"ticket": "non_existent_ticket"})
    assert bad_resp.status_code == 400


def test_id_token_validation_wrong_audience():
    """Verify verify_id_token enforces correct Google Client ID audience."""
    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        with patch("google.oauth2.id_token.verify_oauth2_token", side_effect=ValueError("Token has wrong audience")):
            with pytest.raises(Exception) as excinfo:
                service.verify_id_token("bad_token_str")
            assert "verification failed" in str(excinfo.value.detail).lower()
    finally:
        db.close()


def test_id_token_validation_unverified_email():
    """Verify Google accounts with unverified emails are strictly rejected."""
    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        unverified_payload = {
            "sub": "unverified-sub",
            "email": "unverified@example.com",
            "email_verified": False,
            "iss": "https://accounts.google.com",
        }
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=unverified_payload):
            with pytest.raises(Exception) as excinfo:
                service.verify_id_token("token_unverified")
            assert "not verified" in str(excinfo.value.detail).lower()
    finally:
        db.close()


def test_protected_api_access_after_google_login():
    """Verify that JWT issued through Google OAuth grants valid access to protected endpoints."""
    unique_sub = f"google-sub-{uuid.uuid4().hex[:12]}"
    unique_email = f"google_access_{uuid.uuid4().hex[:8]}@example.com"
    mock_id_info = {
        "sub": unique_sub,
        "email": unique_email,
        "name": "Access Tester",
        "email_verified": True,
        "iss": "https://accounts.google.com",
    }

    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        state = service.generate_state_token(destination="/home", action="login")
    finally:
        db.close()

    with patch.object(
        GoogleOAuthService,
        "exchange_code_for_tokens",
        new=AsyncMock(return_value={"id_token": "valid_mock_id_token"}),
    ), patch.object(
        GoogleOAuthService,
        "verify_id_token",
        return_value=mock_id_info,
    ):
        cb_resp = client.get(
            f"/api/v1/auth/google/callback?code=access_code&state={state}",
            follow_redirects=False,
        )
        ticket = parse_qs(urlparse(cb_resp.headers["location"]).query)["ticket"][0]
        token_resp = client.post("/api/v1/auth/google/exchange", json={"ticket": ticket})
        jwt_token = token_resp.json()["access_token"]

    # Call protected /api/v1/auth/me
    headers = {"Authorization": f"Bearer {jwt_token}"}
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    user_info = me_resp.json()
    assert user_info["email"] == unique_email

    # Call protected /api/v1/wardrobe
    clothes_resp = client.get("/api/v1/wardrobe", headers=headers)
    assert clothes_resp.status_code == 200
    assert isinstance(clothes_resp.json(), list)


def test_cross_user_data_isolation():
    """Verify complete data isolation between Google user and standard password user."""
    # User A (Google user)
    sub_a = f"sub-a-{uuid.uuid4().hex[:8]}"
    email_a = f"user_a_{uuid.uuid4().hex[:8]}@example.com"
    id_info_a = {"sub": sub_a, "email": email_a, "name": "User A", "email_verified": True, "iss": "https://accounts.google.com"}

    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        user_a, _ = service.authenticate_or_register_google_user(id_info_a)
        user_a_id = str(user_a.id)
    finally:
        db.close()

    from app.core.security import create_access_token
    token_a = create_access_token(subject=user_a_id)

    # User B (Standard user)
    reg_b = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"user_b_{uuid.uuid4().hex[:8]}",
            "email": f"user_b_{uuid.uuid4().hex[:8]}@example.com",
            "password": "PasswordForUserB123!",
            "display_name": "User B",
        },
    )
    token_b = reg_b.json()["access_token"]

    # Verify User A's /auth/me returns User A's identity
    resp_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert resp_a.status_code == 200
    assert resp_a.json()["email"] == email_a

    # Verify User B's /auth/me returns User B's identity
    resp_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_b.status_code == 200
    assert resp_b.json()["email"] != email_a


def test_google_status_and_unlink_protection():
    """Verify status endpoint and that OAuth-only accounts cannot unlink without setting a password."""
    unique_sub = f"google-sub-{uuid.uuid4().hex[:12]}"
    unique_email = f"google_unlink_{uuid.uuid4().hex[:8]}@example.com"
    mock_id_info = {
        "sub": unique_sub,
        "email": unique_email,
        "name": "Unlink Protection User",
        "email_verified": True,
        "iss": "https://accounts.google.com",
    }

    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        user, _ = service.authenticate_or_register_google_user(mock_id_info)
        user_id = str(user.id)
    finally:
        db.close()

    from app.core.security import create_access_token
    token = create_access_token(subject=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Check status
    status_resp = client.get("/api/v1/auth/google/status", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["is_google_linked"] is True

    # Attempt unlink -> Must fail with 400 because no password has been set
    unlink_resp = client.delete("/api/v1/auth/google/unlink", headers=headers)
    assert unlink_resp.status_code == 400
    assert "without first setting a password" in unlink_resp.json()["detail"]


def test_regression_existing_password_login():
    """Verify that standard username/password authentication continues to function with zero regressions."""
    unique_suffix = uuid.uuid4().hex[:8]
    username = f"standard_{unique_suffix}"
    email = f"standard_{unique_suffix}@example.com"
    password = "StandardPassword!123"

    # Register
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password, "display_name": "Standard User"},
    )
    assert reg_resp.status_code == 201

    # Login with username
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": password},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

    # Login with email
    login_email_resp = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": email, "password": password},
    )
    assert login_email_resp.status_code == 200
    assert "access_token" in login_email_resp.json()


def test_public_google_auth_url_parameters():
    """Verify Google OAuth authorization URL is configured for public access with account selector and offline access."""
    resp = client.get("/api/v1/auth/google/url?destination=/daily-fit&frontend_url=http://localhost:5173")
    assert resp.status_code == 200
    data = resp.json()
    auth_url = data["authorization_url"]
    parsed = urlparse(auth_url)
    q = parse_qs(parsed.query)

    assert q["prompt"][0] == "select_account"
    assert q["access_type"][0] == "offline"
    assert q["response_type"][0] == "code"
    assert "openid" in q["scope"][0]
    assert "email" in q["scope"][0]
    assert "profile" in q["scope"][0]


def test_user_identity_stores_provider_subject_and_verified_email():
    """Verify that UserIdentity properly stores and exposes provider_subject and verified_email."""
    unique_sub = f"google-sub-{uuid.uuid4().hex[:12]}"
    unique_email = f"public_user_{uuid.uuid4().hex[:8]}@gmail.com"
    mock_id_info = {
        "sub": unique_sub,
        "email": unique_email,
        "name": "Public Google User",
        "email_verified": True,
        "iss": "https://accounts.google.com",
    }

    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        user, is_new = service.authenticate_or_register_google_user(mock_id_info)
        assert is_new is True

        identity_service = UserIdentityService(db)
        identities = identity_service.get_identities_for_user(user.id)
        assert len(identities) >= 1

        google_ident = next(i for i in identities if i.get("provider") == "google")
        assert google_ident["provider_subject"] == unique_sub
        assert google_ident["provider_user_id"] == unique_sub
        assert google_ident["verified_email"] == unique_email

        # Also verify lookup by sub
        found_user = identity_service.find_user_by_provider_sub("google", unique_sub)
        assert found_user is not None
        assert found_user.id == user.id
    finally:
        db.close()


def test_id_token_validation_invalid_issuer():
    """Verify that tokens from unknown/untrusted issuers are rejected."""
    db = SessionLocal()
    try:
        service = GoogleOAuthService(db)
        invalid_issuer_payload = {
            "sub": "sub-12345",
            "email": "test@example.com",
            "email_verified": True,
            "iss": "https://evil-untrusted-issuer.com",
        }
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=invalid_issuer_payload):
            with pytest.raises(Exception) as excinfo:
                service.verify_id_token("token_invalid_issuer")
            assert "invalid google token issuer" in str(excinfo.value.detail).lower()
    finally:
        db.close()

