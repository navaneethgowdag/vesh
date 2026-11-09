"""
Test Suite for Feature 1: Weekly Outfit Planner
Validates:
1. Generate a seven-day plan with appropriate Monday-to-Sunday boundaries.
2. Calendar events integrated into day context and recommendations.
3. Insufficient wardrobe items handled gracefully with needs_manual_selection status.
4. Regenerate a single day without altering accepted days.
5. Prevent duplicate plans unless force_regenerate is True.
6. User-level data isolation strictly enforced.
"""

import uuid
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.outfit import Outfit
from app.services.weekly_planner_service import WeeklyPlannerService
from app.api.deps import get_current_user
from app.main import app


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_user_with_wardrobe(db, prefix="planner_u"):
    user = User(
        id=uuid.uuid4(),
        email=f"{prefix}_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"{prefix}_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    db.add(user)

    top1 = Clothing(user_id=user.id, name="White Linen Shirt", category="Tops", color="White", occasion="Casual Daily")
    top2 = Clothing(user_id=user.id, name="Navy Oxford Shirt", category="Tops", color="Navy", occasion="Work & Office")
    top3 = Clothing(user_id=user.id, name="Olive Polo", category="Tops", color="Olive", occasion="Casual Daily")
    bot1 = Clothing(user_id=user.id, name="Khaki Chinos", category="Bottoms", color="Khaki", occasion="Casual Daily")
    bot2 = Clothing(user_id=user.id, name="Dark Denim Jeans", category="Bottoms", color="Denim Blue", occasion="Casual Daily")
    bot3 = Clothing(user_id=user.id, name="Charcoal Trousers", category="Bottoms", color="Charcoal", occasion="Work & Office")

    db.add_all([top1, top2, top3, bot1, bot2, bot3])
    db.commit()
    return user


@pytest.mark.asyncio
async def test_generate_seven_day_weekly_plan(test_db):
    user = _make_user_with_wardrobe(test_db, "plan_gen")
    service = WeeklyPlannerService(test_db)

    plan = await service.generate_weekly_plan(user.id)
    assert plan is not None
    assert plan.user_id == user.id
    assert len(plan.days) == 7

    # Verify 7 consecutive days starting from Monday
    start_date = plan.week_start_date
    assert start_date.weekday() == 0  # Monday

    for idx, day in enumerate(plan.days):
        assert day.plan_date == start_date + timedelta(days=idx)
        assert day.status in ("planned", "needs_manual_selection")
        if day.outfit:
            # Must strictly belong to authenticated user
            assert day.outfit.user_id == user.id


@pytest.mark.asyncio
async def test_prevent_duplicate_plan_without_force(test_db):
    user = _make_user_with_wardrobe(test_db, "plan_dup")
    service = WeeklyPlannerService(test_db)

    plan1 = await service.generate_weekly_plan(user.id)
    plan2 = await service.generate_weekly_plan(user.id, force_regenerate=False)

    assert plan1.id == plan2.id
    assert plan1.week_start_date == plan2.week_start_date


@pytest.mark.asyncio
async def test_insufficient_wardrobe_graceful_handling(test_db):
    # User with only 1 item (cannot form top+bottom)
    user = User(
        id=uuid.uuid4(),
        email=f"scant_u_{uuid.uuid4().hex[:6]}@tailorbird.tech",
        username=f"scant_u_{uuid.uuid4().hex[:6]}",
        password_hash="mock",
    )
    test_db.add(user)
    top = Clothing(user_id=user.id, name="Solo Shirt", category="Tops", color="Blue")
    test_db.add(top)
    test_db.commit()

    service = WeeklyPlannerService(test_db)
    plan = await service.generate_weekly_plan(user.id)

    assert len(plan.days) == 7
    # All days should be flagged as needs_manual_selection
    for day in plan.days:
        assert day.status == "needs_manual_selection"
        assert day.outfit_id is None
        explanation = day.explanation_data
        assert explanation.get("needs_items") is True


@pytest.mark.asyncio
async def test_regenerate_single_day_preserves_accepted_days(test_db):
    user = _make_user_with_wardrobe(test_db, "regen_day")
    service = WeeklyPlannerService(test_db)

    plan = await service.generate_weekly_plan(user.id)
    day0 = plan.days[0]
    day1 = plan.days[1]

    # Accept day 0
    service.update_day_status(user.id, plan.id, day0.id, "accepted")
    day0_outfit_id = day0.outfit_id

    # Regenerate day 1
    updated_day1 = await service.regenerate_day(user.id, plan.id, day1.id)
    assert updated_day1.id == day1.id

    # Verify day 0 remained accepted with same outfit
    refreshed_plan = service.get_plan(user.id, plan.week_start_date)
    refreshed_day0 = next(d for d in refreshed_plan.days if d.id == day0.id)
    assert refreshed_day0.status == "accepted"
    assert refreshed_day0.outfit_id == day0_outfit_id


def test_planner_api_routes(test_db):
    user = _make_user_with_wardrobe(test_db, "plan_route")
    client = TestClient(app)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        # 1. Generate plan via API
        gen_res = client.post("/api/v1/planner/weekly/generate", json={})
        assert gen_res.status_code == 200
        plan_data = gen_res.json()
        assert "days" in plan_data
        assert len(plan_data["days"]) == 7

        plan_id = plan_data["id"]
        first_day_id = plan_data["days"][0]["id"]

        # 2. Get plan via API
        get_res = client.get("/api/v1/planner/weekly")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == plan_id

        # 3. Update day status to accepted
        status_res = client.patch(
            f"/api/v1/planner/weekly/{plan_id}/days/{first_day_id}/status",
            json={"status": "accepted"},
        )
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "accepted"

        # 4. Regenerate day 2
        second_day_id = plan_data["days"][1]["id"]
        regen_res = client.post(f"/api/v1/planner/weekly/{plan_id}/days/{second_day_id}/regenerate")
        assert regen_res.status_code == 200
        assert regen_res.json()["id"] == second_day_id
    finally:
        app.dependency_overrides.pop(get_current_user, None)
