# MiniJira

Application de gestion de tickets inspirée de Jira, développée pour pratiquer
un workflow d'équipe (issues, branches, pull requests, CI, code review).

## Stack prévue
- Backend : FastAPI, PostgreSQL, SQLAlchemy, Alembic
- Frontend : React, TypeScript, Vite
- Outillage : Docker Compose, pytest, ruff, Vitest, oxlint, GitHub Actions

## Lancer le backend

Deux façons de lancer le backend, au choix :
- **avec Docker** : la base et l'API tournent dans des conteneurs, il n'y a rien d'autre à installer ;
- **avec uv** : seule la base tourne dans Docker, l'API tourne sur la machine avec rechargement automatique
  à chaque modification du code. Pratique pour développer le backend.

Prérequis : [Docker](https://docs.docker.com/get-docker/) avec Docker Compose dans les deux cas,
et [uv](https://docs.astral.sh/uv/getting-started/installation/) pour la deuxième façon (il installe aussi Python 3.12 si besoin).

Dans les deux cas, pour vérifier que l'app répond, ouvrez http://127.0.0.1:8000/health :
la réponse attendue est `{"status":"ok"}`.

### Avec Docker

Depuis la racine du dépôt :

```bash
docker compose up -d --build   # construire l'image du backend, puis démarrer la base et l'API
docker compose ps              # db doit être "healthy" et backend "running"
docker compose logs backend    # voir les logs de l'API (migrations, requêtes)
```

Les migrations sont appliquées automatiquement au démarrage de l'API. Après une modification du code du
backend, relancez `docker compose up -d --build` pour reconstruire l'image.

### Avec uv

**1. Démarrer la base seule**, depuis la racine du dépôt :

```bash
docker compose up -d db        # démarrer uniquement PostgreSQL 17
```

Si le conteneur `backend` tourne déjà, arrêtez-le pour libérer le port 8000 : `docker compose stop backend`.

**2. Configurer, migrer et lancer l'app :**

```bash
cd backend
cp .env.example .env                   # créer la config locale (DATABASE_URL, TEST_DATABASE_URL)
uv sync                                # installer les dépendances
uv run alembic upgrade head            # appliquer les migrations sur la base de dev
uv run uvicorn app.main:app --reload   # lancer l'app sur http://127.0.0.1:8000
```

### La base de données

Le conteneur `db` contient deux bases : `minijira` pour le développement et `minijira_test` pour les tests.
Les données sont conservées dans un volume Docker entre deux redémarrages.

```bash
docker compose down      # arrêter les conteneurs (les données sont conservées)
docker compose down -v   # arrêter les conteneurs et supprimer toutes les données
```

> La base `minijira_test` est créée par `docker/postgres/init/01-create-test-db.sql`, qui ne s'exécute
> qu'au premier démarrage, quand le volume est vide. Si elle manque, lancez `docker compose down -v`
> puis `docker compose up -d`.

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

## Lancer le frontend

Prérequis : [Node.js](https://nodejs.org/) 22 (version indiquée dans `frontend/.nvmrc`), avec npm.

```bash
cd frontend
npm install                            # installer les dépendances
npm run dev                            # lancer le front sur http://localhost:5173
```

Le front appelle l'API sous le préfixe `/api`. En développement, Vite relaie ces appels vers le backend
(`http://127.0.0.1:8000`) en retirant le préfixe : `/api/health` arrive sur `/health`.
Le backend doit donc être lancé à côté. Pour vérifier, ouvrez http://localhost:5173/api/health :
la réponse attendue est `{"status":"ok"}`.

### Tests, lint et build

```bash
npm test                               # lancer les tests (Vitest)
npm run lint                           # lancer le lint (oxlint, échoue aussi sur les avertissements)
npm run build                          # vérifier les types TypeScript et construire le front dans dist/
```

## Statut
🚧 En cours — Sprint 2