from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TicketStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TicketPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


def _enum_values(enum_class: type[StrEnum]) -> list[str]:
    # Stocke les valeurs ("todo") plutôt que les noms ("TODO") dans PostgreSQL
    return [member.value for member in enum_class]


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    # Clé courte des tickets : PERSO donne PERSO-1, PERSO-2...
    key: Mapped[str] = mapped_column(String(10), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ProjectCounter(Base):
    """Dernier numéro de ticket attribué pour chaque clé de projet.

    À part de la table des projets, et lié à la clé plutôt qu'au projet : un numéro
    n'est jamais réattribué, même si le projet est supprimé puis recréé.
    """

    __tablename__ = "project_counters"

    key: Mapped[str] = mapped_column(String(10), primary_key=True)
    last_number: Mapped[int] = mapped_column(server_default="0")


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        # Un numéro par projet : PERSO-12 n'existe qu'une fois
        UniqueConstraint("project_id", "number", name="uq_tickets_project_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority", values_callable=_enum_values)
    )
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status", values_callable=_enum_values)
    )
    assignee: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", name="fk_tickets_project_id_projects")
    )
    number: Mapped[int]

    # Chargé avec le ticket (jointure) : la liste ne fait qu'une requête
    project: Mapped[Project] = relationship(lazy="joined")

    @property
    def key(self) -> str:
        """Clé lisible du ticket, par exemple PERSO-12."""
        return f"{self.project.key}-{self.number}"
