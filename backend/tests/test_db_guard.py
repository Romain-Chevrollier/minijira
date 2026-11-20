import pytest

from tests.db_guard import check_test_database_url


def test_accepts_database_ending_with_test():
    check_test_database_url("postgresql+psycopg://u:p@db:5432/minijira_test")


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://u:p@db:5432/minijira",
        "postgresql+psycopg://u:p@db:5432/minijira_test_old",
        "postgresql+psycopg://u:p@db:5432/test",
        "postgresql+psycopg://u:p@db:5432",
    ],
)
def test_refuses_database_not_ending_with_test(url):
    with pytest.raises(ValueError, match="_test"):
        check_test_database_url(url)


def test_refuses_invalid_url():
    with pytest.raises(ValueError, match="pas une adresse valide"):
        check_test_database_url("pas une adresse")
