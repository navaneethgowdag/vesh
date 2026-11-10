"""
TailorBird Shopping Recommendation & Product Ranking Service.
Analyzes user's accepted wardrobe, detected gaps, and personalized style profile
to recommend and rank intelligent fashion purchases.
"""

from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.user_preference import UserPreference
from app.models.clothing import Clothing
from app.services.wardrobe_gap_service import WardrobeGapService
from app.services.shopping.product_provider import (
    ProductDiscoveryService,
    ProductSearchRequest,
    ProductResult,
    ProviderStatus,
)


class ProductRankingService:
    """
    Ranks shopping discovery products against the user's specific styling profile:
    - Gap relevance (35%)
    - Style aesthetics match (20%)
    - Color preferences & avoidances (20%)
    - Budget tier alignment (15%)
    - Wardrobe compatibility (10%)
    """

    @staticmethod
    def score_product(
        product: ProductResult,
        user_pref: Optional[UserPreference],
        user_clothing: List[Clothing],
        gap_id: Optional[str] = None,
    ) -> float:
        score = 0.50

        if not user_pref:
            return score

        fits_dict = user_pref.preferred_fits if isinstance(user_pref.preferred_fits, dict) else {}
        preferred_styles = [s.lower() for s in (user_pref.preferred_styles or [])]
        preferred_colors = [c.lower() for c in (user_pref.preferred_colors or [])]
        avoided_colors = [c.lower() for c in fits_dict.get("avoided_colors", [])]
        budget_tier = fits_dict.get("budget_preference") or (
            user_pref.shopping_preferences.get("budget_tier") if user_pref.shopping_preferences else "mid_range"
        )

        p_style = (product.style or "").lower()
        p_color = (product.color or "").lower()

        # 1. Gap Relevance (Score bonus: +0.25)
        if product.gap_id and product.gap_id == gap_id:
            score += 0.25
        elif product.gap_id:
            score += 0.15

        # 2. Style Aesthetics (+0.15 for matching style)
        if p_style and any(s in p_style or p_style in s for s in preferred_styles):
            score += 0.15

        # 3. Color Preferences (+0.15 for favorite, -0.30 for avoided)
        if p_color:
            if any(c in p_color or p_color in c for c in preferred_colors):
                score += 0.15
            if any(c in p_color or p_color in c for c in avoided_colors):
                score -= 0.30

        # 4. Budget Tier (+0.10 for exact match)
        if budget_tier and product.budget_tier.lower() == str(budget_tier).lower():
            score += 0.10

        # 5. Wardrobe Compatibility (+0.10 if coordinates with existing items)
        cat_lower = product.category.lower()
        if "blazer" in cat_lower or "outerwear" in cat_lower:
            # High compatibility if user owns shirts/chinos
            if any("shirt" in (c.category or "").lower() or "trouser" in (c.category or "").lower() for c in user_clothing):
                score += 0.10
        elif "footwear" in cat_lower:
            score += 0.08

        return max(0.1, min(1.0, score))


