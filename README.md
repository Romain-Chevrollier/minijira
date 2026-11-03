# MiniJira

Application de gestion de tickets inspirée de Jira, développée pour pratiquer
un workflow d'équipe (issues, branches, pull requests, CI, code review).

## Stack prévue
- Backend : FastAPI, PostgreSQL, SQLAlchemy, Alembic
- Frontend : React (Vite)
- Outillage : Docker Compose, pytest, ruff, GitHub Actions

## Lancer le backend

Prérequis :
- [uv](https://docs.astral.sh/uv/getting-started/installation/). Il installe aussi Python 3.12 si besoin.
- [Docker](https://docs.docker.com/get-docker/) avec Docker Compose, pour PostgreSQL.

### 1. Démarrer la base de données

Depuis la racine du dépôt :

```bash
docker compose up -d     # démarrer PostgreSQL 17 en arrière-plan
docker compose ps        # le service db doit être "healthy"
```

Le conteneur contient deux bases : `minijira` pour le développement et `minijira_test` pour les tests.
Les données sont conservées dans un volume Docker entre deux redémarrages.

```bash
docker compose down      # arrêter PostgreSQL (les données sont conservées)
docker compose down -v   # arrêter PostgreSQL et supprimer toutes les données
```

> La base `minijira_test` est créée par `docker/postgres/init/01-create-test-db.sql`, qui ne s'exécute
> qu'au premier démarrage, quand le volume est vide. Si elle manque, lancez `docker compose down -v`
> puis `docker compose up -d`.

### 2. Configurer, migrer et lancer l'app

```bash
cd backend
cp .env.example .env                   # créer la config locale (DATABASE_URL, TEST_DATABASE_URL)
uv sync                                # installer les dépendances
uv run alembic upgrade head            # appliquer les migrations sur la base de dev
uv run uvicorn app.main:app --reload   # lancer l'app sur http://127.0.0.1:8000
```

Pour vérifier que l'app répond, ouvrez http://127.0.0.1:8000/health : la réponse attendue est `{"status":"ok"}`.

### 3. Tests et lint

PostgreSQL doit être démarré : les tests se connectent à la base `minijira_test`.

```bash
uv run pytest                          # lancer les tests
uv run ruff check .                    # lancer le lint
```

### Créer une migration

Après avoir ajouté ou modifié un modèle SQLAlchemy :

```bash
uv run alembic revision --autogenerate -m "description du changement"
uv run alembic upgrade head
```

Relisez toujours le fichier généré dans `backend/migrations/versions/` avant de l'appliquer.

## Statut
🚧 En cours — Sprint 1