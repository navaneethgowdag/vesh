import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_routing_contract_prefixes():
    """
    Verify that application routes MUST be accessed via /api/v1 prefix,
    and calls to un-prefixed /auth/login or /weather/current return 404.
    """
    # Without /api/v1 prefix -> 404
    resp_unprefixed_login = client.post("/auth/login", json={"username_or_email": "x", "password": "y"})
    assert resp_unprefixed_login.status_code == 404, f"Expected 404 for unprefixed route, got {resp_unprefixed_login.status_code}"

    resp_unprefixed_weather = client.get("/weather/current?city=Paris")
    assert resp_unprefixed_weather.status_code == 404, f"Expected 404 for unprefixed weather, got {resp_unprefixed_weather.status_code}"

    # With /api/v1 prefix -> Handled by FastAPI router (401 for invalid credentials)
    resp_prefixed_login = client.post("/api/v1/auth/login", json={"username_or_email": "nonexistent@example.com", "password": "WrongPassword123!"})
    assert resp_prefixed_login.status_code == 401
    assert "Incorrect" in resp_prefixed_login.json()["detail"] or "Invalid" in resp_prefixed_login.json()["detail"]


def test_auth_registration_login_and_session_lifecycle():
    """
    Verify full authentication lifecycle against Neon PostgreSQL:
    registration, duplicate prevention, login, Bearer token auth, cookie auth, logout.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    username = f"auth_test_{unique_suffix}"
    email = f"auth_test_{unique_suffix}@example.com"
    password = "SecurePassword123!"
    display_name = f"Test User {unique_suffix}"

    # 1. Register new user
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": display_name,
        },
    )
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
    user_data = reg_resp.json()
    assert user_data["username"] == username
    assert "access_token" in user_data
    assert user_data["token_type"] == "bearer"

    # 2. Duplicate registration returns 409 Conflict
    dup_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": display_name,
        },
    )
    assert dup_resp.status_code == 409, f"Expected 409 for duplicate registration, got {dup_resp.status_code}"

    # 3. Login with credentials
    login_resp = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": email,
            "password": password,
        },
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"
    assert "stylesphere_session" in login_resp.cookies

    access_token = login_data["access_token"]

    # 4. Access protected /auth/me with Bearer token
    fresh_client = TestClient(app)  # fresh client without cookies
    auth_resp = fresh_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert auth_resp.status_code == 200, f"/auth/me failed with Bearer token: {auth_resp.text}"
    me_data = auth_resp.json()
    assert me_data["username"] == username
    assert me_data["email"] == email

    # 5. Access protected /auth/me using HttpOnly session cookie
    cookie_client = TestClient(app)
    cookie_client.cookies.set("stylesphere_session", login_resp.cookies["stylesphere_session"])
    cookie_auth_resp = cookie_client.get("/api/v1/auth/me")
    assert cookie_auth_resp.status_code == 200, f"/auth/me failed with cookie: {cookie_auth_resp.text}"
    assert cookie_auth_resp.json()["username"] == username

    # 6. Unauthenticated request returns 401
    unauth_resp = fresh_client.get("/api/v1/auth/me")
    assert unauth_resp.status_code == 401

    # 7. Logout revokes/clears session
    logout_resp = cookie_client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200


def test_weather_endpoint_and_validation():
    """
    Verify weather endpoint contract under /api/v1/weather/current.
    """
    # 1. Successful fetch for a known city
    weather_resp = client.get("/api/v1/weather/current?city=Paris")
    assert weather_resp.status_code == 200, f"Weather fetch failed: {weather_resp.text}"
    w = weather_resp.json()
    assert w["city"] == "Paris"
    assert "temp" in w
    assert "condition" in w
    assert "humidity" in w
    assert "wind_speed" in w

    # 2. Empty query without city or coordinates returns 400
    empty_resp = client.get("/api/v1/weather/current")
    assert empty_resp.status_code == 400, f"Expected 400 for missing city and coordinates, got {empty_resp.status_code}"
