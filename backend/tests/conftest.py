import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.main import app
from app.core.config import get_settings

settings = get_settings()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client

