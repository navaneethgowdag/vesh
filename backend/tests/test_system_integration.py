import io
import uuid
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_auth_and_user_profile_crud(client):
    """
    Verify complete Authentication and User Profile CRUD:
    - POST /auth/register (201 Created)
    - POST /auth/register duplicate (400 Bad Request)
    - POST /auth/login valid (200 OK + access_token)
    - POST /auth/login invalid credentials (401 Unauthorized)
    - GET /auth/me (200 OK)
    - PATCH /users/me (200 OK)
    - GET /auth/me reflects updated profile (200 OK)
    """
    unique_suffix = uuid.uuid4().hex[:8]
    username = f"user_{unique_suffix}"
    email = f"user_{unique_suffix}@stylesphere.dev"
    password = "TestPassword123!"

    # 1. Register new user
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": "Initial Name",
        },
    )
    assert reg_res.status_code == 201, reg_res.text
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["username"] == username
    assert reg_data["token_type"] == "bearer"

    # 2. Duplicate registration rejected with 409 Conflict (or 400)
    dup_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": "Initial Name",
        },
    )
    assert dup_res.status_code in (400, 409)

    # 3. Valid Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": email, "password": password},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Invalid Password Login rejected with 401
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": email, "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

    # 5. Authenticated /auth/me
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == username

    # 6. Profile update via PATCH /users/me
    patch_res = client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={
            "display_name": "Updated Name",
            "bio": "Minimalist capsule wardrobe enthusiast.",
            "profile_image_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["display_name"] == "Updated Name"
    assert patch_res.json()["bio"] == "Minimalist capsule wardrobe enthusiast."
    assert "https://images.unsplash.com/photo-1534528741775-53994a69daeb" in patch_res.json()["profile_image_url"]

    # 7. Unauthenticated profile update rejected with 401
    client.cookies.clear()
    unauth_patch = client.patch(
        "/api/v1/users/me",
        json={"display_name": "Hacker"},
    )
    assert unauth_patch.status_code == 401


def test_wardrobe_items_crud(client):
    """
    Verify complete Wardrobe Clothing Items CRUD:
    - POST /wardrobe (201 Created)
    - GET /wardrobe (200 OK, includes created item)
    - PATCH /wardrobe/{id} (200 OK)
    - DELETE /wardrobe/{id} (204 No Content)
    - GET /wardrobe/{id} (404 Not Found after deletion)
    """
    unique_suffix = uuid.uuid4().hex[:8]
    user_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"wardrobe_user_{unique_suffix}",
            "email": f"wardrobe_{unique_suffix}@stylesphere.dev",
            "password": "Password123!",
            "display_name": "Wardrobe User",
        },
    )
    token = user_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Clothing Item
    create_res = client.post(
        "/api/v1/wardrobe",
        headers=headers,
        json={
            "name": "Camel Tailored Coat",
            "category": "Outerwear",
            "color": "Beige",
            "style": "Quiet Luxury",
            "season": "Autumn",
            "brand": "Totême",
            "pattern": "Solid",
            "image_url": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea",
            "tags": ["outerwear", "minimal", "beige"],
        },
    )
    assert create_res.status_code == 201, create_res.text
    item = create_res.json()
    item_id = item["id"]
    assert item["name"] == "Camel Tailored Coat"
    assert item["category"] == "Outerwear"

    # 2. List Wardrobe Items
    list_res = client.get("/api/v1/wardrobe", headers=headers)
    assert list_res.status_code == 200
    item_ids = [i["id"] for i in list_res.json()]
    assert item_id in item_ids

    # 3. Update Clothing Item
    update_res = client.patch(
        f"/api/v1/wardrobe/{item_id}",
        headers=headers,
        json={"name": "Camel Double-Breasted Trench", "is_favorite": True},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Camel Double-Breasted Trench"
    assert update_res.json()["is_favorite"] is True

    # 4. Delete Clothing Item
    del_res = client.delete(f"/api/v1/wardrobe/{item_id}", headers=headers)
    assert del_res.status_code == 204

    # 5. Verify Item is Deleted (404)
    get_res = client.get(f"/api/v1/wardrobe/{item_id}", headers=headers)
    assert get_res.status_code == 404


def test_post_and_social_crud_and_security(client):
    """
    Verify complete Post and Social Interaction CRUD:
    - POST /posts (201 Created)
    - POST /posts invalid schema (422 Unprocessable Entity)
    - GET /posts/{id} (200 OK)
    - POST /posts/{id}/like (200 OK)
    - DELETE /posts/{id}/like (200 OK)
    - POST /posts/{id}/comments (201 Created)
    - DELETE /posts/{id} by non-author (403 Forbidden)
    - DELETE /posts/{id} by author (204 No Content)
    - GET /posts/{id} after deletion (404 Not Found)
    """
    s1 = uuid.uuid4().hex[:8]
    s2 = uuid.uuid4().hex[:8]

    # Author
    res1 = client.post(
        "/api/v1/auth/register",
        json={"username": f"author_{s1}", "email": f"a_{s1}@stylesphere.dev", "password": "Password123!"},
    )
    author_headers = {"Authorization": f"Bearer {res1.json()['access_token']}"}

    # Other User
    res2 = client.post(
        "/api/v1/auth/register",
        json={"username": f"other_{s2}", "email": f"o_{s2}@stylesphere.dev", "password": "Password123!"},
    )
    other_headers = {"Authorization": f"Bearer {res2.json()['access_token']}"}

    # 1. Create Post
    post_res = client.post(
        "/api/v1/posts",
        headers=author_headers,
        json={
            "image_url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "caption": "Autumn tailoring and relaxed silhouette.",
            "occasion": "Casual Daily",
            "tags": ["#Tailoring", "#Minimal"],
            "location": "Paris, France",
            "tagged_item_ids": [],
        },
    )
    assert post_res.status_code == 201, post_res.text
    post = post_res.json()
    post_id = post["id"]
    assert post["caption"] == "Autumn tailoring and relaxed silhouette."

    # 2. Invalid Schema returns 422
    bad_post_res = client.post(
        "/api/v1/posts",
        headers=author_headers,
        json={"caption": "Missing required image_url"},
    )
    assert bad_post_res.status_code == 422

    # 3. Get Post by ID
    get_res = client.get(f"/api/v1/posts/{post_id}", headers=author_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == post_id

    # 4. Like & Unlike Post
    like_res = client.post(f"/api/v1/posts/{post_id}/like", headers=other_headers)
    assert like_res.status_code == 200

    unlike_res = client.delete(f"/api/v1/posts/{post_id}/like", headers=other_headers)
    assert unlike_res.status_code == 200

    # 5. Comment on Post
    comment_res = client.post(
        f"/api/v1/posts/{post_id}/comments",
        headers=other_headers,
        json={"text": "Impeccable silhouette and palette!"},
    )
    assert comment_res.status_code == 201

    # 6. Unauthorized deletion attempt by other user rejected with 403
    forbidden_del = client.delete(f"/api/v1/posts/{post_id}", headers=other_headers)
    assert forbidden_del.status_code == 403

    # 7. Author deletes post
    auth_del = client.delete(f"/api/v1/posts/{post_id}", headers=author_headers)
    assert auth_del.status_code == 204

    # 8. Post is gone (404)
    gone_res = client.get(f"/api/v1/posts/{post_id}", headers=author_headers)
    assert gone_res.status_code == 404


def test_saved_collections_and_media_upload(client):
    """
    Verify Collections CRUD and Media Upload:
    - POST /saved/collections (201 Created)
    - GET /saved/collections (200 OK)
    - POST /media/upload (200 OK, WebP conversion verified)
    """
    s = uuid.uuid4().hex[:8]
    u_res = client.post(
        "/api/v1/auth/register",
        json={"username": f"collector_{s}", "email": f"c_{s}@stylesphere.dev", "password": "Password123!"},
    )
    headers = {"Authorization": f"Bearer {u_res.json()['access_token']}"}

    # 1. Create Collection
    col_res = client.post(
        "/api/v1/saved/collections",
        headers=headers,
        json={"name": "Autumn Capsule 2026", "description": "Neutrals and layered outerwear"},
    )
    assert col_res.status_code == 201, col_res.text
    col = col_res.json()
    assert col["name"] == "Autumn Capsule 2026"

    # 2. List Collections
    list_cols = client.get("/api/v1/saved/collections", headers=headers)
    assert list_cols.status_code == 200
    col_names = [c["name"] for c in list_cols.json()]
    assert "Autumn Capsule 2026" in col_names

    # 3. Media Upload with Real Pillow Image
    img_buffer = io.BytesIO()
    test_img = Image.new("RGB", (300, 400), color=(180, 140, 100))
    test_img.save(img_buffer, format="JPEG")
    img_buffer.seek(0)

    upload_res = client.post(
        "/api/v1/media/upload",
        headers=headers,
        files={"file": ("test_outfit.jpg", img_buffer, "image/jpeg")},
    )
    assert upload_res.status_code == 200, upload_res.text
    upload_data = upload_res.json()
    assert "image_url" in upload_data
    assert upload_data["image_url"].endswith(".webp")

    # 4. Verify Static File Serving for Uploaded Image
    static_res = client.get(upload_data["image_url"])
    assert static_res.status_code == 200
    assert static_res.headers["content-type"] in ("image/webp", "application/octet-stream")
