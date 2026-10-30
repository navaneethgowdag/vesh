import sys
import os
import pytest
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import get_settings

settings = get_settings()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
