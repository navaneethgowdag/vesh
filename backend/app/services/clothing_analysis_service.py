import io
import logging
from typing import Dict, Any, Optional
from uuid import UUID
from PIL import Image
import httpx
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.ai.clothing_classifier import clothing_classifier
from app.repositories.wardrobe_repository import WardrobeRepository

logger = logging.getLogger(__name__)


class ClothingAnalysisService:
    def __init__(self, db: Session):
        self.db = db
        self.wardrobe_repo = WardrobeRepository(db)

    async def analyze_and_save(self, clothing_id: UUID, image_url: Optional[str] = None) -> Dict[str, Any]:
        item = self.wardrobe_repo.get_by_id(clothing_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clothing item not found")

        target_url = image_url or item.image_url
        pil_image = await self._load_image_from_url(target_url)

        if pil_image is None:
            # Create graceful default placeholder analysis
            pil_image = Image.new("RGB", (200, 200), color=(230, 225, 220))

        analysis_result = clothing_classifier.predict(pil_image)

        # Save to database using exact Neon columns
        self.wardrobe_repo.save_analysis(
            clothing_id=clothing_id,
            detected_category=analysis_result.get("detected_category"),
            detected_subcategory=analysis_result.get("detected_subcategory"),
            detected_colors=analysis_result.get("dominant_colors") or [],
            detected_pattern=analysis_result.get("pattern"),
            detected_material=analysis_result.get("material"),
            detected_fit=analysis_result.get("fit"),
            style_tags=analysis_result.get("style_tags") or [],
            season_tags=analysis_result.get("season_tags") or [],
            occasion_tags=analysis_result.get("occasion_tags") or [],
            confidence=analysis_result.get("confidence", 0.85),
            feature_vector=analysis_result.get("feature_vector") or [],
        )

        return analysis_result

    async def _load_image_from_url(self, url: Optional[str]) -> Optional[Image.Image]:
        if not url or not url.startswith("http"):
            return None
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return Image.open(io.BytesIO(resp.content))
        except Exception as e:
            logger.warning(f"Failed to fetch image from {url}: {e}")
        return None
