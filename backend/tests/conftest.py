import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, get_db
from app.main import app
from app.models import Project
from tests.databases import run_alembic
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
    # Crée les tables depuis les modèles (la migration est testée à part, dans
    # test_migrations.py), puis le projet par défaut que crée la migration
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            insert(Project)
            .values(name="Personnel", key="PERSO")
            .on_conflict_do_nothing(index_elements=["key"])
        )
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


@pytest.fixture
def make_database(db_engine):
    """Crée des bases jetables `*_test`, supprimées à la fin du test.

    `make_database()` renvoie l'adresse d'une base à jour des migrations ;
    `make_database(revision="cad4a44e2c0c")` s'arrête à cette migration, et
    `make_database(revision=None)` laisse la base vide.
    """
    admin = db_engine.execution_options(isolation_level="AUTOCOMMIT")
    created = []

    def make(revision="head"):
        name = f"scratch_{uuid.uuid4().hex[:8]}_test"
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
        created.append(name)
        url = make_url(settings.test_database_url).set(database=name)
        url_text = url.render_as_string(hide_password=False)
        if revision is not None:
            run_alembic(url_text, "upgrade", revision)
        return url_text

    yield make
    with admin.connect() as connection:
        for name in created:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
