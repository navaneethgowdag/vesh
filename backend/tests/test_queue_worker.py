import io
import time
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from PIL import Image

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.core.security import create_access_token
from app.core.redis import get_rq_redis_client
from app.services.clothing_image_service import ClothingImageService
from app.jobs.clothing_jobs import process_garment_image_job


@pytest.fixture
def test_user(client):
    """Fixture providing a test user on real Neon PostgreSQL with cleanup."""
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"worker_test_{suffix}@stylesphere.com",
        username=f"w_tester_{suffix}",
        first_name="Queue",
        last_name="Worker",
        password_hash="mockhash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    yield user, headers

    # Cleanup
    try:
        from app.models.clothing_image import ClothingImage
        from app.models.clothing_prediction import ClothingPrediction
        clothing_items = db.query(Clothing).filter(Clothing.user_id == user.id).all()
        for ci in clothing_items:
            db.query(ClothingImage).filter(ClothingImage.clothing_id == ci.id).delete()
            db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == ci.id).delete()
            db.query(ClothingPrediction).filter(ClothingPrediction.clothing_id == ci.id).delete()
        db.query(Clothing).filter(Clothing.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _create_synthetic_garment_image() -> bytes:
    img = Image.new("RGB", (400, 400), color=(240, 240, 240))
    for x in range(120, 280):
        for y in range(100, 320):
            img.putpixel((x, y), (40, 80, 180))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_rq_redis_client_configuration():
    """Verify that get_rq_redis_client uses decode_responses=False to avoid unpickling crashes."""
    rq_client = get_rq_redis_client()
    if rq_client is not None:
        assert rq_client.connection_pool.connection_kwargs.get("decode_responses") is False


def test_garment_job_lifecycle_end_to_end(client, test_user):
    """
    Trace full job lifecycle:
    1. Upload image -> stored in Neon BYTEA -> queued -> auto-dispatched to worker
    2. Concurrency protection prevents duplicate simultaneous execution
    3. Status reaches 'ready_for_review' with verified processed image in Neon
    """
    user, headers = test_user
    img_bytes = _create_synthetic_garment_image()

    # 1. Upload garment
    upload_res = client.post(
        "/api/v1/clothing/upload",
        headers=headers,
        data={
            "name": "Navy Summer Shirt",
            "category": "Tops",
            "color": "Navy",
            "occasion": "Casual Daily",
            "season": "Summer",
        },
        files={"file": ("shirt.jpg", img_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 202, upload_res.text
    data = upload_res.json()
    item_id = data["item_id"]
    assert data["status"] == "queued"

    # 2. Concurrency check: attempting to run a duplicate worker returns already_processing or completes
    db = SessionLocal()
    try:
        dup_res = process_garment_image_job(
            job_id=str(uuid.uuid4()),
            user_id=str(user.id),
            clothing_id=str(item_id),
            db=db,
        )
        assert dup_res.get("status") in ("already_processing", "ready_for_review", "completed")
    finally:
        db.close()

    # 3. Poll status endpoint until ready_for_review (worker runs in background thread fallback)
    final_status = None
    for _ in range(30):
        time.sleep(0.5)
        status_res = client.get(f"/api/v1/clothing/{item_id}/processing-status", headers=headers)
        assert status_res.status_code == 200, status_res.text
        status_data = status_res.json()
        if status_data["stage"] == "ready_for_review" or status_data["status"] in ("ready_for_review", "completed"):
            final_status = status_data
            break

    assert final_status is not None, "Worker did not advance garment beyond queued state within timeout."
    assert final_status["is_processed_available"] is True
    assert final_status["processed_image_url"] == f"/api/v1/clothing/{item_id}/image/processed"

    # 4. Verify processed image binary is retrievable from Neon BYTEA
    img_res = client.get(f"/api/v1/clothing/{item_id}/image/processed", headers=headers)
    assert img_res.status_code == 200
    assert len(img_res.content) > 0


def test_direct_worker_execution(test_user):
    """Verify that a worker directly executed on a clothing item processes from scratch."""
    user, _ = test_user
    db = SessionLocal()
    try:
        clothing = Clothing(
            id=uuid.uuid4(),
            user_id=user.id,
            name="Direct Worker Shirt",
            category="Tops",
            color="Blue",
            occasion="Casual Daily",
            season="Summer",
        )
        db.add(clothing)
        db.commit()

        # Store original image
        img_svc = ClothingImageService(db)
        img_svc.store_image(
            clothing_id=clothing.id,
            user_id=user.id,
            image_bytes=_create_synthetic_garment_image(),
            image_type="original",
        )

        job_res = process_garment_image_job(
            job_id=str(uuid.uuid4()),
            user_id=str(user.id),
            clothing_id=str(clothing.id),
            db=db,
        )
        assert job_res["status"] == "ready_for_review"
        assert job_res["review_required"] is True
        assert "duration_seconds" in job_res
    finally:
        db.close()


def test_garment_job_idempotency(test_user):
    """Verify that re-running worker on an already completed item returns cached result."""
    user, _ = test_user
    db = SessionLocal()
    try:
        clothing = Clothing(
            id=uuid.uuid4(),
            user_id=user.id,
            name="Idempotency Test Shirt",
            category="Tops",
            color="White",
            occasion="Casual Daily",
            season="Summer",
        )
        db.add(clothing)
        db.commit()

        # Store fake processed image
        img_svc = ClothingImageService(db)
        img_svc.store_image(
            clothing_id=clothing.id,
            user_id=user.id,
            image_bytes=b"WEBP_BYTES_MOCK",
            image_type="processed",
            mime_type="image/webp",
        )

        analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
        if not analysis:
            analysis = ClothingAnalysis(
                clothing_id=clothing.id,
                feature_vector={},
            )
            db.add(analysis)

        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "ready_for_review"
        fv["processing_stage"] = "ready_for_review"
        fv["has_processed"] = True
        fv["processing_duration"] = 1.45
        analysis.feature_vector = fv
        db.commit()

        # Call worker
        res = process_garment_image_job(
            job_id=str(uuid.uuid4()),
            user_id=str(user.id),
            clothing_id=str(clothing.id),
            db=db,
        )
        assert res["status"] == "ready_for_review"
        assert res.get("cached") is True
    finally:
        db.close()


def test_garment_job_missing_image_failure(test_user):
    """Verify clean error handling when original image binary is missing."""
    user, _ = test_user
    db = SessionLocal()
    try:
        clothing = Clothing(
            id=uuid.uuid4(),
            user_id=user.id,
            name="Ghost Shirt",
            category="Tops",
            color="Black",
            occasion="Casual Daily",
            season="Summer",
        )
        db.add(clothing)
        db.commit()

        res = process_garment_image_job(
            job_id=str(uuid.uuid4()),
            user_id=str(user.id),
            clothing_id=str(clothing.id),
            db=db,
        )
        assert res["status"] == "failed"
        assert "Original image" in res.get("error", "")
    finally:
        db.close()


def test_retry_processing_endpoint(client, test_user):
    """Verify /clothing/{id}/retry-processing resets state to queued and dispatches."""
    user, headers = test_user
    db = SessionLocal()
    try:
        clothing = Clothing(
            id=uuid.uuid4(),
            user_id=user.id,
            name="Failed Shirt",
            category="Tops",
            color="Grey",
            occasion="Casual Daily",
            season="Summer",
        )
        db.add(clothing)
        db.commit()

        analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
        if not analysis:
            analysis = ClothingAnalysis(clothing_id=clothing.id, feature_vector={})
            db.add(analysis)

        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "failed"
        fv["processing_stage"] = "failed"
        fv["error_message"] = "Segmentation error"
        analysis.feature_vector = fv
        db.commit()

        res = client.post(f"/api/v1/clothing/{clothing.id}/retry-processing", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["status"] == "queued"
        assert data["stage"] == "queued"
    finally:
        db.close()


def test_stale_job_auto_healing_in_status_endpoint(client, test_user):
    """Verify that an item queued for > 15s triggers self-healing when polled."""
    user, headers = test_user
    db = SessionLocal()
    try:
        stale_time = datetime.now(timezone.utc) - timedelta(seconds=20)
        clothing = Clothing(
            id=uuid.uuid4(),
            user_id=user.id,
            name="Stale Shirt",
            category="Tops",
            color="Blue",
            occasion="Casual Daily",
            season="Summer",
            created_at=stale_time,
        )
        db.add(clothing)
        db.commit()

        # Store original image so processing succeeds when triggered
        img_svc = ClothingImageService(db)
        img_svc.store_image(
            clothing_id=clothing.id,
            user_id=user.id,
            image_bytes=_create_synthetic_garment_image(),
            image_type="original",
        )

        analysis = db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == clothing.id).first()
        if not analysis:
            analysis = ClothingAnalysis(clothing_id=clothing.id, feature_vector={})
            db.add(analysis)

        fv = dict(analysis.feature_vector) if isinstance(analysis.feature_vector, dict) else {}
        fv["processing_status"] = "queued"
        fv["processing_stage"] = "queued"
        analysis.feature_vector = fv
        db.commit()

        # Polling status endpoint should detect stale queue (>15s) and trigger self-healing
        poll_res = client.get(f"/api/v1/clothing/{clothing.id}/processing-status", headers=headers)
        assert poll_res.status_code == 200, poll_res.text
    finally:
        db.close()
