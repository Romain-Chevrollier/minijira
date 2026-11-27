"""Sauvegarde et restauration, sur des bases jetables créées puis supprimées ici.

Ces tests ont besoin de pg_dump, pg_restore et psql (version 17) : ils tournent dans
Docker (`docker compose run --rm backend-tests`), en local comme en CI.
"""

import io
import subprocess
from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Project, Ticket, TicketStatus
from app.numbering import next_ticket_number
from scripts import backups
from scripts.backups import (
    BackupError,
    count_tickets,
    create_backup,
    find_backup,
    restore_backup,
)
from tests.databases import head_revision, run_alembic

pytestmark = pytest.mark.pg_tools

ACCENTS = "Réunion d'équipe : préparer l'ordre du jour — çà et là ✓"


def yes(_question):
    return True


def add_ticket(url, title, description=None):
    """Ajoute un ticket au projet par défaut d'une base à jour des migrations."""
    engine = create_engine(url)
    with Session(engine) as session:
        project = session.scalars(select(Project).where(Project.key == "PERSO")).one()
        session.add(
            Ticket(
                title=title,
                description=description,
                priority="high",
                status=TicketStatus.IN_PROGRESS,
                project=project,
                number=next_ticket_number(session, project.key),
            )
        )
        session.commit()
    engine.dispose()


def tickets(url):
    engine = create_engine(url)
    with engine.connect() as connection:
        rows = connection.execute(select(Ticket.__table__).order_by(Ticket.id))
        result = [dict(row._mapping) for row in rows]
    engine.dispose()
    return result


def revision(url):
    engine = create_engine(url)
    with engine.connect() as connection:
        value = connection.execute(text("SELECT version_num FROM alembic_version"))
        result = value.scalar_one_or_none()
    engine.dispose()
    return result


def test_backup_is_timestamped(make_database, tmp_path):
    source = make_database()

    path = create_backup(source, tmp_path, now=datetime(2026, 11, 25, 14, 30, 5))

    assert path.name == "minijira-2026-11-25-143005.dump"
    assert [p.name for p in tmp_path.iterdir()] == [path.name]


def test_round_trip_keeps_tickets_with_accents(make_database, tmp_path):
    source = make_database()
    add_ticket(source, ACCENTS, "Détails : « guillemets », œuvre, naïve, 日本")
    add_ticket(source, "Deuxième ticket")
    target = make_database()
    add_ticket(target, "Ticket remplacé")

    backup = create_backup(source, tmp_path)
    restore_backup(target, backup, yes, tmp_path)

    assert tickets(target) == tickets(source)
    assert tickets(target)[0]["title"] == ACCENTS
    # Les numéros continuent après ceux de la sauvegarde
    add_ticket(target, "Créé après la restauration")
    assert [t["id"] for t in tickets(target)] == [1, 2, 3]


def test_restore_saves_current_state_first(make_database, tmp_path):
    source = make_database()
    add_ticket(source, "Ancien")
    target = make_database()
    add_ticket(target, "Actuel")
    backup = create_backup(source, tmp_path, now=datetime(2026, 1, 1))

    safety = restore_backup(target, backup, yes, tmp_path)

    assert safety.name.endswith("-avant-restauration.dump")
    # La sauvegarde de sécurité permet de revenir en arrière. Ce retour crée à son
    # tour une sauvegarde de sécurité, nommée à la seconde près : dans un autre
    # dossier, son nom ne peut pas être déjà pris si tout tient dans la même seconde
    restore_backup(target, safety, yes, tmp_path / "retour")
    assert [t["title"] for t in tickets(target)] == ["Actuel"]


def test_failed_backup_leaves_no_file(make_database, tmp_path):
    missing = make_url(settings.test_database_url).set(database="absente_test")

    with pytest.raises(BackupError, match="aucun fichier n'a été créé"):
        create_backup(missing.render_as_string(hide_password=False), tmp_path)

    assert list(tmp_path.iterdir()) == []


