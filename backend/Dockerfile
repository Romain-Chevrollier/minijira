# Image officielle de uv : même version de uv qu'en local, avec Python 3.12
FROM ghcr.io/astral-sh/uv:0.12.5-python3.12-trixie-slim

# Précompile le Python pour un démarrage plus rapide, sans garder de cache uv dans l'image
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

WORKDIR /app

# Dépendances d'abord : Docker garde cette étape en cache tant que
# pyproject.toml et uv.lock ne changent pas. Pas d'outils de dev (pytest, ruff).
COPY pyproject.toml uv.lock ./
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
