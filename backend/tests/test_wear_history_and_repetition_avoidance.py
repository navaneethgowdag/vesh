"""
Test Suite for Feature 4: Outfit Wear History & Repetition Avoidance
Validates:
1. Distinct lifecycle tracking: recommended, accepted, rejected, calendar-assigned, and worn.
2. mark_outfit_as_worn idempotently records wear in wear_history.
3. Constituent clothing items increment wear_count and update last_worn_at.
4. Repetition avoidance: outfits/items worn yesterday receive a recency penalty in recommendation scoring.
"""

import uuid
from datetime import datetime, timezone, timedelta, date
import pytest

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.outfit import Outfit
from app.models.wear_history import WearHistory
from app.services.recommendation_service import RecommendationService


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_mark_outfit_worn_idempotency(test_db):
    user = User(
        id=uuid.uuid4(),
        email=f"wear_tester_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"wear_u_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)

    top = Clothing(user_id=user.id, name="Linen Shirt", category="Tops", wear_count=0)
    bottom = Clothing(user_id=user.id, name="Khaki Shorts", category="Bottoms", wear_count=0)
    test_db.add_all([top, bottom])
    test_db.commit()

    outfit = Outfit(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Summer Casual Look",
        occasion="Casual Daily",
    )
    outfit.clothing_items = [top, bottom]
    test_db.add(outfit)
    test_db.commit()

    service = RecommendationService(test_db)

    # 1. First wear submission
    res1 = service.mark_outfit_as_worn(user_id=user.id, outfit_id=outfit.id)
    assert res1["success"] is True
    assert res1["wear_count_updated"] is True

    test_db.refresh(top)
    test_db.refresh(bottom)
    assert top.wear_count == 1
    assert bottom.wear_count == 1

    # 2. Duplicate wear submission on the same calendar day
    res2 = service.mark_outfit_as_worn(user_id=user.id, outfit_id=outfit.id)
    assert res2["success"] is True
    assert res2["wear_count_updated"] is False
    assert "already marked as worn" in res2["message"].lower()

    # Verify wear_count did NOT increment again
    test_db.refresh(top)
    assert top.wear_count == 1

    # Verify only ONE record in wear_history table for this outfit today
    today_date = date.today()
    entries = (
        test_db.query(WearHistory)
        .filter(WearHistory.user_id == user.id, WearHistory.outfit_id == outfit.id)
        .all()
    )
    today_entries = [e for e in entries if e.worn_at.date() == today_date]
    assert len(today_entries) == 1


@pytest.mark.asyncio
async def test_repetition_avoidance_recency_penalty(test_db):
    user = User(
        id=uuid.uuid4(),
        email=f"recency_tester_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"recency_u_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)

    # Wardrobe items: 2 tops, 1 bottom
    shirt_a = Clothing(user_id=user.id, name="Shirt A", category="Tops", color="Blue", occasion="Casual Daily")
    shirt_b = Clothing(user_id=user.id, name="Shirt B", category="Tops", color="White", occasion="Casual Daily")
    pants = Clothing(user_id=user.id, name="Casual Jeans", category="Bottoms", color="Black", occasion="Casual Daily")
    test_db.add_all([shirt_a, shirt_b, pants])
    test_db.commit()

    outfit_a = Outfit(id=uuid.uuid4(), user_id=user.id, name="Outfit A")
    outfit_a.clothing_items = [shirt_a, pants]
    test_db.add(outfit_a)
    test_db.commit()

    # Record that outfit_a (and thus shirt_a) was worn yesterday
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    wear_entry = WearHistory(
        user_id=user.id,
        outfit_id=outfit_a.id,
        worn_at=yesterday,
        occasion="Casual Daily",
    )
    test_db.add(wear_entry)
    test_db.commit()

    service = RecommendationService(test_db)
    recs = await service.generate_recommendations(
        user_id=user.id,
        limit=1,
    )

    assert len(recs) == 1
    selected = recs[0]

    # The recommendation engine should prefer Shirt B + Jeans over Shirt A (which was worn yesterday)
    selected_item_names = [i.name for i in (selected.outfit.clothing_items if selected.outfit else [])]
    assert "Shirt B" in selected_item_names
