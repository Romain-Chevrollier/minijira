from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Project, Ticket, TicketStatus
from app.numbering import next_ticket_number
from app.schemas import TicketCreate, TicketRead, TicketUpdate

app = FastAPI(title="MiniJira")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def find_project(db: Session, project_id: int | None) -> Project:
    """Projet demandé, ou le plus ancien si aucun n'est précisé."""
    if project_id is None:
        query = select(Project).order_by(Project.created_at, Project.id).limit(1)
        project = db.scalars(query).first()
        detail = "Aucun projet : créez-en un avant d'ajouter un ticket"
    else:
        project = db.get(Project, project_id)
        detail = f"Le projet {project_id} n'existe pas"
    if project is None:
        raise HTTPException(status_code=422, detail=detail)
    return project


@app.post("/tickets", status_code=201, response_model=TicketRead)
def create_ticket(
    payload: TicketCreate, db: Annotated[Session, Depends(get_db)]
) -> Ticket:
    project = find_project(db, payload.project_id)
    ticket = Ticket(
        **payload.model_dump(exclude={"project_id"}),
        project=project,
        number=next_ticket_number(db, project.key),
        # Le statut est fixé côté serveur : un ticket commence toujours en "todo"
        status=TicketStatus.TODO,
    )
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


@app.patch("/tickets/{ticket_id}", response_model=TicketRead)
def update_ticket(
    ticket_id: int, payload: TicketUpdate, db: Annotated[Session, Depends(get_db)]
) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket introuvable")
    # exclude_unset : seuls les champs envoyés (null compris) sont appliqués
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, field, value)
    db.commit()
    db.refresh(ticket)
    return ticket


@app.delete("/tickets/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, db: Annotated[Session, Depends(get_db)]) -> None:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket introuvable")
    # Suppression définitive : pas de corbeille ni de suppression logique.
    # Son numéro n'est jamais réattribué (voir app/numbering.py).
    db.delete(ticket)
    db.commit()
