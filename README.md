# MiniJira

Application de gestion de tickets inspirée de Jira, développée pour pratiquer
un workflow d'équipe (issues, branches, pull requests, CI, code review).

## Stack prévue
- Backend : FastAPI, PostgreSQL
- Frontend : React (Vite)
- Outillage : Docker Compose, pytest, ruff, GitHub Actions

## Lancer le backend

Prérequis : [uv](https://docs.astral.sh/uv/getting-started/installation/). Il installe aussi Python 3.12 si besoin.

```bash
cd backend
uv sync                                # installer les dépendances
uv run uvicorn app.main:app --reload   # lancer l'app sur http://127.0.0.1:8000
uv run pytest                          # lancer les tests
uv run ruff check .                    # lancer le lint
```

Pour vérifier que l'app répond, ouvrez http://127.0.0.1:8000/health : la réponse attendue est `{"status":"ok"}`.

## Statut
🚧 En cours — Sprint 1