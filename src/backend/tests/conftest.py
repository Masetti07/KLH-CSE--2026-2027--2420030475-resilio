import os
from pathlib import Path

import pytest


TEST_RUNTIME = Path(__file__).parent / ".runtime"
TEST_RUNTIME.mkdir(parents=True, exist_ok=True)
os.environ["RESILIOSPACE_RUNTIME_DIR"] = str(TEST_RUNTIME)

from app.database.base import Base  # noqa: E402
from app.database.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
