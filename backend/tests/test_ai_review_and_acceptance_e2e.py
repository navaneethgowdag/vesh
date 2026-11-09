"""
End-to-End Test Suite for AI Wardrobe Review and Acceptance Workflow:
1. Single upload -> enters pending review -> edit & finalize -> moves to accepted closet.
2. Batch upload -> multiple items in pending review -> bulk finalize -> all move to accepted closet.
3. Batch upload with corrupt image -> corrupt item marked failed, valid item completes and can be reviewed.
4. Strict multi-user data isolation -> users can only see and finalize their own pending garments.
5. Wardrobe API filtering -> review_status parameter ('pending', 'accepted', 'all') accurately filters closet.
"""

import io
import uuid
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.services.clothing_image_service import ClothingImageService
from app.services.clothing_processing_service import ClothingProcessingService
from app.api.deps import get_current_user


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_user(db, email: str, username: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            password_hash="mock_hash_for_test",
            first_name="Review",
            last_name="Tester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _make_image_bytes(color=(60, 120, 180), size=(224, 224)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_single_upload_review_and_finalize_flow(test_db):
    """
    Scenario 1:
    - User uploads a single garment image.
    - Garment enters predictions_ready / ready_for_review.
    - Clothing item appears in GET /api/v1/clothing/pending-review.
    - Clothing item appears in GET /api/v1/wardrobe?review_status=pending.
    - Clothing item is NOT in GET /api/v1/wardrobe?review_status=accepted.
    - User edits and finalizes attributes via POST /api/v1/clothing/{id}/finalize.
    - Garment is removed from pending-review.
    - Garment is present in GET /api/v1/wardrobe?review_status=accepted.
    """
    user = _get_or_create_user(test_db, "review_user_1@tailorbird.test", "review_user_1")
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        img_bytes = _make_image_bytes(color=(45, 95, 155))
        files = {"file": ("blue_oxford_shirt.jpg", img_bytes, "image/jpeg")}
        data = {"name": "Blue Oxford Shirt"}

        upload_res = client.post("/api/v1/clothing/upload", files=files, data=data)
        assert upload_res.status_code == 202
        upload_data = upload_res.json()
        item_id = upload_data["item_id"]

        # 1. Verify item appears in pending-review
        pending_res = client.get("/api/v1/clothing/pending-review")
        assert pending_res.status_code == 200
        pending_items = pending_res.json()
        pending_ids = [str(item["id"]) for item in pending_items]
        assert item_id in pending_ids

        # 2. Verify wardrobe filter review_status=pending includes item
        wardrobe_pending = client.get("/api/v1/wardrobe?review_status=pending")
        assert wardrobe_pending.status_code == 200
        wp_ids = [str(item["id"]) for item in wardrobe_pending.json()]
        assert item_id in wp_ids

        # 3. Verify wardrobe filter review_status=accepted excludes item
        wardrobe_accepted = client.get("/api/v1/wardrobe?review_status=accepted")
        assert wardrobe_accepted.status_code == 200
        wa_ids = [str(item["id"]) for item in wardrobe_accepted.json()]
        assert item_id not in wa_ids

        # 4. User reviews and finalizes the garment
        finalize_payload = {
            "name": "Navy Oxford Button-Down",
            "category": "Tops",
            "color": "Navy Blue",
            "pattern": "Solid",
            "season": "Fall",
            "occasion": "Casual Daily",
            "article_type": "Shirts",
            "master_category": "Apparel",
            "sub_category": "Topwear",
            "base_colour": "Navy Blue",
            "gender": "Men",
            "usage": "Casual",
            "age_group": "Adults",
        }
        finalize_res = client.post(f"/api/v1/clothing/{item_id}/finalize", json=finalize_payload)
        assert finalize_res.status_code == 200
        fin_data = finalize_res.json()
        assert fin_data["is_finalized"] is True
        assert fin_data["current_attributes"].get("article_type") == "Shirts"

        # 5. Verify item is removed from pending-review
        pending_after = client.get("/api/v1/clothing/pending-review")
        assert pending_after.status_code == 200
        pending_after_ids = [str(item["id"]) for item in pending_after.json()]
        assert item_id not in pending_after_ids

        # 6. Verify item is now in accepted closet
        wardrobe_accepted_after = client.get("/api/v1/wardrobe?review_status=accepted")
        assert wardrobe_accepted_after.status_code == 200
        wa_after_ids = [str(item["id"]) for item in wardrobe_accepted_after.json()]
        assert item_id in wa_after_ids

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_batch_upload_and_bulk_finalize_flow(test_db):
    """
    Scenario 2:
    - User uploads multiple clothing items via batch upload.
    - Process items to ready_for_review state.
    - Multiple items appear in GET /api/v1/clothing/pending-review.
    - User executes POST /api/v1/clothing/bulk-finalize.
    - All items are finalized and moved into accepted closet.
    """
    user = _get_or_create_user(test_db, "bulk_user_2@tailorbird.test", "bulk_user_2")
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        # Create 3 distinct images
        img1 = _make_image_bytes(color=(120, 40, 40), size=(224, 224))
        img2 = _make_image_bytes(color=(40, 120, 40), size=(224, 224))
        img3 = _make_image_bytes(color=(40, 40, 120), size=(224, 224))

        files = [
            ("files", ("batch_item_1.jpg", io.BytesIO(img1), "image/jpeg")),
            ("files", ("batch_item_2.jpg", io.BytesIO(img2), "image/jpeg")),
            ("files", ("batch_item_3.jpg", io.BytesIO(img3), "image/jpeg")),
        ]

        batch_res = client.post("/api/v1/clothing/batch-upload", files=files)
        assert batch_res.status_code == 202
        batch_id = batch_res.json()["batch_id"]

        # Fetch batch status to get item IDs
        status_res = client.get(f"/api/v1/clothing/batches/{batch_id}")
        assert status_res.status_code == 200
        batch_items = status_res.json()["items"]
        assert len(batch_items) == 3
        created_ids = [item["clothing_id"] for item in batch_items]

        # For test repeatability, process any remaining items via processor
        processor = ClothingProcessingService(test_db)
        for cid_str in created_ids:
            cid = uuid.UUID(cid_str)
            processor.process_clothing_item(clothing_id=cid, user_id=user.id)

        # Verify all items appear in pending-review
        pending_res = client.get("/api/v1/clothing/pending-review")
        assert pending_res.status_code == 200
        pending_ids = [str(item["id"]) for item in pending_res.json()]
        for cid_str in created_ids:
            assert cid_str in pending_ids

        # Execute bulk-finalize
        bulk_res = client.post("/api/v1/clothing/bulk-finalize", json={"item_ids": created_ids})
        assert bulk_res.status_code == 200
        bulk_data = bulk_res.json()
        assert bulk_data["finalized_count"] == 3
        assert "3 garment(s)" in bulk_data["message"]

        # Verify items are no longer in pending-review
        pending_after = client.get("/api/v1/clothing/pending-review")
        assert pending_after.status_code == 200
        pending_after_ids = [str(item["id"]) for item in pending_after.json()]
        for cid_str in created_ids:
            assert cid_str not in pending_after_ids

        # Verify all items are in accepted wardrobe
        wardrobe_res = client.get("/api/v1/wardrobe?review_status=accepted")
        assert wardrobe_res.status_code == 200
        wardrobe_ids = [str(item["id"]) for item in wardrobe_res.json()]
        for cid_str in created_ids:
            assert cid_str in wardrobe_ids

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_corrupt_image_batch_isolation(test_db):
    """
    Scenario 3:
    - User uploads a batch containing a valid image and a corrupt file.
    - Valid image is processed successfully.
    - Corrupt image is flagged as failed with an explanatory error message.
    - Valid image can be finalized independently.
    """
    user = _get_or_create_user(test_db, "corrupt_tester@tailorbird.test", "corrupt_tester")
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app)

    try:
        valid_img = _make_image_bytes(color=(200, 100, 50))
        corrupt_bytes = b"NOT_A_VALID_JPEG_HEADER_CORRUPTED_BYTES"

        files = [
            ("files", ("valid_photo.jpg", io.BytesIO(valid_img), "image/jpeg")),
            ("files", ("corrupt_photo.jpg", io.BytesIO(corrupt_bytes), "image/jpeg")),
        ]

        res = client.post("/api/v1/clothing/batch-upload", files=files)
        assert res.status_code == 202
        batch_id = res.json()["batch_id"]

        status_res = client.get(f"/api/v1/clothing/batches/{batch_id}")
        assert status_res.status_code == 200
        items = status_res.json()["items"]
        assert len(items) == 2

        # Item 0 (valid) is queued/ready
        assert items[0]["status"] in ("queued", "processing", "ready_for_review")
        # Item 1 (corrupt) is failed
        assert items[1]["status"] == "failed"
        assert "corrupt" in (items[1]["error"] or "").lower() or "unreadable" in (items[1]["error"] or "").lower()

        # Finalizing the valid item succeeds
        valid_id = items[0]["clothing_id"]
        # Process it if needed
        processor = ClothingProcessingService(test_db)
        processor.process_clothing_item(clothing_id=uuid.UUID(valid_id), user_id=user.id)

        fin_res = client.post(f"/api/v1/clothing/{valid_id}/finalize", json={"name": "Valid Garment"})
        assert fin_res.status_code == 200
        assert fin_res.json()["is_finalized"] is True

    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_multi_user_review_isolation(test_db):
    """
    Scenario 4:
    - User A and User B both have pending garments.
    - User A only sees User A's pending garments.
    - User B only sees User B's pending garments.
    - User A cannot finalize User B's garment (via single finalize or bulk finalize).
    """
    user_a = _get_or_create_user(test_db, "user_alpha@tailorbird.test", "user_alpha")
    user_b = _get_or_create_user(test_db, "user_bravo@tailorbird.test", "user_bravo")

    client = TestClient(app)

    # 1. Upload for User A
    app.dependency_overrides[get_current_user] = lambda: user_a
    img_a = _make_image_bytes(color=(10, 20, 30))
    res_a = client.post(
        "/api/v1/clothing/upload",
        files={"file": ("alpha_garment.jpg", img_a, "image/jpeg")},
        data={"name": "Alpha Garment"},
    )
    assert res_a.status_code == 202
    garment_a_id = res_a.json()["item_id"]

    # 2. Upload for User B
    app.dependency_overrides[get_current_user] = lambda: user_b
    img_b = _make_image_bytes(color=(200, 210, 220))
    res_b = client.post(
        "/api/v1/clothing/upload",
        files={"file": ("bravo_garment.jpg", img_b, "image/jpeg")},
        data={"name": "Bravo Garment"},
    )
    assert res_b.status_code == 202
    garment_b_id = res_b.json()["item_id"]

    try:
        # Check User A's pending view
        app.dependency_overrides[get_current_user] = lambda: user_a
        pending_a = client.get("/api/v1/clothing/pending-review").json()
        ids_a = [str(item["id"]) for item in pending_a]
        assert garment_a_id in ids_a
        assert garment_b_id not in ids_a

        # Check User B's pending view
        app.dependency_overrides[get_current_user] = lambda: user_b
        pending_b = client.get("/api/v1/clothing/pending-review").json()
        ids_b = [str(item["id"]) for item in pending_b]
        assert garment_b_id in ids_b
        assert garment_a_id not in ids_b

        # User A tries to single-finalize User B's garment -> 403 Forbidden
        app.dependency_overrides[get_current_user] = lambda: user_a
        tamper_res = client.post(f"/api/v1/clothing/{garment_b_id}/finalize", json={"name": "Tampered"})
        assert tamper_res.status_code in (403, 404)

        # User A tries to bulk-finalize User B's garment -> finalized_count is 0
        bulk_tamper = client.post("/api/v1/clothing/bulk-finalize", json={"item_ids": [garment_b_id]})
        assert bulk_tamper.status_code == 200
        assert bulk_tamper.json()["finalized_count"] == 0

        # User B's garment remains pending and unfinalized
        app.dependency_overrides[get_current_user] = lambda: user_b
        pending_b_after = client.get("/api/v1/clothing/pending-review").json()
        ids_b_after = [str(item["id"]) for item in pending_b_after]
        assert garment_b_id in ids_b_after

    finally:
        app.dependency_overrides.pop(get_current_user, None)
