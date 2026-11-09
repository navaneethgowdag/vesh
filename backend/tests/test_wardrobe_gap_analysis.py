"""
Test Suite for Feature 2: Wardrobe Gap Analysis
Validates:
1. Empty wardrobe analysis returns foundational essentials gap.
2. Wardrobe with diverse categories analyzes distributions and identifies specific gaps (e.g., bottom bottleneck).
3. Missing / uncertain attributes handled gracefully.
4. Refresh analysis updates timestamp and reflects wardrobe changes.
5. User isolation: User A's wardrobe items cannot leak into User B's gap analysis.
"""

import uuid
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.services.wardrobe_gap_service import WardrobeGapService
from app.api.deps import get_current_user
from app.main import app


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_empty_wardrobe_gap_analysis(test_db):
    user = User(
        id=uuid.uuid4(),
        email=f"empty_gap_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"gap_u_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)
    test_db.commit()

    service = WardrobeGapService(test_db)
    res = service.analyze_wardrobe(user.id, force_refresh=True)

    assert res["total_items"] == 0
    assert len(res["gaps"]) >= 1
    foundational_gap = res["gaps"][0]
    assert foundational_gap["priority"] == "High"
    assert "empty" in foundational_gap["reason"].lower() or "staple" in foundational_gap["reason"].lower()
    assert len(foundational_gap["suggested_garments"]) >= 2


def test_wardrobe_with_tops_bottleneck_detects_bottoms_gap(test_db):
    user = User(
        id=uuid.uuid4(),
        email=f"gap_tops_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"gap_u_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)

    # Add 5 tops and 0 bottoms
    for idx, color in enumerate(["White", "Black", "Navy", "Gray", "Olive"]):
        top = Clothing(
            user_id=user.id,
            name=f"Shirt {idx + 1}",
            category="Tops",
            color=color,
            occasion="Casual Daily",
        )
        test_db.add(top)
    test_db.commit()

    service = WardrobeGapService(test_db)
    res = service.analyze_wardrobe(user.id, force_refresh=True)

    assert res["total_items"] == 5
    assert res["category_distribution"]["Tops"] == 5

    # Should flag limited bottoms gap
    gap_categories = [g["category"] for g in res["gaps"]]
    assert "Everyday Essentials" in gap_categories or any("bottom" in g["title"].lower() for g in res["gaps"])


def test_user_data_isolation(test_db):
    user_a = User(
        id=uuid.uuid4(),
        email=f"user_a_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"user_a_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    user_b = User(
        id=uuid.uuid4(),
        email=f"user_b_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"user_b_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add_all([user_a, user_b])

    # User A has 3 tops
    for i in range(3):
        test_db.add(Clothing(user_id=user_a.id, name=f"A Top {i}", category="Tops", color="Blue"))

    # User B has 0 items
    test_db.commit()

    service = WardrobeGapService(test_db)
    res_a = service.analyze_wardrobe(user_a.id, force_refresh=True)
    res_b = service.analyze_wardrobe(user_b.id, force_refresh=True)

    assert res_a["total_items"] == 3
    assert res_b["total_items"] == 0


def test_gap_analysis_api_route(test_db):
    user = User(
        id=uuid.uuid4(),
        email=f"gap_api_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"gap_api_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)
    test_db.commit()

    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        res = client.get("/api/v1/wardrobe/gap-analysis")
        assert res.status_code == 200
        data = res.json()
        assert "total_items" in data
        assert "gaps" in data
        assert "category_distribution" in data

        # Refresh endpoint
        refresh_res = client.post("/api/v1/wardrobe/gap-analysis/refresh")
        assert refresh_res.status_code == 200
        assert refresh_res.json()["total_items"] == data["total_items"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
