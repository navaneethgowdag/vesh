import os
import sys
import signal
import logging
from rq import Queue
from app.core.config import settings
from app.core.redis import init_redis, get_redis_client

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
    """
    logger.info("Starting StyleSphere background worker process...")

    if not settings.REDIS_ENABLED or not settings.redis_connection_url:
        logger.error(
            "REDIS_ENABLED is false or REDIS_URL is not set. "
            "Worker requires an active Redis / Upstash connection. Exiting."
        )
        sys.exit(1)

    redis_conn = init_redis()
    if not redis_conn:
        logger.error("Could not establish connection to Redis broker. Exiting worker.")
        sys.exit(1)

    # Determine worker class based on OS
    if os.name == "nt":
        logger.info("Running on Windows: Using rq.SimpleWorker (in-process execution without fork).")
        from rq import SimpleWorker as WorkerClass
    else:
        logger.info("Running on Linux/POSIX: Using standard rq.Worker.")
        from rq import Worker as WorkerClass

    queues = [Queue(name, connection=redis_conn) for name in QUEUES]
    worker = WorkerClass(queues, connection=redis_conn)

    def shutdown_handler(signum, frame):
        logger.info(f"Received signal {signum}. Gracefully shutting down worker...")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown_handler)

    logger.info(f"Worker listening for jobs on queues: {QUEUES}")
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    run_worker()

