"""Projets des tickets : clé PERSO-12, choix du projet, numéros jamais réutilisés."""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app.models import Project
from app.numbering import next_ticket_number


def create_ticket(client, **fields):
    return client.post("/tickets", json={"title": "Un ticket", **fields})


def add_project(db_session, key, name="Maison", created_at=None):
    project = Project(name=name, key=key)
    if created_at is not None:
        project.created_at = created_at
    db_session.add(project)
    db_session.flush()
    return project


def test_ticket_has_project_number_and_key(client):
    body = create_ticket(client).json()

    assert body["number"] == 1
    assert body["key"] == "PERSO-1"
    assert body["project"] == {
        "id": body["project"]["id"],
        "key": "PERSO",
        "name": "Personnel",
    }


def test_numbers_follow_each_other(client):
    keys = [create_ticket(client).json()["key"] for _ in range(3)]

    assert keys == ["PERSO-1", "PERSO-2", "PERSO-3"]


def test_list_and_detail_return_the_key(client):
    ticket = create_ticket(client).json()

    assert client.get("/tickets").json()[0]["key"] == "PERSO-1"
    detail = client.get(f"/tickets/{ticket['id']}").json()
    assert detail["key"] == "PERSO-1"
    assert detail["project"]["name"] == "Personnel"


def test_number_of_deleted_ticket_is_never_reused(client):
    create_ticket(client)
    last = create_ticket(client).json()
    client.delete(f"/tickets/{last['id']}")

    assert create_ticket(client).json()["key"] == "PERSO-3"


def test_ticket_can_be_created_in_given_project(client, db_session):
    maison = add_project(db_session, "MAISON")
    create_ticket(client)

    body = create_ticket(client, project_id=maison.id).json()

    assert body["key"] == "MAISON-1"
    assert body["project"] == {"id": maison.id, "key": "MAISON", "name": "Maison"}
    assert create_ticket(client).json()["key"] == "PERSO-2"


def test_unknown_project_returns_422(client):
    response = create_ticket(client, project_id=999999)

    assert response.status_code == 422
    assert client.get("/tickets").json() == []


def test_without_project_the_oldest_is_used(client, db_session):
    add_project(db_session, "ANCIEN", "Ancien", datetime(2000, 1, 1, tzinfo=UTC))

    assert create_ticket(client).json()["key"] == "ANCIEN-1"


def test_without_any_project_returns_422(client, db_session):
    db_session.execute(delete(Project))

    response = create_ticket(client)

    assert response.status_code == 422


def test_update_ignores_project_number_and_key(client, db_session):
    maison = add_project(db_session, "MAISON")
    created = create_ticket(client).json()

    response = client.patch(
        f"/tickets/{created['id']}",
        json={"title": "Renommé", "project_id": maison.id, "number": 9, "key": "X-9"},
    )

    body = response.json()
    assert (body["title"], body["key"]) == ("Renommé", "PERSO-1")
    assert body["project"]["key"] == "PERSO"


def test_number_survives_project_deletion_and_recreation(db_session):
    maison = add_project(db_session, "MAISON")
    assert next_ticket_number(db_session, "MAISON") == 1
    assert next_ticket_number(db_session, "MAISON") == 2
    db_session.delete(maison)
    db_session.flush()

    add_project(db_session, "MAISON", "Maison, le retour")

    assert next_ticket_number(db_session, "MAISON") == 3


def test_cancelled_creation_does_not_consume_a_number(db_session):
    savepoint = db_session.begin_nested()
    assert next_ticket_number(db_session, "PERSO") == 1
    savepoint.rollback()

    assert next_ticket_number(db_session, "PERSO") == 1


def test_simultaneous_creations_never_share_a_number(make_database):
    # Vraies connexions séparées, sur une base jetable migrée
    engine = create_engine(make_database())

    def create_in_other_session():
        with Session(engine) as session:
            number = next_ticket_number(session, "PERSO")
            session.commit()
            return number

    try:
        with Session(engine) as first, ThreadPoolExecutor(max_workers=1) as pool:
            assert next_ticket_number(first, "PERSO") == 1
            # La seconde création attend que la première soit terminée...
            second = pool.submit(create_in_other_session)
            time.sleep(0.5)
            assert not second.done()
            first.commit()
            # ...puis reçoit le numéro suivant
            assert second.result(timeout=10) == 2
    finally:
        engine.dispose()
