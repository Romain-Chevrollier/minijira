import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401 (enregistre les modèles dans Base.metadata)
from app.config import settings
from app.db import Base, get_db
from app.main import app


@pytest.fixture(scope="session")
def db_engine():
    if settings.test_database_url is None:
        pytest.fail("TEST_DATABASE_URL n'est pas définie (voir backend/.env.example)")

    # Échoue vite si PostgreSQL n'est pas démarré, au lieu de rester bloqué
    engine = create_engine(
        settings.test_database_url, connect_args={"connect_timeout": 3}
    )
    # Crée les tables depuis les modèles (la migration est testée en CI)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    """Session dans une transaction annulée à la fin du test.

    Les commit() de l'app deviennent des savepoints : rien n'est écrit
    pour de bon, chaque test part d'une base vide.
    """
    with db_engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        yield session
        session.close()
        transaction.rollback()


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()
