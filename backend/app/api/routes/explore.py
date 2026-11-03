from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user_optional
from app.models.user import User
from app.schemas.community import CommunityResponse
from app.schemas.explore import (
    ExploreFeedResponse,
    TrendingResponse,
    ExplorePeopleResponse,
)
from app.services.explore_service import ExploreService

router = APIRouter(prefix="/explore", tags=["explore"])


@router.get("/feed", response_model=ExploreFeedResponse)
def get_for_you_feed(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = ExploreService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_for_you_feed(viewer_id=viewer_id, limit=limit, offset=offset)


@router.get("/communities", response_model=List[CommunityResponse])
def get_explore_communities(
    category: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = ExploreService(db)
    viewer_id = current_user.id if current_user else None
    return service.get_explore_communities(
        category=category,
        query=query,
        viewer_id=viewer_id,
        limit=limit,
        offset=offset,
    )


@router.get("/trending", response_model=TrendingResponse)
def get_trending(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = ExploreService(db)
    viewer_id = current_user.id if current_user else None
    items = service.get_trending(viewer_id=viewer_id, limit=limit)
    return {"items": items}


@router.get("/people", response_model=ExplorePeopleResponse)
def get_people_recommendations(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    service = ExploreService(db)
    viewer_id = current_user.id if current_user else None
    people = service.get_people_recommendations(viewer_id=viewer_id, limit=limit)
    return {"people": people}
