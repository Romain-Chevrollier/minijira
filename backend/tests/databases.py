"""Outils pour les tests qui utilisent de vraies bases jetables (migrations...)."""

import os
import subprocess
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_DIR = Path(__file__).resolve().parent.parent


def run_alembic(url: str, *args: str) -> None:
    """Lance une commande Alembic (upgrade, downgrade...) sur la base `url`."""
    result = subprocess.run(
        ["alembic", *args],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": url},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def head_revision() -> str:
    """Dernière migration du dépôt."""
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return ScriptDirectory.from_config(config).get_current_head()
