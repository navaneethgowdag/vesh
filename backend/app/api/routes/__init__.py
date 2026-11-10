from fastapi import APIRouter
from app.core.config import settings
from app.api.routes import (
    auth,
    users,
    wardrobe,
    clothing,
    clothing_ai,
    outfits,
    recommendations,
    weather,
    posts,
    comments,
    social,
    saved,
    notifications,
    calendar,
    media,
    moments,
    polls,
    communities,
    messages,
    explore,
    planner,
    wardrobe_gap,
    laundry,
    vault,
    model_learning,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(wardrobe_gap.router)
api_router.include_router(wardrobe.router)
api_router.include_router(clothing.router)
api_router.include_router(clothing_ai.router)
api_router.include_router(outfits.router)
api_router.include_router(recommendations.router)
api_router.include_router(laundry.router)
api_router.include_router(vault.router)
api_router.include_router(model_learning.router)
api_router.include_router(weather.router)
api_router.include_router(posts.router)
api_router.include_router(comments.router)
api_router.include_router(social.router)
api_router.include_router(saved.router)
api_router.include_router(notifications.router)
api_router.include_router(calendar.router)
api_router.include_router(media.router)
api_router.include_router(moments.router)
api_router.include_router(polls.router)
api_router.include_router(planner.router)

# Deferred and optional modules behind disabled feature flags
if settings.ENABLE_COMMUNITIES:
    api_router.include_router(communities.router)
if settings.ENABLE_MESSAGES:
    api_router.include_router(messages.router)
if settings.ENABLE_EXPLORE:
    api_router.include_router(explore.router)

__all__ = ["api_router"]
