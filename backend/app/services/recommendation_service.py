import random
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.recommendation import Recommendation
from app.models.outfit import Outfit
from app.models.clothing import Clothing
from app.repositories.user_repository import UserRepository
from app.repositories.wardrobe_repository import WardrobeRepository
from app.repositories.outfit_repository import OutfitRepository
from app.repositories.recommendation_repository import RecommendationRepository
from app.services.weather_service import weather_service
from app.ai.outfit_compatibility import compatibility_engine
from app.ai.model_manager import model_manager


class RecommendationService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.wardrobe_repo = WardrobeRepository(db)
        self.outfit_repo = OutfitRepository(db)
        self.rec_repo = RecommendationRepository(db)

    async def generate_daily_fit(
        self,
        user_id: UUID,
        city: str = "New York",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        occasion: str = "Casual Daily",
        variation_seed: int = 0,
    ) -> Recommendation:
        # 1. Fetch user wardrobe
        wardrobe = self.wardrobe_repo.list_for_user(user_id, limit=200)
        if not wardrobe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your wardrobe is empty. Add clothing items to receive AI daily fit recommendations.",
            )

        # 2. Fetch user preferences (explicit and learned)
        explicit_pref = self.user_repo.get_preferences(user_id)
        learned_pref = self.user_repo.get_or_create_learned_preferences(user_id)

        # 3. Retrieve real weather from Open-Meteo
        weather = await weather_service.get_current_weather(
            city=city,
            latitude=latitude,
            longitude=longitude,
        )
        temp = float(weather.get("temp", 22.0))
        feels_like = float(weather.get("feels_like", temp))
        humidity = int(weather.get("humidity", 50))
        rain_prob = int(weather.get("rain_probability", 0))
        precip = float(weather.get("precipitation", 0.0))
        condition = weather.get("condition", "Partly Cloudy")

        # Determine target season based on temperature
        if temp >= 25.0:
            target_season = "Summer"
        elif temp <= 10.0:
            target_season = "Winter"
        elif temp <= 18.0:
            target_season = "Autumn"
        else:
            target_season = "Spring"

        # 4. Generate candidate outfit combinations
        candidates = self._generate_candidate_outfits(
            wardrobe=wardrobe,
            occasion=occasion,
            target_season=target_season,
            temp=temp,
            rain_prob=rain_prob,
        )

        if not candidates:
            candidates = [wardrobe[:min(4, len(wardrobe))]]

        # 5. Score candidates using reused model instance
        ml_model = model_manager.get_model()
        scored_candidates = []
        for candidate_items in candidates:
            score_data = self._score_candidate(
                items=candidate_items,
                explicit_pref=explicit_pref,
                learned_pref=learned_pref,
                weather=weather,
                occasion=occasion,
                target_season=target_season,
                ml_model=ml_model,
            )
            scored_candidates.append((candidate_items, score_data))

        # Sort descending by total score
        scored_candidates.sort(key=lambda x: x[1]["total_score"], reverse=True)

        # Apply variation seed for 'Try Another' cycling
        idx = variation_seed % len(scored_candidates)
        selected_items, best_score_data = scored_candidates[idx]

        # 6. Create or find Outfit in database
        outfit_name = f"Curated {occasion} Look"
        outfit = self.outfit_repo.create(
            user_id=user_id,
            clothing_item_ids=[i.id for i in selected_items],
            name=outfit_name,
            description=f"AI Daily Fit for {weather.get('city', city)} ({temp}°C, {condition}) matching your personal aesthetic.",
            occasion=occasion,
            season=target_season,
        )

        model_ver = "ml-rf-v1" if (ml_model and getattr(ml_model, "is_trained", False)) else "deterministic-v1"

        # 7. Save recommendation record in database with actual Neon columns
        rec = self.rec_repo.create(
            user_id=user_id,
            outfit_id=outfit.id,
            recommendation_score=best_score_data["total_score"],
            temperature=temp,
            feels_like_temperature=feels_like,
            humidity=float(humidity),
            weather_condition=condition,
            rain_probability=float(rain_prob),
            occasion=occasion,
            season=target_season,
            model_version=model_ver,
        )

        return rec

    def _generate_candidate_outfits(
        self,
        wardrobe: List[Clothing],
        occasion: str,
        target_season: str,
        temp: float,
        rain_prob: int,
    ) -> List[List[Clothing]]:
        tops = [i for i in wardrobe if i.category == "Tops"]
        bottoms = [i for i in wardrobe if i.category == "Bottoms"]
        shoes = [i for i in wardrobe if i.category == "Shoes"]
        outerwear = [i for i in wardrobe if i.category == "Outerwear"]
        dresses = [i for i in wardrobe if i.category == "Dresses"]
        accessories = [i for i in wardrobe if i.category in ("Accessories", "Bags")]

        candidates = []

        # Tops + Bottoms + Shoes combinations
        for top in tops[:4]:
            for bottom in bottoms[:4]:
                for shoe in shoes[:3]:
                    outfit = [top, bottom, shoe]
                    if (temp < 18.0 or rain_prob > 35) and outerwear:
                        outfit.append(outerwear[0])
                    elif outerwear and random.random() > 0.6:
                        outfit.append(outerwear[0])
                    if accessories:
                        outfit.append(accessories[0])
                    candidates.append(outfit)

        # Dress + Shoes combinations
        for dress in dresses[:3]:
            for shoe in shoes[:3]:
                outfit = [dress, shoe]
                if (temp < 18.0 or rain_prob > 35) and outerwear:
                    outfit.append(outerwear[0])
                if accessories:
                    outfit.append(accessories[0])
                candidates.append(outfit)

        return candidates

    def _score_candidate(
        self,
        items: List[Clothing],
        explicit_pref: Any,
        learned_pref: Any,
        weather: Dict[str, Any],
        occasion: str,
        target_season: str,
        ml_model: Optional[Any] = None,
    ) -> Dict[str, Any]:
        # 1. Compatibility
        compat = compatibility_engine.evaluate_compatibility(
            items=items,
            target_occasion=occasion,
            target_season=target_season,
        )
        compat_score = compat.get("overall_score", 0.90)

        # 2. Weather Suitability
        temp = float(weather.get("temp", 22.0))
        humidity = int(weather.get("humidity", 50))
        rain_prob = int(weather.get("rain_probability", 0))
        precip = float(weather.get("precipitation", 0.0))

        weather_score = 0.90
        has_outerwear = any(i.category == "Outerwear" for i in items)

        # Cold weather adjustments
        if temp < 15.0:
            if has_outerwear:
                weather_score += 0.08
            else:
                weather_score -= 0.20
        # Hot weather adjustments
        elif temp > 25.0:
            if has_outerwear:
                weather_score -= 0.25
            else:
                weather_score += 0.05

        # Rain & Precipitation adjustments
        if rain_prob > 40 or precip > 0.5:
            # Reward protective outerwear and waterproof materials
            if has_outerwear:
                weather_score += 0.08
            for item in items:
                material = (item.material or "").lower()
                if material in ("silk", "suede"):
                    weather_score -= 0.12  # vulnerable in rain
                elif material in ("nylon", "polyester", "leather", "denim"):
                    weather_score += 0.03

        # Humidity adjustments
        if humidity > 70 and temp > 22.0:
            for item in items:
                material = (item.material or "").lower()
                if material in ("linen", "cotton"):
                    weather_score += 0.04
                elif material in ("wool", "cashmere", "fleece"):
                    weather_score -= 0.08

        weather_score = max(0.2, min(1.0, weather_score))

        # 3. Explicit Preference Match
        explicit_score = 0.75
        if explicit_pref:
            fav_colors = set(c.lower() for c in (getattr(explicit_pref, "preferred_colors", []) or []))
            for item in items:
                if item.color and item.color.lower() in fav_colors:
                    explicit_score += 0.08
        explicit_score = max(0.2, min(1.0, explicit_score))

        # 4. Learned Preference Match
        learned_score = 0.50
        if learned_pref:
            color_scores = getattr(learned_pref, "color_scores", {}) or {}
            style_scores = getattr(learned_pref, "style_scores", {}) or {}
            scores_collected = []
            for item in items:
                if item.color and item.color in color_scores:
                    scores_collected.append(color_scores[item.color])
                if item.style_tags:
                    for st in item.style_tags:
                        if st in style_scores:
                            scores_collected.append(style_scores[st])

            if scores_collected:
                learned_score = sum(scores_collected) / len(scores_collected)
                learned_score = max(0.0, min(1.0, (learned_score + 1.0) / 2.0))
            else:
                learned_score = 0.70

        # 5. ML Model Prediction
        style_match = compat.get("style_score", 0.90)
        color_match = compat.get("color_score", 0.90)
        category_match = compat.get("category_score", 0.90)
        occasion_match = compat.get("occasion_score", compat.get("formality_score", 0.90))
        season_match = compat.get("season_score", 0.90)

        feature_dict = {
            "style_match": style_match,
            "color_match": color_match,
            "color_harmony": color_match,
            "style_harmony": style_match,
            "category_match": category_match,
            "weather_match": weather_score,
            "occasion_match": occasion_match,
            "season_match": season_match,
            "learned_preference_score": learned_score,
            "explicit_preference_score": explicit_score,
            "compatibility_score": compat_score,
            "wear_count_ratio": 0.5,
        }

        active_model = ml_model if ml_model is not None else model_manager.get_model()
        ml_score = active_model.predict_score(feature_dict)

        # Final blended score
        total_score = round(0.40 * ml_score + 0.35 * compat_score + 0.25 * learned_score, 3)

        return {
            "total_score": total_score,
            "compatibility_score": compat_score,
            "weather_score": weather_score,
            "reasoning": {
                "style_match": style_match,
                "color_match": color_match,
                "weather_match": weather_score,
                "occasion_match": occasion_match,
                "learned_preference_match": learned_score,
                "compatibility": compat_score,
            },
        }