@pytest.fixture
def broken_pg_dump(monkeypatch):
    """pg_dump qui n'écrit que la moitié du fichier, puis échoue ou dit avoir réussi.

    Simule une coupure en cours de sauvegarde (disque plein, base arrêtée...).
    """
    real_run = backups.run

    def install(exit_code):
        def run(command, **kwargs):
            result = real_run(command, **kwargs)
            if command[0] != "pg_dump":
                return result
            output = Path(command[2].removeprefix("--file="))
            output.write_bytes(output.read_bytes()[: output.stat().st_size // 2])
            return subprocess.CompletedProcess(command, exit_code, "", "coupure")

        monkeypatch.setattr(backups, "run", run)

    return install


def test_interrupted_backup_leaves_no_file(make_database, tmp_path, broken_pg_dump):
    source = make_database()
    broken_pg_dump(exit_code=1)

    with pytest.raises(BackupError, match="aucun fichier n'a été créé"):
        create_backup(source, tmp_path)

    assert list(tmp_path.iterdir()) == []


def test_unreadable_backup_leaves_no_file(make_database, tmp_path, broken_pg_dump):
    source = make_database()
    # pg_dump dit avoir réussi, mais le fichier est incomplet
    broken_pg_dump(exit_code=0)

    with pytest.raises(BackupError, match="illisible, aucun fichier n'a été créé"):
        create_backup(source, tmp_path)

    assert list(tmp_path.iterdir()) == []


@pytest.fixture(params=["texte", "vide", "tronque", "autre_base"])
def invalid_backup(request, make_database, tmp_path):
    path = tmp_path / "minijira-invalide.dump"
    if request.param == "texte":
        path.write_text("ceci n'est pas une sauvegarde")
    elif request.param == "vide":
        path.write_bytes(b"")
    elif request.param == "tronque":
        complete = create_backup(make_database(), tmp_path).read_bytes()
        path.write_bytes(complete[: len(complete) // 2])
    else:
        # Vraie sauvegarde PostgreSQL, mais pas d'une base MiniJira
        complete = create_backup_any(make_database(revision=None), tmp_path)
        complete.rename(path)
    for other in tmp_path.iterdir():
        if other != path:
            other.unlink()
    return path


def create_backup_any(url, directory):
    path = directory / "autre.dump"
    dsn = backups.libpq_url(url)
    subprocess.run(["pg_dump", "-Fc", f"--file={path}", f"--dbname={dsn}"], check=True)
    return path


def test_refuses_invalid_file_without_touching_data(
    make_database, invalid_backup, tmp_path
):
    target = make_database()
    add_ticket(target, "À garder")
    asked = []

    with pytest.raises(BackupError, match="pas une sauvegarde MiniJira valide"):
        restore_backup(target, invalid_backup, asked.append, tmp_path)

    assert asked == []
    assert [t["title"] for t in tickets(target)] == ["À garder"]
    assert list(tmp_path.iterdir()) == [invalid_backup]


def test_cancelled_restore_changes_nothing(make_database, tmp_path):
    source = make_database()
    target = make_database()
    add_ticket(target, "À garder")
    backup = create_backup(source, tmp_path)
    questions = []

    def refuse(question):
        questions.append(question)
        return False

    with pytest.raises(BackupError, match="annulée"):
        restore_backup(target, backup, refuse, tmp_path)

    assert "Les 1 ticket(s) actuels seront remplacés" in questions[0]
    assert [t["title"] for t in tickets(target)] == ["À garder"]
    assert list(tmp_path.iterdir()) == [backup]


def test_failed_restore_is_rolled_back(make_database, tmp_path, monkeypatch):
    source = make_database()
    target = make_database()
    add_ticket(target, "À garder")
    backup = create_backup(source, tmp_path)
    # Erreur juste après la suppression des tables, dans la même transaction
    monkeypatch.setattr(
        backups, "RESET_SCHEMA_SQL", backups.RESET_SCHEMA_SQL + "SELECT 1/0;\n"
    )

    with pytest.raises(BackupError, match="annulée : rien n'a été modifié"):
        restore_backup(target, backup, yes, tmp_path)

    assert [t["title"] for t in tickets(target)] == ["À garder"]


def test_restores_backup_older_than_migrations(make_database, tmp_path):
    # Base sauvegardée avant la première migration : aucune table de tickets
    old = make_database(revision=None)
    run_alembic(old, "stamp", "base")
    backup = create_backup(old, tmp_path)
    target = make_database()
    add_ticket(target, "Remplacé")

    restore_backup(target, backup, yes, tmp_path)

    assert revision(target) == head_revision()
    assert count_tickets(target) == 0


def test_backup_from_before_projects_is_migrated(make_database, tmp_path):
    # Sauvegarde faite avec la version d'avant les projets (migration cad4a44e2c0c)
    old = make_database(revision="cad4a44e2c0c")
    engine = create_engine(old)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO tickets (title, priority, status) VALUES "
                "(:title, 'high', 'done'), ('Deuxième', 'low', 'todo')"
            ),
            {"title": ACCENTS},
        )
    engine.dispose()
    backup = create_backup(old, tmp_path)
    target = make_database()
    add_ticket(target, "Remplacé")

    restore_backup(target, backup, yes, tmp_path)

    assert revision(target) == head_revision()
    restored = tickets(target)
    assert [(t["id"], t["number"], t["title"]) for t in restored] == [
        (1, 1, ACCENTS),
        (2, 2, "Deuxième"),
    ]
    # Le ticket suivant continue la numérotation du projet Personnel
    add_ticket(target, "Après la restauration")
    assert tickets(target)[-1]["number"] == 3


@pytest.mark.parametrize(
    "argument",
    ["minijira-1.dump", "backups/minijira-1.dump", ".\\backups\\minijira-1.dump"],
)
def test_finds_backup_in_backup_folder(tmp_path, argument):
    (tmp_path / "minijira-1.dump").write_bytes(b"x")

    assert find_backup(argument, tmp_path) == tmp_path / "minijira-1.dump"


@pytest.mark.parametrize(
    "argument", ["../minijira-1.dump", "/etc/passwd", "C:/minijira-1.dump"]
)
def test_refuses_file_outside_backup_folder(tmp_path, argument):
    with pytest.raises(BackupError, match="dossier backups/"):
        find_backup(argument, tmp_path)


def test_refuses_missing_file(tmp_path):
    with pytest.raises(BackupError, match="n'existe pas"):
        find_backup("minijira-absente.dump", tmp_path)


def test_command_line_round_trip(make_database, tmp_path, monkeypatch, capsys):
    url = make_database()
    add_ticket(url, ACCENTS)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setattr(backups, "BACKUP_DIR", tmp_path)

    assert backups.main(["save"]) == 0
    assert "Sauvegarde créée : backups/minijira-" in capsys.readouterr().out
    [backup] = tmp_path.iterdir()

    assert backups.main(["restore"]) == 0
    assert f"backups/{backup.name}" in capsys.readouterr().out

    add_ticket(url, "Ajouté après la sauvegarde")
    monkeypatch.setattr("sys.stdin", io.StringIO("non\n"))
    assert backups.main(["restore", f"backups/{backup.name}"]) == 1
    assert "annulée" in capsys.readouterr().err
    assert count_tickets(url) == 2

    monkeypatch.setattr("sys.stdin", io.StringIO("oui\n"))
    assert backups.main(["restore", f"backups/{backup.name}"]) == 0
    assert "Restauration terminée : 1 ticket(s)" in capsys.readouterr().out
    assert [t["title"] for t in tickets(url)] == [ACCENTS]


@pytest.mark.parametrize(
    ("typed", "accepted"),
    [
        ("oui\n", True),
        (" OUI \n", True),
        # « 'oui' | docker compose run ... » dans PowerShell 5.1 : BOM et fin Windows
        ("\ufeffoui\r\n", True),
        ("o\n", False),
        ("non\n", False),
        ("", False),
    ],
)
def test_confirmation_requires_oui(monkeypatch, typed, accepted):
    monkeypatch.setattr("sys.stdin", io.StringIO(typed))

    assert backups.ask("Confirmer ? ") is accepted
