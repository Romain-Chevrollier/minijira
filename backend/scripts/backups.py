"""Sauvegarde et restauration des tickets MiniJira.

Lancé dans un conteneur, depuis la racine du dépôt :
    docker compose run --rm backup             crée backups/minijira-<date>.dump
    docker compose run --rm restore            liste les sauvegardes
    docker compose run --rm restore <fichier>  restaure ce fichier, après confirmation
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", "/backups"))
BACKUP_PREFIX = "minijira-"
BACKUP_SUFFIX = ".dump"
CONFIRMATION_WORD = "oui"
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Avant la restauration, dans la même transaction : on repart d'un schéma vide, pour
# qu'une sauvegarde plus ancienne ne cohabite pas avec des tables plus récentes.
# lock_timeout : abandonne (sans rien modifier) si la base reste occupée.
RESET_SCHEMA_SQL = """\
SET lock_timeout = '10s';
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
"""


class BackupError(Exception):
    """Problème expliqué à l'utilisateur, sans trace Python."""


def libpq_url(database_url: str) -> str:
    """Adresse lisible par pg_dump, sans le préfixe SQLAlchemy `+psycopg`."""
    url = make_url(database_url).set(drivername="postgresql")
    return url.render_as_string(hide_password=False)


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, **kwargs)


def count_tickets(database_url: str) -> int | None:
    """Nombre de tickets de la base, ou None si elle n'a pas encore de table."""
    engine = create_engine(database_url, connect_args={"connect_timeout": 5})
    try:
        with engine.connect() as connection:
            if not inspect(connection).has_table("tickets"):
                return None
            query = text("SELECT count(*) FROM tickets")
            return connection.execute(query).scalar_one()
    finally:
        engine.dispose()


def check_backup_file(path: Path) -> None:
    """Refuse tout fichier qui n'est pas une sauvegarde MiniJira complète."""
    result = run(["pg_restore", "--list", str(path)])
    if result.returncode != 0 or not re.search(
        r"\bTABLE public alembic_version\b", result.stdout
    ):
        raise BackupError(
            f"« {path.name} » n'est pas une sauvegarde MiniJira valide. "
            "Rien n'a été modifié."
        )


def create_backup(
    database_url: str,
    backup_dir: Path = BACKUP_DIR,
    label: str = "",
    now: datetime | None = None,
) -> Path:
    """Crée une sauvegarde horodatée et renvoie son chemin.

    Le fichier est écrit sous un nom provisoire, puis renommé seulement s'il a été
    relu sans erreur : une sauvegarde ratée ne laisse aucun fichier `.dump`.
    """
    stamp = f"{now or datetime.now():%Y-%m-%d-%H%M%S}"
    name = f"{BACKUP_PREFIX}{stamp}{f'-{label}' if label else ''}{BACKUP_SUFFIX}"
    final = backup_dir / name
    partial = backup_dir / f".{name}.en-cours"
    backup_dir.mkdir(parents=True, exist_ok=True)
    if final.exists():
        raise BackupError(f"« {name} » existe déjà : relancez dans une seconde.")

    try:
        result = run(
            [
                "pg_dump",
                "--format=custom",
                f"--file={partial}",
                f"--dbname={libpq_url(database_url)}",
            ]
        )
        if result.returncode != 0:
            raise BackupError(
                f"La sauvegarde a échoué, aucun fichier n'a été créé.\n"
                f"{result.stderr.strip()}"
            )
        try:
            check_backup_file(partial)
        except BackupError as error:
            raise BackupError(
                "La sauvegarde a échoué : le fichier écrit est illisible, "
                "aucun fichier n'a été créé."
            ) from error
        partial.replace(final)
    finally:
        partial.unlink(missing_ok=True)
    return final


def find_backup(argument: str, backup_dir: Path = BACKUP_DIR) -> Path:
    """Fichier choisi par l'utilisateur, forcément dans le dossier des sauvegardes."""
    # Accepte « nom.dump », « backups/nom.dump » et « .\backups\nom.dump » (PowerShell)
    given = Path(argument.replace("\\", "/"))
    if given.parent not in (Path("."), Path("backups")):
        raise BackupError(
            f"« {argument} » : choisissez un fichier du dossier backups/ "
            "(par exemple backups/minijira-2026-11-25-143000.dump)."
        )
    path = backup_dir / given.name
    if not path.is_file():
        raise BackupError(f"« {given.name} » n'existe pas dans le dossier backups/.")
    return path


