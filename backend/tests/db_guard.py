from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

TEST_DATABASE_SUFFIX = "_test"


def check_test_database_url(url: str) -> None:
    """Refuse toute base dont le nom ne se termine pas par `_test`.

    Les tests créent puis suppriment toutes les tables : pointés par erreur
    sur la base `minijira`, ils effaceraient les vrais tickets.
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
