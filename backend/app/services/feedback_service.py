from typing import Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.recommendation_feedback import RecommendationFeedback
from app.repositories.recommendation_repository import RecommendationRepository
from app.services.personalization_service import PersonalizationService
from app.utils.enums import FeedbackAction


class FeedbackService:
    def __init__(self, db: Session):
        self.db = db
        self.rec_repo = RecommendationRepository(db)
        self.personalization_service = PersonalizationService(db)

    def process_feedback(
        self,
        user_id: UUID,
        recommendation_id: UUID,
        action: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> RecommendationFeedback:
        action_clean = action.strip().lower()
        valid_actions = {a.value for a in FeedbackAction}
        if action_clean not in valid_actions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid feedback action '{action}'. Must be one of: {list(valid_actions)}",
            )

        rec = self.rec_repo.get_by_id(recommendation_id)
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recommendation not found",
            )

        if rec.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this recommendation",
            )

        # 1. Save feedback in database
        feedback = self.rec_repo.save_feedback(
            user_id=user_id,
            recommendation_id=recommendation_id,
            action=action_clean,
            metadata=metadata,
        )

        # 2. Trigger adaptive personalization update
        if rec.outfit:
            self.personalization_service.record_feedback(
                user_id=user_id,
                outfit=rec.outfit,
                action=action_clean,
            )

        return feedback

