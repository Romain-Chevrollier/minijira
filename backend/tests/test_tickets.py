from datetime import datetime

import pytest

from app.models import Ticket


def create_ticket(client, **fields):
    return client.post("/tickets", json={"title": "Corriger le login", **fields})


def test_create_ticket_returns_201_and_ticket(client):
    response = create_ticket(
        client,
        description="Le bouton ne répond pas",
        priority="high",
        assignee="Alice",
    )

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["title"] == "Corriger le login"
    assert body["description"] == "Le bouton ne répond pas"
    assert body["priority"] == "high"
    assert body["assignee"] == "Alice"
    assert body["status"] == "todo"
    datetime.fromisoformat(body["created_at"])  # lève une erreur si pas ISO 8601


def test_create_ticket_is_saved_in_database(client, db_session):
    response = create_ticket(client)

    ticket = db_session.get(Ticket, response.json()["id"])
    assert ticket is not None
    assert ticket.title == "Corriger le login"


def test_status_sent_by_client_is_ignored(client):
    response = create_ticket(client, status="done")

    assert response.status_code == 201
    assert response.json()["status"] == "todo"


def test_priority_defaults_to_medium(client):
    response = create_ticket(client)

    assert response.json()["priority"] == "medium"


@pytest.mark.parametrize("priority", ["low", "medium", "high"])
def test_valid_priorities_are_accepted(client, priority):
    response = create_ticket(client, priority=priority)

    assert response.status_code == 201
    assert response.json()["priority"] == priority


def test_unknown_priority_returns_422(client):
    response = create_ticket(client, priority="urgent")

    assert response.status_code == 422


def test_optional_fields_default_to_null(client):
    body = create_ticket(client).json()

    assert body["description"] is None
    assert body["assignee"] is None


@pytest.mark.parametrize("field", ["description", "assignee"])
def test_blank_optional_field_becomes_null(client, field):
    response = create_ticket(client, **{field: "   "})

    assert response.status_code == 201
    assert response.json()[field] is None


def test_title_is_stripped(client):
    response = create_ticket(client, title="  Corriger le login  ")

    assert response.json()["title"] == "Corriger le login"


def test_title_of_200_characters_is_accepted(client):
    response = create_ticket(client, title="a" * 200)

    assert response.status_code == 201


@pytest.mark.parametrize("title", ["", "   ", "a" * 201])
def test_invalid_title_returns_422(client, title):
    response = create_ticket(client, title=title)

    assert response.status_code == 422


def test_missing_title_returns_422(client):
    response = client.post("/tickets", json={"priority": "low"})

    assert response.status_code == 422


def test_assignee_over_100_characters_returns_422(client):
    response = create_ticket(client, assignee="a" * 101)

    assert response.status_code == 422


def test_get_ticket_returns_200_and_ticket(client):
    created = create_ticket(
        client,
        description="Le bouton ne répond pas",
        priority="high",
        assignee="Alice",
    ).json()

    response = client.get(f"/tickets/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_ticket_returns_404(client):
    response = client.get("/tickets/999999")

    assert response.status_code == 404


def test_get_ticket_with_non_integer_id_returns_422(client):
    response = client.get("/tickets/abc")

    assert response.status_code == 422
