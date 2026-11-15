import os
import time
import logging
import threading
from abc import ABC, abstractmethod
from pathlib import Path
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

# Module-level singleton session and lock to eliminate duplicate initialization and contention
_session = None
_session_lock = threading.Lock()
_input_name: Optional[str] = None
_session_initialized: bool = False
_model_file_resolved: Optional[str] = None


def _resolve_model_file(model_name: str = "u2netp", model_dir: Optional[str] = None) -> Optional[str]:
    """
    Search multiple reliable local directories for the ONNX segmentation model artifact.
    Avoids unnecessary network requests when artifact exists locally in repo or backend.
    """
    global _model_file_resolved
    if _model_file_resolved and os.path.exists(_model_file_resolved):
        return _model_file_resolved

    model_filename = f"{model_name}.onnx"
    base_file = Path(__file__).resolve()

    candidates = []
    if model_dir:
        candidates.append(Path(model_dir) / model_filename)

    configured_ai_path = getattr(settings, "AI_MODEL_PATH", "./ai_models")
    if configured_ai_path:
        candidates.append(Path(configured_ai_path) / model_filename)

    artifacts_dir = getattr(settings, "ARTIFACTS_DIR", None)
    if artifacts_dir:
        candidates.append(Path(artifacts_dir) / "models" / model_filename)
        candidates.append(Path(artifacts_dir) / model_filename)

    # Repository structure candidate paths
    candidates.extend([
        base_file.parents[2] / "ai_models" / model_filename,             # backend/ai_models
        base_file.parents[3] / "ai_models" / model_filename,             # repo_root/ai_models
        base_file.parents[2] / "artifacts" / "models" / model_filename,   # backend/artifacts/models
        base_file.parents[3] / "artifacts" / "models" / model_filename,   # repo_root/artifacts/models
        Path.cwd() / "backend" / "ai_models" / model_filename,
        Path.cwd() / "ai_models" / model_filename,
        Path("/opt/render/project/src/backend/ai_models") / model_filename,
        Path("/opt/render/project/src/ai_models") / model_filename,
    ])

    for c in candidates:
        try:
            if c.exists() and c.is_file() and c.stat().st_size > 1024 * 1024:
                resolved = str(c.resolve())
                _model_file_resolved = resolved
                logger.info(f"[Segmentation] Resolved local ONNX model at: {resolved}")
                return resolved
        except Exception:
            continue

    return None


def get_onnx_session(model_name: str = "u2netp", model_dir: Optional[str] = None):
    """
    Thread-safe, singleton ONNX Runtime session retriever.
    Loads and warms up the model exactly once per worker process.
    Reuses the initialized session across all concurrent and sequential requests.
    """
    global _session, _input_name, _session_initialized

    if _session is not None:
        return _session, _input_name

    with _session_lock:
        if _session is not None:
            return _session, _input_name

        model_path = _resolve_model_file(model_name, model_dir)

        # Download ONLY if file does not exist locally and URL is available
        if not model_path:
            target_dir = model_dir or getattr(settings, "AI_MODEL_PATH", "./ai_models")
            os.makedirs(target_dir, exist_ok=True)
            candidate_target = os.path.join(target_dir, f"{model_name}.onnx")
            if model_name in MODEL_URLS:
                try:
                    import httpx
                    logger.info(f"[Segmentation] Downloading pretrained model '{model_name}' once...")
                    with httpx.Client(follow_redirects=True, timeout=60.0) as client:
                        resp = client.get(MODEL_URLS[model_name])
                        if resp.status_code == 200:
                            with open(candidate_target, "wb") as f:
                                f.write(resp.content)
                            model_path = candidate_target
                            logger.info(f"[Segmentation] Downloaded and saved model to {model_path}.")
                except Exception as e:
                    logger.warning(f"[Segmentation] Could not download ONNX model '{model_name}': {e}")
                    model_path = None

        if not model_path or not os.path.exists(model_path):
            logger.warning(f"[Segmentation] ONNX model '{model_name}' artifact unavailable. Will use OpenCV fallback.")
            _session_initialized = True
            return None, None

        try:
            t0 = time.time()
            import onnxruntime as ort

            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            opts.inter_op_num_threads = 1
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            session = ort.InferenceSession(
                model_path,
                sess_options=opts,
                providers=["CPUExecutionProvider"],
            )
            input_name = session.get_inputs()[0].name

            # Warm up with expected input tensor shape (1, 3, 320, 320)
            warmup_tensor = np.zeros((1, 3, 320, 320), dtype=np.float32)
            session.run(None, {input_name: warmup_tensor})

            duration = round(time.time() - t0, 3)
            logger.info(f"[Segmentation] Initialized and warmed ONNX model '{model_name}' on CPU in {duration}s.")
            _session = session
            _input_name = input_name
            _session_initialized = True
            return _session, _input_name

        except Exception as e:
            logger.warning(f"[Segmentation] Failed to initialize ONNX session for '{model_name}': {e}")
            _session = None
            _input_name = None
            _session_initialized = True
            return None, None


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
    Thread-safe singleton session reuse: latency ~40-150ms on CPU. Memory footprint: < 50MB RAM.
    """

    def __init__(self, model_name: str = "u2netp", model_dir: str = settings.AI_MODEL_PATH):
        self.model_name = model_name
        self.model_dir = model_dir

    @property
    def session(self):
        sess, _ = get_onnx_session(self.model_name, self.model_dir)
        return sess

    @property
    def _input_name(self):
        _, in_name = get_onnx_session(self.model_name, self.model_dir)
        return in_name

    def segment(self, image: Image.Image) -> Tuple[np.ndarray, Dict[str, Any]]:
        sess, in_name = get_onnx_session(self.model_name, self.model_dir)
        if sess is None or in_name is None:
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
        outputs = sess.run(None, {in_name: tensor_in})
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
    Thread-safe, lazy or pre-warmed singleton.
    """

    def __init__(self):
        self._onnx_segmenter = OnnxGarmentSegmenter(model_name="u2netp")
        self._cv_segmenter = OpenCVGrabCutSegmenter()

    def warmup(self) -> bool:
        """Explicit warmup called during API lifespan or worker startup."""
        try:
            sess, _ = get_onnx_session("u2netp")
            return sess is not None
        except Exception as e:
            logger.warning(f"[Segmentation] Warmup notice: {e}")
            return False

    def is_onnx_ready(self) -> bool:
        """Returns True if the ONNX model is loaded and ready for inference."""
        return self._onnx_segmenter.session is not None

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
