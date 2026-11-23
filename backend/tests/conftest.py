import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401 (enregistre les modèles dans Base.metadata)
from app.config import settings
from app.db import Base, get_db
from app.main import app
from tests.db_guard import check_connected_database, check_test_database_url


@pytest.fixture(scope="session")
def db_engine():
    if settings.test_database_url is None:
        pytest.fail("TEST_DATABASE_URL n'est pas définie (voir backend/.env.example)")

    # Sécurité, premier filtre : le nom de base écrit dans l'adresse
    try:
        check_test_database_url(settings.test_database_url)
    except ValueError as error:
        pytest.exit(str(error), returncode=1)

    # Échoue vite si PostgreSQL n'est pas démarré, au lieu de rester bloqué
    engine = create_engine(
        settings.test_database_url, connect_args={"connect_timeout": 3}
    )
    # Sécurité : la base réellement ouverte, avant toute création ou suppression.
    # pytest.exit arrête tout sans exécuter le nettoyage (drop_all) plus bas.
    try:
        check_connected_database(engine)
    except ValueError as error:
        engine.dispose()
        pytest.exit(str(error), returncode=1)
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
