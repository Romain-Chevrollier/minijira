"""Routes de gestion des projets : lister, créer, renommer, supprimer."""

from datetime import UTC, datetime

import pytest

from app.models import Project


def create_project(client, **fields):
    return client.post("/projects", json={"name": "Maison", "key": "MAISON", **fields})


def create_ticket(client, project_id=None):
    payload = {"title": "Un ticket"}
    if project_id is not None:
        payload["project_id"] = project_id
    return client.post("/tickets", json=payload)


def find(projects, key):
    return next(project for project in projects if project["key"] == key)


# --- Lister ---


def test_list_returns_default_project_with_its_fields(client):
    projects = client.get("/projects").json()

    assert len(projects) == 1
    perso = projects[0]
    assert (perso["key"], perso["name"], perso["ticket_count"]) == (
        "PERSO",
        "Personnel",
        0,
    )
    assert isinstance(perso["id"], int)
    datetime.fromisoformat(perso["created_at"])  # lève une erreur si pas ISO 8601


def test_list_goes_from_oldest_to_newest(client, db_session):
    create_project(client, key="NOUVEAU")
    old_date = datetime(2000, 1, 1, tzinfo=UTC)
    db_session.add(Project(name="Ancien", key="ANCIEN", created_at=old_date))
    db_session.flush()

    keys = [project["key"] for project in client.get("/projects").json()]

    assert keys == ["ANCIEN", "PERSO", "NOUVEAU"]


def test_list_counts_tickets_of_each_project(client):
    maison = create_project(client).json()
    create_ticket(client)
    create_ticket(client, maison["id"])
    create_ticket(client, maison["id"])

    projects = client.get("/projects").json()

    assert find(projects, "PERSO")["ticket_count"] == 1
    assert find(projects, "MAISON")["ticket_count"] == 2


# --- Créer ---


def test_create_returns_201_and_project(client):
    response = create_project(client, name="  Maison  ")

    assert response.status_code == 201
    body = response.json()
    assert (body["key"], body["name"], body["ticket_count"]) == ("MAISON", "Maison", 0)
    assert find(client.get("/projects").json(), "MAISON")["id"] == body["id"]


@pytest.mark.parametrize("key", ["AB", "V2", "ABCDEFGHIJ", "A1B2"])
def test_valid_keys_are_accepted(client, key):
    assert create_project(client, key=key).status_code == 201


@pytest.mark.parametrize(
    "key",
    [
        "A",  # trop courte
        "ABCDEFGHIJK",  # trop longue
        "maison",  # minuscules
        "Maison",
        "1ABC",  # commence par un chiffre
        "AB-C",
        "AB C",
        " AB",
        "ÉTÉ",  # accents
        "",
        None,
        12,
    ],
)
def test_invalid_key_returns_422(client, key):
    response = create_project(client, key=key)

    assert response.status_code == 422
    assert len(client.get("/projects").json()) == 1


@pytest.mark.parametrize("name", ["", "   ", "x" * 101, None])
def test_invalid_name_returns_422(client, name):
    assert create_project(client, name=name).status_code == 422


def test_name_of_100_characters_is_accepted(client):
    assert create_project(client, name="x" * 100).status_code == 201


def test_missing_fields_return_422(client):
    assert client.post("/projects", json={"name": "Maison"}).status_code == 422
    assert client.post("/projects", json={"key": "MAISON"}).status_code == 422


def test_existing_key_returns_409(client):
    create_project(client)

    response = create_project(client, name="Autre maison")

    assert response.status_code == 409
    assert "MAISON" in response.json()["detail"]
    assert len(client.get("/projects").json()) == 2


def test_default_project_key_is_taken(client):
    assert create_project(client, key="PERSO").status_code == 409


def test_api_still_works_after_a_409(client):
    create_project(client)
    create_project(client)

    assert create_project(client, key="JARDIN").status_code == 201


# --- Renommer ---


def test_rename_changes_only_the_name(client):
    maison = create_project(client).json()
    create_ticket(client, maison["id"])

    response = client.patch(f"/projects/{maison['id']}", json={"name": " Chez moi "})

    assert response.status_code == 200
    assert response.json() == {**maison, "name": "Chez moi", "ticket_count": 1}


@pytest.mark.parametrize("key", ["JARDIN", "MAISON", None])
def test_changing_the_key_returns_422(client, key):
    maison = create_project(client).json()

    response = client.patch(
        f"/projects/{maison['id']}", json={"name": "Chez moi", "key": key}
    )

    assert response.status_code == 422
    assert find(client.get("/projects").json(), "MAISON")["name"] == "Maison"


@pytest.mark.parametrize("payload", [{}, {"name": ""}, {"name": "x" * 101}])
def test_invalid_rename_returns_422(client, payload):
    maison = create_project(client).json()

    assert client.patch(f"/projects/{maison['id']}", json=payload).status_code == 422


def test_rename_unknown_project_returns_404(client):
    response = client.patch("/projects/999999", json={"name": "Chez moi"})

    assert response.status_code == 404


# --- Supprimer ---


def test_delete_empty_project_returns_204(client):
    maison = create_project(client).json()

    response = client.delete(f"/projects/{maison['id']}")

    assert response.status_code == 204
    keys = [project["key"] for project in client.get("/projects").json()]
    assert keys == ["PERSO"]


def test_delete_project_with_tickets_returns_409_with_their_number(client):
    maison = create_project(client).json()
    create_ticket(client, maison["id"])
    create_ticket(client, maison["id"])

    response = client.delete(f"/projects/{maison['id']}")

    assert response.status_code == 409
    assert "2 tickets" in response.json()["detail"]
    assert find(client.get("/projects").json(), "MAISON")["ticket_count"] == 2


def test_delete_project_with_one_ticket_says_it_in_singular(client):
    maison = create_project(client).json()
    create_ticket(client, maison["id"])

    response = client.delete(f"/projects/{maison['id']}")

    assert "1 ticket " in response.json()["detail"]


def test_delete_last_project_returns_409(client):
    perso = client.get("/projects").json()[0]

    response = client.delete(f"/projects/{perso['id']}")

    assert response.status_code == 409
    assert "dernier" in response.json()["detail"]
    assert len(client.get("/projects").json()) == 1


def test_delete_unknown_project_returns_404(client):
    assert client.delete("/projects/999999").status_code == 404


def test_recreated_key_resumes_its_numbering(client):
    maison = create_project(client).json()
    ticket = create_ticket(client, maison["id"]).json()
    assert ticket["key"] == "MAISON-1"
    client.delete(f"/tickets/{ticket['id']}")
    assert client.delete(f"/projects/{maison['id']}").status_code == 204

    recreated = create_project(client, name="Maison, le retour").json()

    assert create_ticket(client, recreated["id"]).json()["key"] == "MAISON-2"
