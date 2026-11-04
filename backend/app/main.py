from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Ticket, TicketStatus
from app.schemas import TicketCreate, TicketRead

app = FastAPI(title="MiniJira")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tickets", status_code=201, response_model=TicketRead)
def create_ticket(
    payload: TicketCreate, db: Annotated[Session, Depends(get_db)]
) -> Ticket:
    # Le statut est fixé côté serveur : un ticket commence toujours en "todo"
    ticket = Ticket(**payload.model_dump(), status=TicketStatus.TODO)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket
