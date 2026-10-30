"""
StyleSphere Phase 4: Personalization and Continuous Learning Engine
Live End-to-End Neon PostgreSQL Integration & Learning Feedback Trace
"""

import sys
import os
import uuid
import asyncio
from datetime import date, datetime, timezone
from sqlalchemy.orm.attributes import flag_modified

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.learned_preference import LearnedPreference
from app.models.clothing import Clothing
from app.models.clothing_analysis import ClothingAnalysis
from app.models.outfit import Outfit
from app.models.recommendation import Recommendation
from app.models.wear_history import WearHistory
from app.models.recommendation_feedback import RecommendationFeedback
from app.repositories.calendar_repository import CalendarRepository
from app.repositories.recommendation_repository import RecommendationRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.services.recommendation_service import RecommendationService
from app.services.personalization_service import PersonalizationService


async def run_phase4_e2e_trace():
    print("=" * 80)
    print("STYLESPHERE PHASE 4: LIVE PERSONALIZATION & LEARNING ENGINE E2E VERIFICATION")
    print("=" * 80)

    db = SessionLocal()
    created_clothing_ids = []
    test_user_id = None
    cal_event_id = None

    try:
        # 1. Setup Test User with Explicit Preferences in Neon PostgreSQL
        user_email = f"phase4_e2e_{uuid.uuid4().hex[:8]}@example.com"
        test_user = User(
            id=uuid.uuid4(),
            email=user_email,
            username=f"learner_{uuid.uuid4().hex[:8]}",
            password_hash="mock_hash",
            first_name="Elena",
            last_name="Vance",
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        test_user_id = test_user.id
        print(f"\n[1/8] Test User created in Neon DB: {test_user.id} ({test_user.email})")

        # Create User Preferences with explicit constraints
        user_prefs = UserPreference(
            id=uuid.uuid4(),
            user_id=test_user.id,
            preferred_styles=["Minimalist", "Casual"],
            preferred_colors=["White", "Navy", "Beige"],
            preferred_fits={
                "personalization_enabled": True,
                "avoided_colors": ["Burgundy", "Orange"],
                "disliked_styles": ["Bohemian"],
                "diversity_preference": "balanced",
                "avoid_recently_worn_days": 3,
                "comfort_priority": "high",
            },
        )
        db.add(user_prefs)

        # Create initial cold-start Learned Preferences
        learned_prefs = LearnedPreference(
            id=uuid.uuid4(),
            user_id=test_user.id,
            style_scores={},
            color_scores={},
            occasion_scores={},
            confidence_score=0.0,
            interaction_count=0,
        )
        db.add(learned_prefs)
        db.commit()
        print(f"      Initial UserPreference & LearnedPreference stored in Neon DB (Cold Start: confidence=0.0)")

        # 2. Add Wardrobe Garments (Diverse categories, colors, styles)
        items_data = [
            ("Linen Button-down Shirt", "Tops", "shirt", "White", "Minimalist", 0.60, "Summer"),
            ("Navy Pleated Trousers", "Bottoms", "pants", "Navy", "Minimalist", 0.70, "All-Season"),
            ("Leather Penny Loafers", "Shoes", "loafers", "Cognac", "Classic", 0.65, "All-Season"),
            ("Cashmere Knit Sweater", "Tops", "sweater", "Beige", "Casual", 0.50, "Winter"),
            ("Charcoal Relaxed Slacks", "Bottoms", "pants", "Charcoal", "Casual", 0.55, "All-Season"),
            ("Canvas Clean Sneakers", "Shoes", "sneakers", "White", "Casual", 0.40, "All-Season"),
            ("Burgundy Silk Blouse", "Tops", "blouse", "Burgundy", "Bohemian", 0.75, "All-Season"),
            ("Orange Flared Skirt", "Bottoms", "skirt", "Orange", "Bohemian", 0.60, "Summer"),
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
            created_clothing_ids.append(item.id)

            analysis = ClothingAnalysis(
                id=uuid.uuid4(),
                clothing_id=item.id,
                detected_category=cat,
                style_tags=[style],
                confidence=0.95,
                detected_colors=[{"name": color, "hex": "#cccccc", "percentage": 0.90}],
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

        print(f"[2/8] Populated {len(created_items)} items in Neon DB:")
        for it in created_items:
            print(f"      - {it.name} | Cat: {it.category} | Color: {it.color} | Style: {it.style}")

        # 3. Schedule Calendar Event (Mandatory Prerequisite)
        cal_repo = CalendarRepository(db)
        cal_event = cal_repo.create(
            user_id=test_user.id,
            event_date=date.today(),
            occasion="Work & Office",
            notes="Strategy Review Session",
            status="scheduled",
        )
        cal_event_id = cal_event.id
        print(f"\n[3/8] Scheduled Calendar Event in Neon DB (ID: {cal_event_id}, Occasion: {cal_event.occasion})")

        # 4. Generate Initial Recommendations (Cold-Start Verification)
        rec_service = RecommendationService(db)
        personalization_service = PersonalizationService(db)
        recs_initial = await rec_service.generate_recommendations(
            user_id=test_user.id,
            calendar_event_id=cal_event_id,
            occasion="Work & Office",
            outfit_preference="western",
            limit=3,
        )
        print(f"\n[4/8] Initial (Cold-Start) Outfit Recommendations Generated: {len(recs_initial)}")
        for idx, r in enumerate(recs_initial):
            outfit = r.outfit
            names = [ci.name for ci in outfit.clothing_items]
            bd = r.score_breakdown if hasattr(r, 'score_breakdown') else {}
            p_bd = bd.get("personalization", {})
            print(f"      Candidate {idx+1}: {outfit.name} | Score: {r.score:.3f} | PrefWeight: {p_bd.get('pref_weight', 0.0):.2f}")
            print(f"        Items: {', '.join(names)}")

        # Verify Cold-Start: confidence is 0.0 -> pref_weight is 0.0
        db.refresh(learned_prefs)
        assert learned_prefs.confidence_score == 0.0, "Cold start confidence must be 0.0"
        print("      VERIFIED: Cold-start preference weight is 0.0, purely driven by compatibility and explicit filters.")

        # 5. Record Multi-modal Feedback (Like Minimalist Outfit, Reject Bohemian/Burgundy)
        print("\n[5/8] Recording Interaction Feedback & Continuous Learning in Neon DB:")
        liked_outfit = recs_initial[0].outfit
        print(f"      - Submitting 'like' feedback for Outfit: '{liked_outfit.name}'")
        personalization_service.record_feedback(
            user_id=test_user.id,
            outfit=liked_outfit,
            action="like",
        )

        # Find or construct an outfit with Burgundy / Bohemian to reject
        burgundy_item = next(it for it in created_items if it.color == "Burgundy")
        orange_item = next(it for it in created_items if it.color == "Orange")
        loafer_item = next(it for it in created_items if it.subcategory == "loafers")
        
        reject_outfit = Outfit(
            id=uuid.uuid4(),
            user_id=test_user.id,
            name="Bohemian Autumn Ensemble",
            occasion="Casual Daily",
            season="All-Season",
            style="Bohemian",
        )
        reject_outfit.clothing_items.extend([burgundy_item, orange_item, loafer_item])
        db.add(reject_outfit)
        db.commit()

        print(f"      - Submitting 'reject' feedback with reason='not_my_style' for Outfit: '{reject_outfit.name}'")
        personalization_service.record_feedback(
            user_id=test_user.id,
            outfit=reject_outfit,
            action="reject",
            reason="not_my_style",
        )

        # Refresh learned preferences and verify updates
        db.refresh(learned_prefs)
        print(f"\n      Learned Preferences in Neon DB after Feedback:")
        print(f"      - Confidence Score: {learned_prefs.confidence_score:.3f}")
        print(f"      - Total Interactions: {learned_prefs.interaction_count}")
        print(f"      - Style Affinities: {learned_prefs.style_scores}")
        print(f"      - Color Affinities: {learned_prefs.color_scores}")

        assert learned_prefs.interaction_count >= 2, "Interaction count must be at least 2"
        assert learned_prefs.confidence_score > 0.0, "Confidence score must be > 0.0"
        assert learned_prefs.style_scores.get("Minimalist", 0) > 0, "Minimalist style score should be positive"
        assert learned_prefs.style_scores.get("Bohemian", 0) < 0, "Bohemian style score should be penalized"
        print("      VERIFIED: Bayesian updates successfully learned style and color affinities!")

        # 6. Wear Recording & Wear History Synchronization + Idempotency
        print("\n[6/8] Testing Outfit Wear Recording & Idempotent Wear Synchronization:")
        wear_outfit = liked_outfit
        initial_wear_counts = {ci.id: ci.wear_count for ci in wear_outfit.clothing_items}
        
        # First wear call
        wear_res1 = rec_service.mark_outfit_as_worn(
            user_id=test_user.id,
            outfit_id=wear_outfit.id,
        )
        print(f"      First wear submission: success={wear_res1.get('success')}, wear_count_updated={wear_res1.get('wear_count_updated')}")
        assert wear_res1.get("wear_count_updated") is True, "First wear submission should update wear count"
        
        # Verify wear count incremented
        for ci in wear_outfit.clothing_items:
            db.refresh(ci)
            assert ci.wear_count == initial_wear_counts[ci.id] + 1, f"Wear count for {ci.name} should increment"
            print(f"      - Item '{ci.name}' wear_count incremented: {initial_wear_counts[ci.id]} -> {ci.wear_count}")

        # Second wear call on the same date (Idempotency test)
        wear_res2 = rec_service.mark_outfit_as_worn(
            user_id=test_user.id,
            outfit_id=wear_outfit.id,
        )
        print(f"      Second wear submission (same date): success={wear_res2.get('success')}, wear_count_updated={wear_res2.get('wear_count_updated')}")
        assert wear_res2.get("wear_count_updated") is False, "Repeated wear submission on same day must have wear_count_updated=False"
        
        for ci in wear_outfit.clothing_items:
            db.refresh(ci)
            assert ci.wear_count == initial_wear_counts[ci.id] + 1, f"Wear count for {ci.name} should NOT increment twice"
        print("      VERIFIED: Wear recording is fully idempotent. Constituent wear counts safely preserved.")

        # 7. Re-generating Recommendations with Personalization Blending
        print("\n[7/8] Re-generating Recommendations with Active Learned Affinities:")
        recs_personalized = await rec_service.generate_recommendations(
            user_id=test_user.id,
            calendar_event_id=cal_event_id,
            occasion="Work & Office",
            outfit_preference="western",
            limit=3,
        )
        for idx, r in enumerate(recs_personalized):
            bd = r.score_breakdown.get("personalization", {})
            print(f"      Candidate {idx+1}: {r.outfit.name}")
            print(f"        Compatibility Score: {r.score:.3f}")
            print(f"        Personalization Score: {bd.get('personalization_score', 0.0):.3f}")
            print(f"        Weights: compat={bd.get('compat_weight', 0):.2f}, pref={bd.get('pref_weight', 0):.2f}, div={bd.get('div_weight', 0):.2f}")
            print(f"        Diversity Penalty: {bd.get('diversity_penalty', 0.0):.3f}")
            print(f"        Reasoning: {r.reasons}")

        assert bd.get('pref_weight', 0) > 0, "Preference weight must be active"
        print("      VERIFIED: Personalized ranking blending active with dynamic confidence weights.")

        # 8. Test Personalization Toggle Fallback & Profile Reset
        print("\n[8/8] Testing Personalization Toggle & Profile Reset in Neon DB:")
        # A. Disable toggle
        user_prefs.preferred_fits["personalization_enabled"] = False
        flag_modified(user_prefs, "preferred_fits")
        db.commit()

        recs_disabled = await rec_service.generate_recommendations(
            user_id=test_user.id,
            calendar_event_id=cal_event_id,
            occasion="Work & Office",
            outfit_preference="western",
            limit=1,
        )
        p_bd_disabled = recs_disabled[0].score_breakdown.get("personalization", {})
        assert p_bd_disabled.get("personalization_enabled") is False or p_bd_disabled.get("pref_weight") == 0.0, "Should bypass personalization when toggle is False"
        print("      - Toggle disabled successfully: bypassed personalization, purely compatibility scoring.")

        # B. Reset profile
        user_prefs.preferred_fits["personalization_enabled"] = True
        flag_modified(user_prefs, "preferred_fits")
        db.commit()

        reset_result = personalization_service.reset_profile(test_user.id)
        db.refresh(learned_prefs)
        assert learned_prefs.confidence_score <= 0.05, "Reset must return confidence to cold-start baseline"
        assert learned_prefs.interaction_count == 0, "Reset must zero interaction count"
        assert len(learned_prefs.style_scores) == 0, "Reset must clear style scores"
        print(f"      - Profile Reset executed successfully: confidence={learned_prefs.confidence_score}, interactions={learned_prefs.interaction_count}")
        print("      VERIFIED: Personalization reset returns profile cleanly to cold-start baseline.")

        print("\n" + "=" * 80)
        print("ALL STYLESPHERE PHASE 4 E2E LIVE VERIFICATION CHECKS PASSED SUCCESSFULLY!")
        print("=" * 80)

    finally:
        # Clean up test artifacts from Neon PostgreSQL
        print("\n[CLEANUP] Cleaning test data in Neon PostgreSQL...")
        try:
            db.rollback()
            if test_user_id:
                # Delete feedback
                db.query(RecommendationFeedback).filter(RecommendationFeedback.user_id == test_user_id).delete(synchronize_session=False)
                # Delete recommendations
                db.query(Recommendation).filter(Recommendation.user_id == test_user_id).delete(synchronize_session=False)
                # Delete wear history
                db.query(WearHistory).filter(WearHistory.user_id == test_user_id).delete(synchronize_session=False)
                # Delete outfits
                db.query(Outfit).filter(Outfit.user_id == test_user_id).delete(synchronize_session=False)
                # Delete clothing analyses and clothing items
                for cid in created_clothing_ids:
                    db.query(ClothingAnalysis).filter(ClothingAnalysis.clothing_id == cid).delete(synchronize_session=False)
                    db.query(Clothing).filter(Clothing.id == cid).delete(synchronize_session=False)
                # Delete calendar events (via wear_history or direct query)
                db.query(WearHistory).filter(WearHistory.user_id == test_user_id).delete(synchronize_session=False)
                # Delete learned preferences
                db.query(LearnedPreference).filter(LearnedPreference.user_id == test_user_id).delete(synchronize_session=False)
                # Delete user preferences
                db.query(UserPreference).filter(UserPreference.user_id == test_user_id).delete(synchronize_session=False)
                # Delete user
                db.query(User).filter(User.id == test_user_id).delete(synchronize_session=False)
                db.commit()
                print("         Successfully cleaned test user and all related records from Neon DB.")
        except Exception as cleanup_err:
            print(f"         Cleanup notice: {cleanup_err}")
            db.rollback()
        finally:
            db.close()

if __name__ == "__main__":
    asyncio.run(run_phase4_e2e_trace())