class ShoppingRecommendationService:
    def __init__(self, db: Session):
        self.db = db
        self.gap_service = WardrobeGapService(db)
        self.discovery_service = ProductDiscoveryService()
        self.ranking_service = ProductRankingService()

    def get_gap_recommendations(self, user_id: UUID, limit: int = 8) -> Dict[str, Any]:
        """
        Generates personalized shopping recommendations directly linked to identified wardrobe gaps.
        """
        # 1. Fetch user preferences & accepted wardrobe
        pref = self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        accepted_items = (
            self.db.query(Clothing)
            .filter(
                Clothing.user_id == user_id,
            )
            .all()
        )
        # Exclude pending review items
        active_items = [i for i in accepted_items if not getattr(i, "review_required", False)]

        # 2. Check if external shopping provider is configured
        provider_status = self.discovery_service.get_status()
        if not provider_status.is_live_configured:
            return {
                "user_id": str(user_id),
                "recommendations": [],
                "total_count": 0,
                "provider_status": provider_status.model_dump(),
            }

        # 3. Run gap analysis
        gap_analysis = self.gap_service.analyze_wardrobe(user_id=user_id)
        gaps = gap_analysis.get("gaps", [])

        dismissed_ids = set(pref.dismissed_products if pref else [])
        saved_ids = set(pref.saved_products if pref else [])

        all_recommendations: List[ProductResult] = []

        # 3. For each gap, query product discovery provider
        for idx, gap in enumerate(gaps[:3]):
            gap_id = f"gap-{idx}"
            query = gap.get("title") or gap.get("category") or "essentials"
            suggested = gap.get("suggested_garments", [])
            search_q = suggested[0] if suggested else query

            req = ProductSearchRequest(
                query=search_q,
                category=gap.get("category"),
                budget_tier=pref.shopping_preferences.get("budget_tier", "mid_range") if pref else "mid_range",
                gap_id=gap_id,
                gap_title=gap.get("title"),
                limit=4,
            )
            results = self.discovery_service.search_products(req)
            for r in results:
                if r.id in dismissed_ids:
                    continue
                r.is_saved = r.id in saved_ids
                r.gap_id = gap_id
                r.match_reason = (
                    f"Directly resolves your '{gap.get('title')}' gap. "
                    f"Completes versatile outfits across {', '.join(gap.get('occasions', ['Daily styling'])[:2])}."
                )
                all_recommendations.append(r)

        # If few gaps or empty wardrobe, add foundational essentials
        if len(all_recommendations) < 3:
            req = ProductSearchRequest(
                query="white shirt oxford sneakers",
                budget_tier=pref.shopping_preferences.get("budget_tier", "mid_range") if pref else "mid_range",
                limit=4,
            )
            for r in self.discovery_service.search_products(req):
                if r.id not in dismissed_ids and r.id not in [x.id for x in all_recommendations]:
                    r.is_saved = r.id in saved_ids
                    r.match_reason = "Core wardrobe building block that unlocks multiple outfit combinations."
                    all_recommendations.append(r)

        # 4. Rank products
        scored = [
            (
                self.ranking_service.score_product(p, pref, active_items, p.gap_id),
                p,
            )
            for p in all_recommendations
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        ranked = [p for _, p in scored[:limit]]

        provider_status = self.discovery_service.get_status()

        return {
            "user_id": str(user_id),
            "recommendations": [p.model_dump() for p in ranked],
            "total_count": len(ranked),
            "provider_status": provider_status.model_dump(),
        }

    def get_trending_in_your_style(self, user_id: UUID, limit: int = 6) -> Dict[str, Any]:
        """
        Trending clothing discovery is deferred behind feature flag (Section 1).
        Returns empty trending list with honest deferred/blocked status.
        """
        return {
            "user_id": str(user_id),
            "trending_products": [],
            "style_theme": "",
            "provider_status": {
                "is_live_configured": False,
                "status": "blocked",
                "message": "Trending clothing discovery is deferred behind feature flag.",
            },
        }

    def save_product(self, user_id: UUID, product_id: str, product_data: Optional[Dict[str, Any]] = None) -> bool:
        pref = self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        if not pref:
            pref = UserPreference(user_id=user_id)
            self.db.add(pref)
        saved = list(pref.saved_products or [])
        if product_id not in saved:
            saved.append(product_id)
            pref.saved_products = saved
            self.db.commit()
        return True

    def dismiss_product(self, user_id: UUID, product_id: str) -> bool:
        pref = self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        if not pref:
            pref = UserPreference(user_id=user_id)
            self.db.add(pref)
        dismissed = list(pref.dismissed_products or [])
        if product_id not in dismissed:
            dismissed.append(product_id)
            pref.dismissed_products = dismissed
            self.db.commit()
        return True

    def mark_already_owned(self, user_id: UUID, product_id: str, gap_category: Optional[str] = None) -> bool:
        pref = self.db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        if not pref:
            pref = UserPreference(user_id=user_id)
            self.db.add(pref)
        dismissed = list(pref.dismissed_products or [])
        if product_id not in dismissed:
            dismissed.append(product_id)
            pref.dismissed_products = dismissed
            self.db.commit()
        return True
