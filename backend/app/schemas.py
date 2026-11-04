from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.models import TicketPriority, TicketStatus


class TicketCreate(BaseModel):
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    description: str | None = None
    priority: TicketPriority = TicketPriority.MEDIUM
    assignee: Annotated[str | None, Field(max_length=100)] = None

    @field_validator("description", "assignee", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        """Retire les espaces autour ; une chaîne vide devient None."""
        if isinstance(value, str):
            return value.strip() or None
        return value


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    priority: TicketPriority
    assignee: str | None
    status: TicketStatus
    created_at: datetime
