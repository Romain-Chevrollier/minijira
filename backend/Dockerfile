# Image officielle de uv : même version de uv qu'en local, avec Python 3.12
FROM ghcr.io/astral-sh/uv:0.12.5-python3.12-trixie-slim AS base

# Précompile le Python pour un démarrage plus rapide, sans garder de cache uv dans l'image
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

WORKDIR /app

# Les images (tests, sauvegarde et app) partent des mêmes versions, lues dans uv.lock
COPY pyproject.toml uv.lock ./


# --- Outils PostgreSQL (pg_dump, pg_restore, psql) de la même version que le serveur (17),
# et fuseaux horaires pour dater les sauvegardes. Pour les tests et les sauvegardes,
# pas pour l'app.
FROM base AS pgclient
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 tzdata \
    && rm -rf /var/lib/apt/lists/*


# --- Image de test : pytest et ruff, lancée par `docker compose run --rm backend-tests`
FROM pgclient AS test

# L'environnement Python est installé dans /venv, hors de /app : le dossier backend/
# est partagé avec le conteneur, et le .venv de l'ordinateur ne doit pas être touché
ENV UV_PROJECT_ENVIRONMENT=/venv \
    PATH="/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1
RUN uv sync --locked --no-install-project

# Le code n'est pas copié : il est partagé depuis backend/ (voir compose.yaml)
CMD ["pytest"]


# --- Sauvegarde et restauration : `docker compose run --rm backup` (ou `restore`)
FROM pgclient AS tools

RUN uv sync --locked --no-dev --no-install-project

# Le code de l'app sert à compter les tickets et à appliquer les migrations
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
COPY scripts ./scripts

# PYTHONUNBUFFERED : la question de confirmation s'affiche avant la saisie
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1


# --- Image de l'app (dernière étape : celle construite par défaut)
FROM base AS app

# Dépendances d'abord : Docker garde cette étape en cache tant que
# pyproject.toml et uv.lock ne changent pas. Pas d'outils de dev (pytest, ruff).
RUN uv sync --locked --no-dev --no-install-project

# Puis le code de l'app et les migrations
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app

# L'app tourne avec un utilisateur sans droits d'administration
RUN useradd --system --no-create-home minijira
USER minijira

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

# Migrations puis serveur : si les migrations échouent, l'app ne démarre pas
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
