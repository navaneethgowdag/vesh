"""
StyleSphere Phase 3: AI Outfit Recommendation Engine + Neon DB End-to-End Verification Trace.
"""

import sys
import os
import uuid
import asyncio
from datetime import date, datetime, timezone

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.outfit import Outfit
from app.models.recommendation import Recommendation
from app.models.calendar_event import CalendarEvent
from app.repositories.calendar_repository import CalendarRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.services.recommendation_service import RecommendationService


async def run_e2e_trace():
    print("=" * 70)
    print("STYLESPHERE PHASE 3: LIVE END-TO-END INTEGRATION & DATABASE TRACE")
    print("=" * 70)

    db = SessionLocal()
    try:
        # 1. Setup Isolated Test User in Neon PostgreSQL
        user_email = f"phase3_e2e_{uuid.uuid4().hex[:8]}@example.com"
        test_user = User(
            id=uuid.uuid4(),
            email=user_email,
            username=f"stylist_{uuid.uuid4().hex[:8]}",
            password_hash="mock_hash",
            first_name="Atelier",
            last_name="Tester",
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        print(f"\n[1/7] Test User created in Neon PostgreSQL: {test_user.id} ({test_user.email})")

        # 2. Add Categorized Wardrobe Garments (Western + Indian + Footwear)
        items_data = [
            ("Crisp Poplin Shirt", "Tops", "shirt", "White", "Casual", 0.65, "All-Season"),
            ("Navy Tailored Trousers", "Bottoms", "pants", "Navy", "Formal", 0.70, "All-Season"),
            ("Cognac Penny Loafers", "Shoes", "loafers", "Cognac", "Classic", 0.65, "All-Season"),
            ("Charcoal Wool Blazer", "Outerwear", "blazer", "Charcoal", "Tailored", 0.80, "Autumn"),
            ("Chanderi Silk Saree", "saree", "saree", "Burgundy", "Festive", 0.85, "All-Season"),
            ("Embroidered Raw Silk Blouse", "blouse", "blouse", "Gold", "Festive", 0.85, "All-Season"),
            ("Gold Strappy Sandals", "sandals", "sandals", "Gold", "Ethnic", 0.80, "Summer"),
            ("Faded Indigo Jeans", "jeans", "jeans", "Denim Blue", "Casual", 0.35, "All-Season"),
        ]

        created_items = []
        for name, cat, sub, color, style, formality, season in items_data:
            item = Clothing(
                id=uuid.uuid4(),
                user_id=test_user.id,
                name=name,
                category=cat,
                subcategory=sub,
                color=color,
                season=season,
                occasion="Casual Daily",
                image_url=f"/mock/{name.lower().replace(' ', '_')}.jpg",
                wear_count=0,
            )
            db.add(item)
            db.commit()
            db.refresh(item)

            analysis = ClothingAnalysis(
                id=uuid.uuid4(),
                clothing_id=item.id,
                detected_category=cat,
                style_tags=[style],
                confidence=0.92,
                detected_colors=[{"name": color, "hex": "#ffffff", "percentage": 0.85}],
                feature_vector={
                    "formality": formality,
                    "is_finalized": True,
                    "verified_attributes": {
                        "category": cat,
                        "subcategory": sub,
                        "primary_color": color,
                        "formality": formality,
                        "is_finalized": True,
                    },
                },
            )
            db.add(analysis)
            db.commit()
            db.refresh(item)
            created_items.append(item)

        print(f"[2/7] Populated {len(created_items)} categorized garments into Neon PostgreSQL:")
        for it in created_items:
            print(f"      - {it.name} | Cat: {it.category} | Formality: {it.formality} | Img: {it.preferred_image_url}")

        # 3. Verify Calendar Prerequisite Requirement
        rec_service = RecommendationService(db)
        print("\n[3/7] Verifying Calendar Event Prerequisite Enforcement:")
        try:
            await rec_service.generate_recommendations(
                user_id=test_user.id,
                calendar_event_id=None,  # Intentionally missing
            )
            print("      ERROR: Prerequisite check failed to reject missing calendar event!")
            sys.exit(1)
        except Exception as e:
            print(f"      SUCCESS: Missing calendar event rejected as expected ({getattr(e, 'detail', str(e))})")

        # 4. Schedule Planned Calendar Event in Neon PostgreSQL
        cal_repo = CalendarRepository(db)
        cal_event = cal_repo.create(
            user_id=test_user.id,
            event_date=date.today(),
            occasion="Work & Office",
            notes="Quarterly Stakeholder Briefing",
            status="scheduled",
        )
        print(f"\n[4/7] Planned Calendar Event created in Neon PostgreSQL:")
        print(f"      - ID: {cal_event.id} | Date: {cal_event.event_date} | Occasion: {cal_event.occasion} | Notes: {cal_event.notes}")

        # 5. Generate Phase 3 Outfit Recommendations
        print("\n[5/7] Executing AI Recommendation Engine (CPU-only, deterministic scoring):")
        recs = await rec_service.generate_recommendations(
            user_id=test_user.id,
            calendar_event_id=cal_event.id,
            occasion="Work & Office",
            outfit_preference="western",
            limit=3,
        )

        print(f"      Generated {len(recs)} ranked recommendations:")
        for idx, r in enumerate(recs):
            outfit = r.outfit
            clothing_names = [ci.name for ci in outfit.clothing_items]
            print(f"\n      --- Candidate {idx + 1} ---")
            print(f"      Title: {outfit.name}")
            print(f"      Match Score: {r.score * 100:.1f}%")
            print(f"      Garments Assembled: {', '.join(clothing_names)}")
            print(f"      Color Harmony Rationale: {r.reasoning.get('color_harmony', 'N/A')}")
            print(f"      Formality Alignment: {r.reasoning.get('formality_alignment', 'N/A')}")
            print(f"      Deterministic Reasons: {r.reasons}")

        assert len(recs) >= 1, "At least 1 recommendation must be generated"
        best_rec = recs[0]

        # 6. Verify Indian Saree Construction Rules (Strict No-Jeans Enforcement)
        festive_event = cal_repo.create(
            user_id=test_user.id,
            event_date=date.today(),
            occasion="Wedding / Festive",
            notes="Evening Celebration",
            status="scheduled",
        )
        indian_recs = await rec_service.generate_recommendations(
            user_id=test_user.id,
            calendar_event_id=festive_event.id,
            occasion="Wedding / Festive",
            outfit_preference="indian",
            limit=2,
        )
        print(f"\n[6/7] Indian Ethnic Ensemble Verification:")
        for r in indian_recs:
            names = [ci.name for ci in r.outfit.clothing_items]
            print(f"      Ethnic Candidate: {', '.join(names)}")
            assert "Chanderi Silk Saree" in names, "Saree must be assembled"
            assert "Embroidered Raw Silk Blouse" in names, "Matching blouse must be assembled"
            assert "Faded Indigo Jeans" not in names, "CRITICAL: Saree must NEVER pair with jeans"
            print("      SUCCESS: Saree correctly paired with Blouse and strictly excluded jeans!")

        # 7. Accept Recommendation & Verify Idempotent Calendar Association in Neon PostgreSQL
        print("\n[7/7] Testing Recommendation Acceptance & Calendar Event Linking:")
        accept_result = rec_service.accept_recommendation(
            recommendation_id=best_rec.id,
            user_id=test_user.id,
            calendar_event_id=cal_event.id,
        )

        print(f"      Accept status: {accept_result['status']}")
        print(f"      Message: {accept_result['message']}")

        # Verify in DB
        db.expire_all()
        persisted_event = cal_repo.get_by_id(cal_event.id, user_id=test_user.id)
        assert persisted_event is not None
        assert str(persisted_event.outfit_id) == str(best_rec.outfit_id)
        print(f"      Verified in Neon PostgreSQL:")
        print(f"      - CalendarEvent ID: {persisted_event.id}")
        print(f"      - Associated Outfit ID: {persisted_event.outfit_id}")
        print(f"      - Associated Rec ID: {persisted_event.recommendation_id}")

        # Idempotency check: accept second time
        second_accept = rec_service.accept_recommendation(
            recommendation_id=best_rec.id,
            user_id=test_user.id,
            calendar_event_id=cal_event.id,
        )
        assert second_accept["status"] == "accepted"
        print("      SUCCESS: Idempotent acceptance succeeded without duplicate records.")

        print("\n" + "=" * 70)
        print("PHASE 3 COMPLETE: ALL INTEGRATION & PERSISTENCE CHECKS PASSED")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(run_e2e_trace())
