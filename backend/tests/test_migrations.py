"""Migrations appliquées sur de vraies bases jetables, vides ou déjà remplies."""

import os
import subprocess

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.numbering import next_ticket_number
from tests.databases import BACKEND_DIR, run_alembic

BEFORE_PROJECTS = "cad4a44e2c0c"
OLD_COLUMNS = ["id", "title", "description", "priority", "status", "assignee"]

# Tickets créés avant les projets, volontairement pas dans l'ordre chronologique :
# l'id 1 est le plus récent, les id 2 et 3 ont la même date
OLD_TICKETS = [
    {
        "id": 1,
        "title": "Le plus récent",
        "description": "Détails, accents : été",
        "priority": "high",
        "status": "done",
        "assignee": "Alice",
        "created_at": "2026-11-10 09:00:00+00",
    },
    {
        "id": 2,
        "title": "Le plus ancien",
        "description": None,
        "priority": "low",
        "status": "todo",
        "assignee": None,
        "created_at": "2026-11-01 09:00:00+00",
    },
    {
        "id": 3,
        "title": "Même date, id plus grand",
        "description": None,
        "priority": "medium",
        "status": "in_progress",
        "assignee": None,
        "created_at": "2026-11-01 09:00:00+00",
    },
]


def query(url, sql):
    engine = create_engine(url)
    with engine.connect() as connection:
        rows = [tuple(row) for row in connection.execute(text(sql))]
    engine.dispose()
    return rows


def fill_with_old_tickets(url):
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO tickets "
                "(id, title, description, priority, status, assignee, created_at) "
                "VALUES (:id, :title, :description, :priority, :status, :assignee, "
                ":created_at)"
            ),
            OLD_TICKETS,
        )
        connection.execute(text("SELECT setval('tickets_id_seq', 3)"))
    engine.dispose()


def old_fields(url):
    """Tous les champs d'avant les projets, date de création comprise."""
    return query(url, f"SELECT {', '.join(OLD_COLUMNS)}, created_at FROM tickets")


def test_migration_creates_personnel_on_empty_database(make_database):
    url = make_database()

    assert query(url, "SELECT name, key FROM projects") == [("Personnel", "PERSO")]
    assert query(url, "SELECT key, last_number FROM project_counters") == [("PERSO", 0)]


def test_migration_numbers_existing_tickets_from_oldest(make_database):
    url = make_database(revision=BEFORE_PROJECTS)
    fill_with_old_tickets(url)
    before = old_fields(url)

    run_alembic(url, "upgrade", "head")

    # Rien d'autre ne change : identifiants, titres, dates...
    assert sorted(old_fields(url)) == sorted(before)
    assert query(
        url,
        "SELECT tickets.id, projects.key, tickets.number FROM tickets "
        "JOIN projects ON projects.id = tickets.project_id ORDER BY tickets.id",
    ) == [(1, "PERSO", 3), (2, "PERSO", 1), (3, "PERSO", 2)]
    # Le prochain ticket prend le numéro suivant
    engine = create_engine(url)
    with Session(engine) as session:
        assert next_ticket_number(session, "PERSO") == 4
    engine.dispose()


def test_migration_can_be_undone_and_redone(make_database):
    url = make_database(revision=BEFORE_PROJECTS)
    fill_with_old_tickets(url)
    before = old_fields(url)
    run_alembic(url, "upgrade", "head")

    run_alembic(url, "downgrade", BEFORE_PROJECTS)

    assert sorted(old_fields(url)) == sorted(before)
    engine = create_engine(url)
    tables = inspect(engine).get_table_names()
    columns = [column["name"] for column in inspect(engine).get_columns("tickets")]
    engine.dispose()
    assert "projects" not in tables
    assert "project_counters" not in tables
    assert columns == [*OLD_COLUMNS, "created_at"]

    run_alembic(url, "upgrade", "head")
    assert query(url, "SELECT number FROM tickets ORDER BY id") == [(3,), (1,), (2,)]


def test_models_match_migrations(make_database):
    url = make_database()

    # `alembic check` compare les modèles SQLAlchemy à la base migrée
    result = subprocess.run(
        ["alembic", "check"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": url},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
