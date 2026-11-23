from sqlalchemy import Engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

TEST_DATABASE_SUFFIX = "_test"


def check_test_database_url(url: str) -> None:
    """Premier filtre, avant toute connexion : le nom de base écrit dans l'adresse.

    Ne suffit pas : un paramètre de l'adresse (`?dbname=...`) peut ouvrir une
    autre base. `check_connected_database` vérifie la base réellement ouverte.
    """
    try:
        database = make_url(url).database
    except ArgumentError as error:
        raise ValueError(
            f"TEST_DATABASE_URL n'est pas une adresse valide : {url}"
        ) from error

    if not database or not database.endswith(TEST_DATABASE_SUFFIX):
        raise ValueError(
            f"Refus : le nom de la base de test doit se terminer par "
            f"« {TEST_DATABASE_SUFFIX} » (reçu : « {database or 'aucun'} »). "
            "Les tests vident leur base : vérifiez TEST_DATABASE_URL."
        )


def check_connected_database(engine: Engine) -> None:
    """Demande à PostgreSQL le nom de la base réellement ouverte.

    Les tests créent puis suppriment toutes les tables : connectés par erreur
    à la base `minijira`, ils effaceraient les vrais tickets.
    """
    with engine.connect() as connection:
        database = connection.execute(text("SELECT current_database()")).scalar_one()

    if not database.endswith(TEST_DATABASE_SUFFIX):
        raise ValueError(
            f"Refus : les tests sont connectés à la base « {database} », dont le nom "
            f"ne se termine pas par « {TEST_DATABASE_SUFFIX} ». Rien n'a été modifié. "
            "Vérifiez TEST_DATABASE_URL (un paramètre comme ?dbname= change de base)."
        )
