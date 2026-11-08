from datetime import datetime
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models import TicketPriority, TicketStatus

# Règles de validation partagées entre la création et la modification
TicketTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
TicketAssignee = Annotated[str | None, Field(max_length=100)]


def blank_to_none(value: object) -> object:
    """Retire les espaces autour ; une chaîne vide devient None."""
    if isinstance(value, str):
        return value.strip() or None
    return value


class TicketCreate(BaseModel):
    title: TicketTitle
    description: str | None = None
    priority: TicketPriority = TicketPriority.MEDIUM
    assignee: TicketAssignee = None

    @field_validator("description", "assignee", mode="before")
    @classmethod
    def clean_optional_text(cls, value: object) -> object:
        return blank_to_none(value)


class TicketUpdate(BaseModel):
    # Tous les champs sont facultatifs : seuls ceux envoyés seront modifiés.
    # Les champs inconnus (id, created_at...) sont ignorés par Pydantic.
    title: TicketTitle | None = None
    description: str | None = None
    priority: TicketPriority | None = None
    assignee: TicketAssignee = None
    status: TicketStatus | None = None

    @field_validator("title", "priority", "status", mode="before")
    @classmethod
    def reject_null(cls, value: object) -> object:
        # Pydantic ne valide pas les valeurs par défaut : ce validateur ne
        # tourne que si le client envoie explicitement null.
        if value is None:
            raise ValueError("ce champ ne peut pas être null")
        return value

    @field_validator("description", "assignee", mode="before")
    @classmethod
    def clean_optional_text(cls, value: object) -> object:
        return blank_to_none(value)

    @model_validator(mode="after")
    def check_not_empty(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("au moins un champ modifiable doit être envoyé")
        return self


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    priority: TicketPriority
    assignee: str | None
    status: TicketStatus
    created_at: datetime
