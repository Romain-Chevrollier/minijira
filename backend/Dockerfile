# Image officielle de uv : même version de uv qu'en local, avec Python 3.12
FROM ghcr.io/astral-sh/uv:0.12.5-python3.12-trixie-slim AS base

# Précompile le Python pour un démarrage plus rapide, sans garder de cache uv dans l'image
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

WORKDIR /app

# Les deux images (tests et app) partent des mêmes versions, lues dans uv.lock
COPY pyproject.toml uv.lock ./


# --- Image de test : pytest et ruff, lancée par `docker compose run --rm backend-tests`
FROM base AS test

# L'environnement Python est installé dans /venv, hors de /app : le dossier backend/
# est partagé avec le conteneur, et le .venv de l'ordinateur ne doit pas être touché
ENV UV_PROJECT_ENVIRONMENT=/venv \
    PATH="/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1
RUN uv sync --locked --no-install-project

# Le code n'est pas copié : il est partagé depuis backend/ (voir compose.yaml)
CMD ["pytest"]


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
