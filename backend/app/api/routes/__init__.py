from fastapi import APIRouter
from app.api.routes import (
    auth,
    users,
    wardrobe,
    clothing_ai,
    outfits,
    recommendations,
    weather,
    posts,
    comments,
    social,
    saved,
    notifications,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(wardrobe.router)
api_router.include_router(clothing_ai.router)
api_router.include_router(outfits.router)
api_router.include_router(recommendations.router)
api_router.include_router(weather.router)
api_router.include_router(posts.router)
api_router.include_router(comments.router)
api_router.include_router(social.router)
api_router.include_router(saved.router)
api_router.include_router(notifications.router)

__all__ = ["api_router"]

