from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
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


@app.get("/tickets", response_model=list[TicketRead])
def list_tickets(db: Annotated[Session, Depends(get_db)]) -> list[Ticket]:
    # Du plus récent au plus ancien : l'id est croissant, donc pas d'ex-aequo
    return list(db.scalars(select(Ticket).order_by(Ticket.id.desc())))


@app.get("/tickets/{ticket_id}", response_model=TicketRead)
def get_ticket(ticket_id: int, db: Annotated[Session, Depends(get_db)]) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket introuvable")
    return ticket
