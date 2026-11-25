"""ajouter les projets et numéroter les tickets

Crée le projet « Personnel » (clé PERSO), même sur une base vide, puis y rattache
les tickets existants, numérotés 1, 2, 3... du plus ancien au plus récent. Leurs
autres champs et leur identifiant interne ne changent pas.

Le retour en arrière garde les tickets, mais oublie les projets et les numéros.

Revision ID: 4b7e2f9a1c3d
Revises: cad4a44e2c0c
Create Date: 2026-11-26 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4b7e2f9a1c3d"
down_revision: str | Sequence[str] | None = "cad4a44e2c0c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("key", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_table(
        "project_counters",
        sa.Column("key", sa.String(length=10), nullable=False),
        sa.Column("last_number", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.execute("INSERT INTO projects (name, key) VALUES ('Personnel', 'PERSO')")

    # Colonnes d'abord facultatives, le temps de remplir les tickets existants
    op.add_column("tickets", sa.Column("project_id", sa.Integer(), nullable=True))
    op.add_column("tickets", sa.Column("number", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE tickets
        SET project_id = numbered.project_id, number = numbered.number
        FROM (
            SELECT tickets.id,
                   projects.id AS project_id,
                   row_number() OVER (ORDER BY tickets.created_at, tickets.id) AS number
            FROM tickets CROSS JOIN projects
            WHERE projects.key = 'PERSO'
        ) AS numbered
        WHERE tickets.id = numbered.id
        """
    )
    # Le prochain ticket de PERSO prendra le numéro suivant
    op.execute(
        "INSERT INTO project_counters (key, last_number) "
        "SELECT 'PERSO', count(*) FROM tickets"
    )

    op.alter_column("tickets", "project_id", nullable=False)
    op.alter_column("tickets", "number", nullable=False)
    op.create_foreign_key(
        "fk_tickets_project_id_projects", "tickets", "projects", ["project_id"], ["id"]
    )
    op.create_unique_constraint(
        "uq_tickets_project_number", "tickets", ["project_id", "number"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_tickets_project_number", "tickets", type_="unique")
    op.drop_constraint("fk_tickets_project_id_projects", "tickets", type_="foreignkey")
    op.drop_column("tickets", "number")
    op.drop_column("tickets", "project_id")
    op.drop_table("project_counters")
    op.drop_table("projects")
