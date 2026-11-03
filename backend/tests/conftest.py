import pytest
from sqlalchemy import create_engine

from app.config import settings


@pytest.fixture(scope="session")
def db_engine():
    if settings.test_database_url is None:
        pytest.fail("TEST_DATABASE_URL n'est pas définie (voir backend/.env.example)")

    # Échoue vite si PostgreSQL n'est pas démarré, au lieu de rester bloqué
    engine = create_engine(
        settings.test_database_url, connect_args={"connect_timeout": 3}
    )
    yield engine
    engine.dispose()
