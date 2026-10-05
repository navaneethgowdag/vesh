import sys
import os
from datetime import datetime, timezone
import uuid

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend"))

from app.core.database import SessionLocal, engine
from app.models import (
    Base,
    User,
    UserPreference,
    LearnedPreference,
    Clothing,
    Outfit,
    Post,
    Comment,
    Like,
    Follow,
    Collection,
    SavedItem,
    Recommendation,
    RecommendationFeedback,
    Notification,
)
from app.core.security import get_password_hash


def seed():
    print("Connecting to Neon PostgreSQL...")
    db = SessionLocal()

    try:
        # Check if Elena already exists
        existing_elena = db.query(User).filter(User.username == "elena_r").first()
        if existing_elena:
            print("Database already contains seed data for elena_r. Skipping creation.")
            return

        print("Seeding users...")
        pw_hash = get_password_hash("Password123!")

        elena = User(
            id=uuid.uuid4(),
            username="elena_r",
            email="elena.rostova@stylesphere.io",
            password_hash=pw_hash,
            display_name="Elena Rostova",
            bio="Architectural lines, warm neutral palettes, and curated timeless staples. Documenting modern daily rotation.",
            profile_image_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
            location="SoHo, New York",
            is_active=True,
            is_verified=True,
        )
        db.add(elena)
        db.flush()

        # Elena's explicit preferences
        elena_pref = UserPreference(
            user_id=elena.id,
            styles=["Minimal", "Smart Casual", "Quiet Luxury", "Casual"],
            favorite_colors=["Beige", "Cream", "Black", "Cognac", "White"],
            disliked_colors=["Neon Green", "Hot Pink"],
            preferred_categories=["Tops", "Bottoms", "Outerwear", "Shoes"],
            preferred_fits=["Relaxed / Oversized"],
            preferred_brands=["Toteme", "The Row", "COS", "Lemaire"],
            favorite_occasions=["Casual Daily", "Work & Office"],
            preferred_seasons=["All-Season", "Autumn"],
            fashion_goals=["Capsule Wardrobe", "Quiet Luxury"],
            climate_preference="Moderate",
        )
        db.add(elena_pref)

        # Elena's learned preferences
        elena_learned = LearnedPreference(
            user_id=elena.id,
            style_scores={"Minimal": 0.85, "Quiet Luxury": 0.90, "Smart Casual": 0.80, "Casual": 0.75},
            color_scores={"Black": 0.90, "Cream": 0.88, "Beige": 0.85, "Cognac": 0.82, "White": 0.80},
            category_scores={"Tops": 0.85, "Bottoms": 0.85, "Outerwear": 0.90, "Shoes": 0.80},
            fit_scores={"Relaxed / Oversized": 0.88, "Tailored / Slim": 0.70},
            occasion_scores={"Casual Daily": 0.90, "Work & Office": 0.85},
            season_scores={"Autumn": 0.88, "All-Season": 0.85},
            combination_scores={"Black+Cream": 0.92, "Beige+Cognac": 0.88},
            confidence_score=0.75,
            interaction_count=18,
        )
        db.add(elena_learned)

        # Creators
        creators_data = [
            {
                "username": "marcus.vance",
                "email": "marcus@sample.com",
                "name": "Marcus Vance",
                "bio": "Contemporary tailoring meets utilitarian streetwear. Coffee, film photography, and earthy tones.",
                "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
                "location": "London, UK",
            },
            {
                "username": "ariachen.style",
                "email": "aria@sample.com",
                "name": "Aria Chen",
                "bio": "Capsule wardrobe enthusiast & creative director. 30 pieces, infinite silhouettes. Less but better.",
                "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
                "location": "Paris, France",
            },
            {
                "username": "sofiareyes",
                "email": "sofia@sample.com",
                "name": "Sofia Reyes",
                "bio": "Summer linen, coastal effortless glam, vintage leather bags and gold jewelry detailing.",
                "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
                "location": "Barcelona, Spain",
            },
        ]

        creator_users = []
        for cdata in creators_data:
            cuser = User(
                id=uuid.uuid4(),
                username=cdata["username"],
                email=cdata["email"],
                password_hash=pw_hash,
                display_name=cdata["name"],
                bio=cdata["bio"],
                profile_image_url=cdata["avatar"],
                location=cdata["location"],
                is_active=True,
                is_verified=True,
            )
            db.add(cuser)
            creator_users.append(cuser)

        db.flush()

        # Follow relationships
        follow1 = Follow(follower_id=elena.id, following_id=creator_users[1].id)  # Aria
        follow2 = Follow(follower_id=elena.id, following_id=creator_users[2].id)  # Sofia
        db.add_all([follow1, follow2])

        # Seeding Elena's wardrobe
        print("Seeding wardrobe items...")
        wardrobe_items = [
            Clothing(
                id=uuid.uuid4(),
                user_id=elena.id,
                name="Oversized Structured Wool Coat",
                category="Outerwear",
                subcategory="Coat",
                color="Cognac",
                pattern="Solid",
                material="100% Virgin Wool",
                fit="Relaxed / Oversized",
                brand="Toteme",
                size="S",
                season="Autumn",
                occasion="Work & Office",
                style_tags=["Quiet Luxury", "Minimal"],
                image_url="https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=700&q=80",
                wear_count=8,
            ),
            Clothing(
                id=uuid.uuid4(),
                user_id=elena.id,
                name="Ribbed Mock-Neck Cashmere Knit",
                category="Tops",
                subcategory="Knitwear",
                color="Cream",
                pattern="Solid",
                material="Cashmere",
                fit="Relaxed / Oversized",
                brand="Lemaire",
                size="M",
                season="All-Season",
                occasion="Casual Daily",
                style_tags=["Minimal", "Casual"],
                image_url="https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=700&q=80",
                wear_count=14,
            ),
            Clothing(
                id=uuid.uuid4(),
                user_id=elena.id,
                name="Pleated Wide-Leg Wool Trousers",
                category="Bottoms",
                subcategory="Trousers",
                color="Black",
                pattern="Solid",
                material="Tropical Wool",
                fit="Relaxed / Oversized",
                brand="The Row",
                size="36",
                season="All-Season",
                occasion="Work & Office",
                style_tags=["Minimal", "Smart Casual"],
                image_url="https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=700&q=80",
                wear_count=12,
            ),
            Clothing(
                id=uuid.uuid4(),
                user_id=elena.id,
                name="Minimalist Leather Derby Loafers",
                category="Shoes",
                subcategory="Loafers",
                color="Black",
                pattern="Solid",
                material="Calfskin Leather",
                fit="Classic / Regular",
                brand="Jil Sander",
                size="38",
                season="All-Season",
                occasion="Casual Daily",
                style_tags=["Quiet Luxury", "Minimal"],
                image_url="https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=700&q=80",
                wear_count=18,
            ),
            Clothing(
                id=uuid.uuid4(),
                user_id=elena.id,
                name="Classic Heavyweight Cotton Tee",
                category="Tops",
                subcategory="T-Shirt",
                color="White",
                pattern="Solid",
                material="Organic Heavy Cotton",
                fit="Relaxed / Oversized",
                brand="Studio Nicholson",
                size="S",
                season="Summer",
                occasion="Casual Daily",
                style_tags=["Minimal", "Casual"],
                image_url="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=700&q=80",
                wear_count=22,
            ),
        ]
        db.add_all(wardrobe_items)
        db.flush()

        # Seed initial outfit
        print("Seeding outfits...")
        outfit = Outfit(
            id=uuid.uuid4(),
            user_id=elena.id,
            name="Effortless SoHo Gallery Walk",
            description="Tonal neutral layering with structured outerwear and wide-leg tailoring.",
            occasion="Casual Daily",
            season="Autumn",
            style="Quiet Luxury",
            compatibility_score=0.96,
            image_url=wardrobe_items[0].image_url,
            tags=["Casual Daily", "Autumn", "Minimal"],
        )
        outfit.clothing_items = wardrobe_items[:4]
        db.add(outfit)
        db.flush()

        # Seed posts
        print("Seeding posts...")
        post1 = Post(
            id=uuid.uuid4(),
            user_id=creator_users[1].id,  # Aria
            outfit_id=None,
            caption="Morning in Le Marais. A crisp oversized poplin shirt with vintage straight denim and chocolate suede boots.",
            image_url="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80",
            location="Paris, France",
            occasion="Casual Daily",
            tags=["ParisianStyle", "Minimal", "CapsuleWardrobe"],
            likes_count=142,
            comments_count=12,
            saves_count=48,
        )
        post2 = Post(
            id=uuid.uuid4(),
            user_id=elena.id,
            outfit_id=outfit.id,
            caption="Monday morning architecture review in SoHo. Toteme wool overcoat over cream cashmere and tailored black wool.",
            image_url="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80",
            location="SoHo, New York",
            occasion="Work & Office",
            tags=["QuietLuxury", "MinimalAesthetic", "OOTD"],
            likes_count=89,
            comments_count=6,
            saves_count=34,
        )
        db.add_all([post1, post2])
        db.flush()

        # Like and comment
        like1 = Like(user_id=elena.id, post_id=post1.id)
        comment1 = Comment(user_id=elena.id, post_id=post1.id, text="The silhouette and drape on this shirt are immaculate! Where is it from?")
        db.add_all([like1, comment1])

        # Recommendation and feedback
        print("Seeding recommendation and feedback...")
        rec = Recommendation(
            id=uuid.uuid4(),
            user_id=elena.id,
            outfit_id=outfit.id,
            recommendation_type="daily_fit",
            score=0.94,
            reasoning={
                "style_match": 0.95,
                "color_match": 0.94,
                "weather_match": 0.96,
                "occasion_match": 0.92,
                "learned_preference_match": 0.91,
                "compatibility": 0.96,
            },
            context={
                "weather": "Sunny",
                "temperature": 22,
                "city": "New York",
                "occasion": "Casual Daily",
                "reasons": [
                    "Calibrated for sunny skies and 22°C ambient temperature",
                    "Harmonizes with your preferred neutral & architectural aesthetic",
                    "High color synergy across cohesive neutral palette",
                ],
            },
            worn_status="worn",
        )
        db.add(rec)
        db.flush()

        feedback = RecommendationFeedback(
            id=uuid.uuid4(),
            user_id=elena.id,
            recommendation_id=rec.id,
            action="wear",
            metadata_json={"source": "daily_fit_card"},
        )
        db.add(feedback)

        # Collection
        collection = Collection(
            id=uuid.uuid4(),
            user_id=elena.id,
            name="Capsule Rotation",
            description="Core timeless pieces that effortlessly combine for autumn in the city.",
            cover_image=wardrobe_items[0].image_url,
            is_private=False,
            item_count=1,
            outfit_ids=[str(outfit.id)],
        )
        db.add(collection)

        # Notification
        notif = Notification(
            id=uuid.uuid4(),
            user_id=elena.id,
            actor_id=creator_users[1].id,
            type="like",
            title="Outfit Love",
            message="Aria Chen liked your Monday architecture review outfit.",
            target_id=str(post2.id),
            target_image=post2.image_url,
            is_read=False,
        )
        db.add(notif)

        db.commit()
        print("Database successfully seeded with comprehensive StyleSphere development data!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

