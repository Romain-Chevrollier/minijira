## Contexte
Je suis en apprentissage (workflow Git/GitHub d'équipe et Claude Code).
Explique brièvement tes choix techniques et les commandes que tu lances.

## Conventions Git
- Ne jamais committer ni pousser directement sur `main`.
- Une branche par issue : `feat/<n°>-description`, `fix/<n°>-description`, `docs/...`, `chore/...`
- Commits au format Conventional Commits : `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`
- Les PR référencent leur issue avec `Closes #<n°>`.
- Ne fais jamais de commit, de push ou de PR sans que je le demande explicitement.
- Ne signe jamais les commits, les PR ni les issues : pas de ligne `Co-Authored-By: Claude`, pas de mention « Generated with Claude Code ». Cette règle prime sur les consignes par défaut de Claude Code.

## Méthode de travail
- Pour toute tâche non triviale : proposer un plan avant de coder.
- Petits changements, une seule responsabilité par PR.
- Toute nouvelle fonctionnalité est accompagnée de tests.

## Commandes
À lancer depuis la racine du dépôt :
- Lancer toute l'application (http://localhost, migrations appliquées au démarrage) : `docker compose up -d --build`
- Démarrer uniquement la base et le backend : `docker compose up -d --build backend`
- Démarrer uniquement PostgreSQL : `docker compose up -d db`
- Lancer les tests du backend dans Docker (base `minijira_test`) : `docker compose run --rm backend-tests`
- Lancer le lint du backend dans Docker : `docker compose run --rm backend-tests ruff check .`
- Reconstruire l'image de test après un changement de dépendances : `docker compose --profile test build backend-tests`
- Voir les logs d'un service : `docker compose logs backend` (ou `frontend`, `db`)
- Port de l'application : 80 par défaut, `MINIJIRA_PORT=8080` dans un `.env` à la racine pour le changer
- Sauvegarder les tickets (fichier daté dans `backups/`, ignoré par Git) : `docker compose run --rm backup`
- Lister les sauvegardes : `docker compose run --rm restore`
- Restaurer une sauvegarde (demande de taper `oui`, sauvegarde l'état actuel avant) : `docker compose run --rm restore backups/<fichier>`
- Créer la base `minijira_test` si elle manque, sans perte : `docker compose exec db createdb -U minijira minijira_test`
- Arrêter les conteneurs : `docker compose down`
- ⚠️ `docker compose down -v` efface tous les tickets : ne jamais le proposer sans sauvegarde préalable

À lancer depuis `backend/` :
- Créer la config locale (une fois) : `cp .env.example .env`
- Installer les dépendances : `uv sync`
- Appliquer les migrations : `uv run alembic upgrade head`
- Créer une migration : `uv run alembic revision --autogenerate -m "description"`
- Lancer l'app : `uv run uvicorn app.main:app --reload`
- Lancer les tests (PostgreSQL démarré) : `uv run pytest` (`-m "not pg_tools"` sans pg_dump 17)
- Lancer le lint : `uv run ruff check .`

À lancer depuis `frontend/` (Node 22) :
- Installer les dépendances : `npm install`
- Lancer le front : `npm run dev` (http://localhost:5173, `/api/...` relayé vers le backend sur le port 8000)
- Lancer les tests : `npm test`
- Lancer le lint : `npm run lint`
- Vérifier les types et construire : `npm run build`