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


def test_list_tickets_empty_returns_empty_list(client):
    response = client.get("/tickets")

    assert response.status_code == 200
    assert response.json() == []


def test_list_tickets_returns_all_tickets(client):
    first = create_ticket(client, title="Premier").json()
    second = create_ticket(
        client, title="Second", description="Détails", assignee="Bob"
    ).json()

    response = client.get("/tickets")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    # Mêmes champs que la création (donc que GET /tickets/{id})
    assert second in body
    assert first in body


def test_list_tickets_sorted_by_id_desc(client):
    ids = [create_ticket(client).json()["id"] for _ in range(3)]

    response = client.get("/tickets")

    assert [ticket["id"] for ticket in response.json()] == sorted(ids, reverse=True)


def update_ticket(client, ticket_id, **fields):
    return client.patch(f"/tickets/{ticket_id}", json=fields)


def test_update_ticket_returns_200_and_updated_ticket(client):
    created = create_ticket(client).json()

    response = update_ticket(
        client,
        created["id"],
        title="Nouveau titre",
        description="Nouvelle description",
        priority="high",
        assignee="Bob",
        status="in_progress",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Nouveau titre"
    assert body["description"] == "Nouvelle description"
    assert body["priority"] == "high"
    assert body["assignee"] == "Bob"
    assert body["status"] == "in_progress"


def test_update_ticket_is_saved_in_database(client, db_session):
    created = create_ticket(client).json()

    update_ticket(client, created["id"], title="Nouveau titre", status="done")

    ticket = db_session.get(Ticket, created["id"])
    db_session.refresh(ticket)  # relit la ligne en base plutôt que le cache
    assert ticket.title == "Nouveau titre"
    assert ticket.status == "done"


def test_update_ticket_keeps_fields_not_sent(client):
    created = create_ticket(
        client, description="Détails", priority="low", assignee="Alice"
    ).json()

    response = update_ticket(client, created["id"], priority="high")

    assert response.json() == {**created, "priority": "high"}


STATUSES = ["todo", "in_progress", "done"]


@pytest.mark.parametrize("start", STATUSES)
@pytest.mark.parametrize("target", STATUSES)
def test_any_status_change_is_allowed(client, start, target):
    ticket_id = create_ticket(client).json()["id"]
    update_ticket(client, ticket_id, status=start)

    response = update_ticket(client, ticket_id, status=target)

    assert response.status_code == 200
    assert response.json()["status"] == target


@pytest.mark.parametrize(
    "fields",
    [
        {"status": "blocked"},
        {"priority": "urgent"},
        {"title": ""},
        {"title": "   "},
        {"title": "a" * 201},
        {"assignee": "a" * 101},
    ],
)
def test_update_with_invalid_value_returns_422(client, fields):
    ticket_id = create_ticket(client).json()["id"]

    response = update_ticket(client, ticket_id, **fields)

    assert response.status_code == 422


def test_update_title_is_stripped(client):
    ticket_id = create_ticket(client).json()["id"]

    response = update_ticket(client, ticket_id, title="  Nouveau titre  ")

    assert response.json()["title"] == "Nouveau titre"


@pytest.mark.parametrize("field", ["title", "priority", "status"])
def test_update_required_field_to_null_returns_422(client, field):
    ticket_id = create_ticket(client).json()["id"]

    response = update_ticket(client, ticket_id, **{field: None})

    assert response.status_code == 422


@pytest.mark.parametrize("field", ["description", "assignee"])
def test_update_optional_field_to_null_clears_it(client, field):
    ticket_id = create_ticket(client, description="Détails", assignee="Alice").json()[
        "id"
    ]

    response = update_ticket(client, ticket_id, **{field: None})

    assert response.status_code == 200
    assert response.json()[field] is None


@pytest.mark.parametrize("body", [{}, {"id": 42, "created_at": "2020-01-01T00:00:00Z"}])
def test_update_without_editable_field_returns_422(client, body):
    ticket_id = create_ticket(client).json()["id"]

    response = client.patch(f"/tickets/{ticket_id}", json=body)

    assert response.status_code == 422


def test_update_ignores_id_and_created_at(client):
    created = create_ticket(client).json()

    response = update_ticket(
        client,
        created["id"],
        title="Nouveau titre",
        id=42,
        created_at="2020-01-01T00:00:00Z",
    )

    body = response.json()
    assert body["id"] == created["id"]
    assert body["created_at"] == created["created_at"]


def test_update_unknown_ticket_returns_404(client):
    response = update_ticket(client, 999999, title="Nouveau titre")

    assert response.status_code == 404


def test_update_ticket_with_non_integer_id_returns_422(client):
    response = update_ticket(client, "abc", title="Nouveau titre")

    assert response.status_code == 422


def test_delete_ticket_returns_204_without_content(client):
    ticket_id = create_ticket(client).json()["id"]

    response = client.delete(f"/tickets/{ticket_id}")

    assert response.status_code == 204
    assert response.content == b""


def test_deleted_ticket_is_removed_from_database(client, db_session):
    ticket_id = create_ticket(client).json()["id"]

    client.delete(f"/tickets/{ticket_id}")

    assert db_session.get(Ticket, ticket_id) is None
    assert client.get(f"/tickets/{ticket_id}").status_code == 404


def test_delete_unknown_ticket_returns_404(client):
    response = client.delete("/tickets/999999")

    assert response.status_code == 404


def test_delete_ticket_twice_returns_404(client):
    ticket_id = create_ticket(client).json()["id"]
    client.delete(f"/tickets/{ticket_id}")

    response = client.delete(f"/tickets/{ticket_id}")

    assert response.status_code == 404


def test_delete_ticket_with_non_integer_id_returns_422(client):
    response = client.delete("/tickets/abc")

    assert response.status_code == 422
