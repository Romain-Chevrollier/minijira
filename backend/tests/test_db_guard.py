import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import make_url

from app.config import settings
from app.db import Base
from app.models import Ticket, TicketStatus
from tests.db_guard import check_connected_database, check_test_database_url

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_accepts_database_ending_with_test():
    check_test_database_url("postgresql+psycopg://u:p@db:5432/minijira_test")


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://u:p@db:5432/minijira",
        "postgresql+psycopg://u:p@db:5432/minijira_test_old",
        "postgresql+psycopg://u:p@db:5432/test",
        "postgresql+psycopg://u:p@db:5432",
    ],
)
def test_refuses_database_not_ending_with_test(url):
    with pytest.raises(ValueError, match="_test"):
        check_test_database_url(url)


def test_refuses_invalid_url():
    with pytest.raises(ValueError, match="pas une adresse valide"):
        check_test_database_url("pas une adresse")


def test_accepts_connected_test_database(db_engine):
    check_connected_database(db_engine)


@pytest.fixture
def decoy_url(db_engine):
    """Base jetable qui joue le rôle de `minijira`, avec un « vrai » ticket.

    Renvoie une adresse qui a l'air d'une base de test (`.../minijira_test`)
    mais qui ouvre cette base jetable par `?dbname=`. La base est supprimée
    à la fin du test ; `minijira` n'est jamais utilisée.
    """
    name = f"guard_decoy_{uuid.uuid4().hex[:8]}"
    admin = db_engine.execution_options(isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    url = make_url(settings.test_database_url).update_query_dict({"dbname": name})
    url_text = url.render_as_string(hide_password=False)
    decoy = create_engine(url_text)
    try:
        Base.metadata.create_all(decoy)
        with decoy.begin() as connection:
            connection.execute(
                Ticket.__table__.insert().values(
                    title="Vrai ticket", priority="low", status=TicketStatus.TODO
                )
            )
        yield url_text, decoy, name
    finally:
        decoy.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))


def count_tickets(engine):
    with engine.connect() as connection:
        return connection.execute(select(func.count()).select_from(Ticket)).scalar_one()


def test_url_check_alone_is_fooled_by_dbname_parameter(decoy_url):
    url, _, _ = decoy_url
    # L'adresse se termine par _test : le premier filtre la laisse passer
    check_test_database_url(url)


def test_refuses_database_opened_by_dbname_parameter(decoy_url):
    _, decoy, name = decoy_url

    with pytest.raises(ValueError, match=f"« {name} »"):
        check_connected_database(decoy)


def test_test_session_stops_without_touching_the_database(decoy_url):
    url, decoy, name = decoy_url

    # Une vraie session pytest, lancée avec l'adresse piégée
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/test_database.py",
            "-p",
            "no:cacheprovider",
        ],
        cwd=BACKEND_DIR,
        env={**os.environ, "TEST_DATABASE_URL": url},
        capture_output=True,
        text=True,
        timeout=60,
    )

    output = result.stdout + result.stderr
    assert result.returncode == 1, output
    assert f"connectés à la base « {name} »" in output
    # La table et son ticket sont intacts, y compris après la fin de la session
    assert count_tickets(decoy) == 1
