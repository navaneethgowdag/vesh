import os
import sys
import signal
import time
import logging
from rq import Queue
from rq.job import Job
from app.core.config import settings
from app.core.redis import get_rq_redis_client
from app.core.database import verify_database_connection

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("stylesphere.worker")

QUEUES = ["stylesphere-default"]


def run_worker():
    """
    Start the StyleSphere RQ background worker.
    Cross-platform: uses SimpleWorker on Windows (no fork support) and Worker on Linux.
    Uses binary Redis connection (decode_responses=False) for pickle serialization.
    """
    logger.info("==================================================================")
    logger.info("[Worker Startup] Initializing StyleSphere background CPU worker...")
    logger.info("==================================================================")

    # 1. Verify PostgreSQL Database Connectivity
    if verify_database_connection():
        logger.info("[Worker Startup] Connected to Neon PostgreSQL successfully.")
    else:
        logger.error("[Worker Startup] Failed to connect to PostgreSQL database. Exiting.")
        sys.exit(1)

    # 2. Verify Redis Connectivity with binary connection for RQ
    if not settings.REDIS_ENABLED or not settings.redis_connection_url:
        logger.error(
            "[Worker Startup] REDIS_ENABLED is false or REDIS_URL is not set. "
            "Worker requires an active Redis / Upstash connection. Exiting."
        )
        sys.exit(1)

    redis_conn = get_rq_redis_client()
    if not redis_conn:
        logger.error("[Worker Startup] Could not establish connection to Redis broker. Exiting.")
        sys.exit(1)

    logger.info("[Worker Startup] Connected to Redis / Upstash broker successfully.")

    # 3. Preload AI classification and segmentation models into memory
    try:
        from app.ai.fashion_model import fashion_model_service
        from app.services.garment_segmentation_service import garment_segmentation_service

        logger.info("[Worker Startup] Preloading MultiTaskEfficientNetB0 fashion classification model...")
        loaded = fashion_model_service.load_model()
        if loaded:
            logger.info(f"[Worker Startup] Fashion model ready. Version: {fashion_model_service.model_version}, Device: {fashion_model_service.device}")
        else:
            logger.warning(f"[Worker Startup] Fashion model load warning: {fashion_model_service.load_error}. Will attempt lazy load per job.")

        logger.info("[Worker Startup] Preloading and warming ONNX garment segmentation model...")
        seg_ok = garment_segmentation_service.warmup()
        if seg_ok:
            logger.info("[Worker Startup] Garment segmentation model ready on CPU.")
        else:
            logger.info("[Worker Startup] Garment segmentation model using OpenCV fallback.")
    except Exception as me:
        logger.warning(f"[Worker Startup] Model preload notice: {me}")

    # 4. Choose appropriate Worker Class based on OS
    if os.name == "nt":
        logger.info("[Worker Startup] OS: Windows -> Using rq.SimpleWorker (in-process execution without fork).")
        from rq import SimpleWorker as WorkerClass
    else:
        logger.info("[Worker Startup] OS: Linux/POSIX -> Using standard rq.Worker (process-isolated execution).")
        from rq import Worker as WorkerClass

    queues = [Queue(name, connection=redis_conn) for name in QUEUES]

    # Custom exception handler for structured logging
    def exception_handler(job: Job, exc_type, exc_value, traceback):
        logger.error(
            f"[Worker Job Failed] Job ID: {job.id} | Function: {job.func_name} | "
            f"Args: {job.args} | Error: {exc_type.__name__}: {exc_value}"
        )
        return False  # Let RQ execute default failure handling

    worker = WorkerClass(queues, connection=redis_conn, exception_handlers=[exception_handler])

    def shutdown_handler(signum, frame):
        logger.info(f"[Worker Shutdown] Received signal {signum}. Gracefully shutting down worker...")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown_handler)

    logger.info(f"[Worker Ready] Worker ID: '{worker.name}' listening on queues: {QUEUES}")
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    run_worker()
