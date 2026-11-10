from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.wardrobe_gap import WardrobeGapResponse
from app.services.wardrobe_gap_service import WardrobeGapService
from app.services.shopping.shopping_service import ShoppingRecommendationService

router = APIRouter(prefix="/wardrobe", tags=["wardrobe-gap"])


@router.get(
    "/gap-analysis",
    response_model=WardrobeGapResponse,
    status_code=status.HTTP_200_OK,
)
def get_wardrobe_gap_analysis(
    force_refresh: bool = Query(False, description="Bypass cache and force fresh analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyzes authenticated user's actual accepted wardrobe, category distributions, formality balance,
    colour mix, wear history, and upcoming calendar requirements to detect actionable wardrobe gaps.
    """
    service = WardrobeGapService(db)
    return service.analyze_wardrobe(user_id=current_user.id, force_refresh=force_refresh)


@router.post(
    "/gap-analysis/refresh",
    response_model=WardrobeGapResponse,
    status_code=status.HTTP_200_OK,
)
def refresh_wardrobe_gap_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Explicitly triggers a fresh recalculation of wardrobe gaps."""
    service = WardrobeGapService(db)
    return service.analyze_wardrobe(user_id=current_user.id, force_refresh=True)


@router.get(
    "/shopping-recommendations",
    status_code=status.HTTP_200_OK,
)
def get_shopping_recommendations(
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns personalized shopping recommendations that directly resolve identified wardrobe gaps,
    ranked according to user's style preferences, color harmony, and budget tier.
    """
    service = ShoppingRecommendationService(db)
    return service.get_gap_recommendations(user_id=current_user.id, limit=limit)


@router.get(
    "/trending",
    status_code=status.HTTP_200_OK,
)
def get_trending_shopping_products(
    limit: int = Query(6, ge=1, le=15),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns contemporary fashion trend recommendations filtered by authenticated user's style aesthetics.
    """
    service = ShoppingRecommendationService(db)
    return service.get_trending_in_your_style(user_id=current_user.id, limit=limit)


@router.post(
    "/shopping-products/{product_id}/save",
    status_code=status.HTTP_200_OK,
)
def save_shopping_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Saves recommended product to user's personal wishlist."""
    service = ShoppingRecommendationService(db)
    success = service.save_product(user_id=current_user.id, product_id=product_id)
    return {"success": success, "product_id": product_id, "message": "Saved to wishlist."}


@router.post(
    "/shopping-products/{product_id}/dismiss",
    status_code=status.HTTP_200_OK,
)
def dismiss_shopping_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dismisses product so it is not shown again."""
    service = ShoppingRecommendationService(db)
    success = service.dismiss_product(user_id=current_user.id, product_id=product_id)
    return {"success": success, "product_id": product_id, "message": "Product dismissed."}


@router.post(
    "/shopping-products/{product_id}/already-own",
    status_code=status.HTTP_200_OK,
)
def mark_product_already_owned(
    product_id: str,
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Flags that user already owns a piece similar to this recommendation."""
    service = ShoppingRecommendationService(db)
    success = service.mark_already_owned(user_id=current_user.id, product_id=product_id, gap_category=category)
    return {"success": success, "product_id": product_id, "message": "Marked as already owned."}

