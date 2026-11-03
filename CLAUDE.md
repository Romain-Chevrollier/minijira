## Contexte
Je suis en apprentissage (workflow Git/GitHub d'équipe et Claude Code).
Explique brièvement tes choix techniques et les commandes que tu lances.

## Conventions Git
- Ne jamais committer ni pousser directement sur `main`.
- Une branche par issue : `feat/<n°>-description`, `fix/<n°>-description`, `docs/...`, `chore/...`
- Commits au format Conventional Commits : `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`
- Les PR référencent leur issue avec `Closes #<n°>`.
- Ne fais jamais de commit, de push ou de PR sans que je le demande explicitement.

## Méthode de travail
- Pour toute tâche non triviale : proposer un plan avant de coder.
- Petits changements, une seule responsabilité par PR.
- Toute nouvelle fonctionnalité est accompagnée de tests.

## Commandes
À lancer depuis la racine du dépôt :
- Démarrer PostgreSQL : `docker compose up -d`
- Arrêter PostgreSQL : `docker compose down` (`-v` pour supprimer les données)

À lancer depuis `backend/` :
- Créer la config locale (une fois) : `cp .env.example .env`
- Installer les dépendances : `uv sync`
- Appliquer les migrations : `uv run alembic upgrade head`
- Créer une migration : `uv run alembic revision --autogenerate -m "description"`
- Lancer l'app : `uv run uvicorn app.main:app --reload`
- Lancer les tests (PostgreSQL démarré) : `uv run pytest`
- Lancer le lint : `uv run ruff check .`