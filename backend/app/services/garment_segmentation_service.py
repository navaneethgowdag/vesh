import os
import time
import logging
from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any, Optional
import numpy as np
import cv2
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Model download URLs (Apache 2.0 license)
MODEL_URLS = {
    "u2netp": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
    "u2net_cloth_seg": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_cloth_seg.onnx",
}


class BaseGarmentSegmenter(ABC):
    """Abstract interface for garment segmentation implementations."""

    @abstractmethod
    def segment(self, image: Image.Image) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Segment garment from image.
        Returns: (mask_uint8, metadata_dict)
        where mask_uint8 has shape (H, W) with values in range [0, 255].
        """
        pass


class OnnxGarmentSegmenter(BaseGarmentSegmenter):
    """
    CPU-optimized ONNX Runtime garment segmentation.
    Uses pretrained U-2-Net portable model (Apache 2.0 license).
    Inference latency: ~80-350ms on CPU. Memory footprint: < 50MB RAM.
    """

    def __init__(self, model_name: str = "u2netp", model_dir: str = settings.AI_MODEL_PATH):
        self.model_name = model_name
        self.model_dir = model_dir
        self.session = None
        self._input_name = None
        self._ensure_model()

    def _ensure_model(self) -> None:
        os.makedirs(self.model_dir, exist_ok=True)
        model_filename = f"{self.model_name}.onnx"
        self.model_path = os.path.join(self.model_dir, model_filename)

        if not os.path.exists(self.model_path) and self.model_name in MODEL_URLS:
            try:
                import httpx
                logger.info(f"Downloading pretrained segmentation model '{self.model_name}'...")
                with httpx.Client(follow_redirects=True, timeout=60.0) as client:
                    resp = client.get(MODEL_URLS[self.model_name])
                    if resp.status_code == 200:
                        with open(self.model_path, "wb") as f:
                            f.write(resp.content)
                        logger.info(f"Model saved to {self.model_path} ({len(resp.content)} bytes).")
            except Exception as e:
                logger.warning(f"Could not download ONNX model '{self.model_name}': {e}")

        if os.path.exists(self.model_path):
            try:
                import onnxruntime as ort
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 2
                opts.inter_op_num_threads = 1
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(
                    self.model_path,
                    sess_options=opts,
                    providers=["CPUExecutionProvider"],
                )
                self._input_name = self.session.get_inputs()[0].name
                logger.info(f"Loaded ONNX segmentation model '{self.model_name}' on CPU.")
            except Exception as e:
                logger.warning(f"Failed to initialize ONNX session for '{self.model_name}': {e}")
                self.session = None

    def segment(self, image: Image.Image) -> Tuple[np.ndarray, Dict[str, Any]]:
        if self.session is None:
            raise RuntimeError(f"ONNX session for {self.model_name} is not initialized.")

        t0 = time.time()
        orig_w, orig_h = image.size
        rgb_img = image.convert("RGB")

        # 1. Preprocess: resize to 320x320 and normalize
        target_size = (320, 320)
        resized = rgb_img.resize(target_size, Image.Resampling.BILINEAR)
        img_np = np.array(resized, dtype=np.float32) / 255.0

        # Normalization with ImageNet mean/std
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        norm_img = (img_np - mean) / std
        tensor_in = np.transpose(norm_img, (2, 0, 1))[np.newaxis, :, :, :]  # (1, 3, 320, 320)

        # 2. Inference
        outputs = self.session.run(None, {self._input_name: tensor_in})
        pred = outputs[0][0, 0]  # First output tensor shape (320, 320)

        # 3. Postprocess probability map
        mi = float(np.min(pred))
        ma = float(np.max(pred))
        norm_pred = (pred - mi) / max(ma - mi, 1e-8)

        # 4. Resize back to original dimensions
        mask = cv2.resize((norm_pred * 255).astype(np.uint8), (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
        duration_ms = (time.time() - t0) * 1000

        meta = {
            "model_name": self.model_name,
            "model_version": "1.0-onnx",
            "inference_duration_ms": round(duration_ms, 2),
            "engine": "onnxruntime-cpu",
        }
        return mask, meta


class OpenCVGrabCutSegmenter(BaseGarmentSegmenter):
    """
    Zero-dependency, offline computer vision segmenter using GrabCut, color saliency,
    and adaptive contrast refinement. Serves as reliable CPU fallback.
    """

    def segment(self, image: Image.Image) -> Tuple[np.ndarray, Dict[str, Any]]:
        t0 = time.time()
        orig_w, orig_h = image.size
        cv_img = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)

        # Resize for fast processing if very large
        max_dim = 600
        scale = min(max_dim / max(orig_w, orig_h), 1.0)
        if scale < 1.0:
            small_w = int(orig_w * scale)
            small_h = int(orig_h * scale)
            small_img = cv2.resize(cv_img, (small_w, small_h), interpolation=cv2.INTER_AREA)
        else:
            small_img = cv_img
            small_w, small_h = orig_w, orig_h

        # Setup GrabCut mask with central prior (garment typically occupies central 70-80%)
        margin_x = max(10, int(small_w * 0.08))
        margin_y = max(10, int(small_h * 0.08))
        rect = (margin_x, margin_y, small_w - 2 * margin_x, small_h - 2 * margin_y)

        mask = np.zeros((small_h, small_w), np.uint8)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)

        try:
            cv2.grabCut(small_img, mask, rect, bgd_model, fgd_model, iterCount=3, mode=cv2.GC_INIT_WITH_RECT)
            # Foregrounds are values 1 (GC_FGD) or 3 (GC_PR_FGD)
            bin_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        except Exception:
            # Fallback to Otsu threshold on saturation channel
            hsv = cv2.cvtColor(small_img, cv2.COLOR_BGR2HSV)
            s_chan = hsv[:, :, 1]
            _, bin_mask = cv2.threshold(s_chan, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Scale back to original resolution
        if scale < 1.0:
            full_mask = cv2.resize(bin_mask, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
        else:
            full_mask = bin_mask

        duration_ms = (time.time() - t0) * 1000
        meta = {
            "model_name": "opencv_grabcut",
            "model_version": "cv2-fallback",
            "inference_duration_ms": round(duration_ms, 2),
            "engine": "opencv-cpu",
        }
        return full_mask, meta


class GarmentSegmentationService:
    """
    Segmentation orchestrator providing preferred ONNX inference with OpenCV fallback.
    """

    def __init__(self):
        self._onnx_segmenter: Optional[OnnxGarmentSegmenter] = None
        self._cv_segmenter = OpenCVGrabCutSegmenter()
        self._init_primary()

    def _init_primary(self) -> None:
        try:
            self._onnx_segmenter = OnnxGarmentSegmenter(model_name="u2netp")
            if self._onnx_segmenter.session is None:
                self._onnx_segmenter = None
        except Exception as e:
            logger.warning(f"Could not initialize primary ONNX segmenter: {e}")
            self._onnx_segmenter = None

    def segment(self, image: Image.Image) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Execute garment segmentation. Tries ONNX model first; falls back to OpenCV.
        """
        if self._onnx_segmenter and self._onnx_segmenter.session is not None:
            try:
                return self._onnx_segmenter.segment(image)
            except Exception as e:
                logger.warning(f"ONNX segmentation failed ({e}). Falling back to OpenCV GrabCut.")

        return self._cv_segmenter.segment(image)


garment_segmentation_service = GarmentSegmentationService()