def restore_backup(
    database_url: str,
    path: Path,
    confirm: Callable[[str], bool],
    backup_dir: Path = BACKUP_DIR,
) -> Path:
    """Remplace le contenu de la base par la sauvegarde `path`.

    Dans l'ordre, et en s'arrêtant à la première erreur : vérification du fichier,
    confirmation, sauvegarde de l'état actuel, restauration en une seule transaction
    (tout ou rien), puis migrations manquantes. Renvoie la sauvegarde de l'état actuel.
    """
    check_backup_file(path)

    current = count_tickets(database_url)
    question = (
        f"Restaurer « {path.name} » ? Les {current or 0} ticket(s) actuels seront "
        f"remplacés (ils sont d'abord sauvegardés). Tapez « {CONFIRMATION_WORD} » "
        "pour confirmer : "
    )
    if not confirm(question):
        raise BackupError("Restauration annulée : rien n'a été modifié.")

    safety = create_backup(database_url, backup_dir, label="avant-restauration")

    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "restore.sql"
        reset = Path(tmp) / "reset.sql"
        reset.write_text(RESET_SCHEMA_SQL)
        result = run(
            [
                "pg_restore",
                "--no-owner",
                "--no-privileges",
                f"--file={script}",
                str(path),
            ]
        )
        if result.returncode != 0:
            raise BackupError(
                f"Lecture de « {path.name} » impossible, rien n'a été modifié.\n"
                f"{result.stderr.strip()}"
            )
        result = run(
            [
                "psql",
                "--no-psqlrc",
                "--quiet",
                "--set=ON_ERROR_STOP=1",
                "--single-transaction",
                f"--file={reset}",
                f"--file={script}",
                f"--dbname={libpq_url(database_url)}",
            ]
        )
        if result.returncode != 0:
            raise BackupError(
                "La restauration a échoué et a été annulée : rien n'a été modifié.\n"
                f"{result.stderr.strip()}"
            )

    # Sauvegarde plus ancienne qu'une migration : on remet la base à jour
    result = run(
        ["alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": database_url},
    )
    if result.returncode != 0:
        raise BackupError(
            "Sauvegarde restaurée, mais la mise à jour de la base (migrations) a "
            f"échoué. L'état d'avant est dans « {safety.name} ».\n"
            f"{result.stderr.strip()}"
        )
    return safety


def list_backups(backup_dir: Path = BACKUP_DIR) -> list[Path]:
    return sorted(backup_dir.glob(f"{BACKUP_PREFIX}*{BACKUP_SUFFIX}"), reverse=True)


def ask(question: str) -> bool:
    try:
        # PowerShell 5.1 ajoute un BOM invisible devant un texte envoyé par « | »
        answer = input(question).replace("\ufeff", "").strip().lower()
        return answer == CONFIRMATION_WORD
    except EOFError:
        return False


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="backups", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("save", help="sauvegarder les tickets")
    restore = commands.add_parser("restore", help="restaurer une sauvegarde")
    restore.add_argument("file", nargs="?", help="fichier du dossier backups/")
    args = parser.parse_args(argv)
    database_url = os.environ["DATABASE_URL"]

    try:
        if args.command == "save":
            path = create_backup(database_url, BACKUP_DIR)
            print(
                f"Sauvegarde créée : backups/{path.name} "
                f"({count_tickets(database_url) or 0} ticket(s))."
            )
        elif args.file is None:
            backups = list_backups(BACKUP_DIR)
            if not backups:
                print(
                    "Aucune sauvegarde dans backups/. "
                    "Créez-en une avec : docker compose run --rm backup"
                )
            else:
                print("Sauvegardes disponibles (la plus récente en premier) :")
                for path in backups:
                    print(f"  backups/{path.name}")
                print("Pour restaurer : docker compose run --rm restore <fichier>")
        else:
            path = find_backup(args.file, BACKUP_DIR)
            safety = restore_backup(database_url, path, ask, BACKUP_DIR)
            print(
                f"Restauration terminée : {count_tickets(database_url) or 0} "
                f"ticket(s). L'état d'avant est dans backups/{safety.name}."
            )
    except BackupError as error:
        print(f"Erreur : {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
