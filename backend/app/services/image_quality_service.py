import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import cv2
from PIL import Image

logger = logging.getLogger(__name__)


class QualityAssessment:
    def __init__(
        self,
        is_valid: bool,
        review_required: bool,
        quality_score: float,
        blur_score: float,
        brightness_score: float,
        foreground_ratio: float,
        issues: List[str],
    ):
        self.is_valid = is_valid
        self.review_required = review_required
        self.quality_score = quality_score
        self.blur_score = blur_score
        self.brightness_score = brightness_score
        self.foreground_ratio = foreground_ratio
        self.issues = issues

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "review_required": self.review_required,
            "quality_score": round(self.quality_score, 2),
            "blur_score": round(self.blur_score, 2),
            "brightness_score": round(self.brightness_score, 2),
            "foreground_ratio": round(self.foreground_ratio, 4),
            "issues": self.issues,
        }


class ImageQualityService:
    """
    Measurable quality assessment service for garment images and segmentation masks.
    Detects blur, excessive darkness/brightness, empty masks, and cropping anomalies.
    """

    MIN_LAPLACIAN_VAR = 25.0       # Below this indicates significant blur
    MIN_BRIGHTNESS = 25.0           # Very dark / underexposed
    MAX_BRIGHTNESS = 248.0          # Washed out / overexposed
    MIN_FOREGROUND_RATIO = 0.03     # At least 3% of canvas must be garment
    MAX_FOREGROUND_RATIO = 0.98     # More than 98% means background removal failed

    @classmethod
    def assess_input_image(cls, image: Image.Image) -> Tuple[bool, float, float, List[str]]:
        """
        Evaluate raw input image prior to segmentation.
        Returns: (is_pass, blur_var, mean_brightness, issues)
        """
        issues: List[str] = []
        cv_img = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

        # 1. Blur test via Laplacian variance
        blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if blur_var < cls.MIN_LAPLACIAN_VAR:
            issues.append("Low image sharpness / potential blur detected.")

        # 2. Brightness test via mean gray level
        brightness = float(np.mean(gray))
        if brightness < cls.MIN_BRIGHTNESS:
            issues.append("Image is severely underexposed or dark.")
        elif brightness > cls.MAX_BRIGHTNESS:
            issues.append("Image is overexposed or blown out.")

        # 3. Minimum resolution check
        w, h = image.size
        if w < 100 or h < 100:
            issues.append("Image resolution is too low for reliable garment segmentation.")

        is_pass = len(issues) == 0
        return is_pass, blur_var, brightness, issues

    @classmethod
    def assess_segmentation_quality(
        cls,
        image: Image.Image,
        mask: np.ndarray,
    ) -> QualityAssessment:
        """
        Evaluate segmentation mask quality and foreground integrity.
        """
        is_pass, blur_var, brightness, issues = cls.assess_input_image(image)

        total_pixels = mask.shape[0] * mask.shape[1]
        fg_pixels = int(np.count_nonzero(mask > 127))
        fg_ratio = fg_pixels / max(total_pixels, 1)

        review_required = False
        is_valid = True

        # Check empty mask
        if fg_ratio < cls.MIN_FOREGROUND_RATIO:
            issues.append("No distinct garment isolated in the photograph.")
            is_valid = False
            review_required = True

        # Check unsegmented / full frame
        elif fg_ratio > cls.MAX_FOREGROUND_RATIO:
            issues.append("Background separation incomplete; mask covers entire canvas.")
            review_required = True

        # Check boundary touch / excessive cropping
        h, w = mask.shape[:2]
        top_touch = np.any(mask[0, :] > 127)
        bottom_touch = np.any(mask[h - 1, :] > 127)
        left_touch = np.any(mask[:, 0] > 127)
        right_touch = np.any(mask[:, w - 1] > 127)
        edges_touched = sum([top_touch, bottom_touch, left_touch, right_touch])

        if edges_touched >= 3:
            issues.append("Garment touches multiple image boundaries and may be partially cropped.")
            review_required = True

        # Compute composite quality score (0.0 to 1.0)
        score = 1.0
        if blur_var < 50.0:
            score -= 0.15
        if brightness < 40.0 or brightness > 230.0:
            score -= 0.15
        if review_required:
            score -= 0.25
        if not is_valid:
            score -= 0.40
        quality_score = max(0.05, min(1.0, score))

        return QualityAssessment(
            is_valid=is_valid,
            review_required=review_required or not is_pass,
            quality_score=quality_score,
            blur_score=blur_var,
            brightness_score=brightness,
            foreground_ratio=fg_ratio,
            issues=issues,
        )


quality_service = ImageQualityService()
