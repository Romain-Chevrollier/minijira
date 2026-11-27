from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Project, Ticket, TicketStatus
from app.numbering import next_ticket_number
from app.schemas import (
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
    TicketCreate,
    TicketRead,
    TicketUpdate,
)

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


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return project


def count_tickets(db: Session, project_id: int) -> int:
    query = select(func.count()).select_from(Ticket)
    return db.scalar(query.where(Ticket.project_id == project_id))


def to_project_read(project: Project, ticket_count: int) -> ProjectRead:
    return ProjectRead(
        id=project.id,
        key=project.key,
        name=project.name,
        created_at=project.created_at,
        ticket_count=ticket_count,
    )


@app.get("/projects", response_model=list[ProjectRead])
def list_projects(db: Annotated[Session, Depends(get_db)]) -> list[ProjectRead]:
    # Une seule requête : chaque projet avec son nombre de tickets (0 si vide)
    rows = db.execute(
        select(Project, func.count(Ticket.id))
        .outerjoin(Ticket, Ticket.project_id == Project.id)
        .group_by(Project.id)
        .order_by(Project.created_at, Project.id)
    )
    return [to_project_read(project, count) for project, count in rows]


@app.post("/projects", status_code=201, response_model=ProjectRead)
def create_project(
    payload: ProjectCreate, db: Annotated[Session, Depends(get_db)]
) -> ProjectRead:
    project = Project(**payload.model_dump())
    db.add(project)
    try:
        db.commit()
    except IntegrityError:
        # La base garantit l'unicité de la clé, même pour deux créations simultanées
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"La clé {payload.key} est déjà utilisée par un autre projet",
        ) from None
    db.refresh(project)
    return to_project_read(project, ticket_count=0)


@app.patch("/projects/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int, payload: ProjectUpdate, db: Annotated[Session, Depends(get_db)]
) -> ProjectRead:
    project = get_project_or_404(db, project_id)
    project.name = payload.name
    db.commit()
    db.refresh(project)
    return to_project_read(project, count_tickets(db, project.id))


@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Annotated[Session, Depends(get_db)]) -> None:
    project = get_project_or_404(db, project_id)
    ticket_count = count_tickets(db, project.id)
    if ticket_count > 0:
        tickets = "ticket" if ticket_count == 1 else "tickets"
        raise HTTPException(
            status_code=409,
            detail=f"Le projet {project.key} contient {ticket_count} {tickets} : "
            "déplacez-les ou supprimez-les d'abord",
        )
    if db.scalar(select(func.count()).select_from(Project)) == 1:
        raise HTTPException(
            status_code=409, detail="Impossible de supprimer le dernier projet"
        )
    # Le compteur de numéros est gardé : une clé recréée reprend sa numérotation
    db.delete(project)
    db.commit()


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
