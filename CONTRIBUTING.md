# Contribuer à MiniJira

MiniJira est une application de gestion de tickets inspirée de Jira. Le projet sert à pratiquer un workflow d'équipe : issues, branches, pull requests, CI et revue de code. Le [README](README.md) présente la stack prévue et le statut du projet.

## Démarrer

```bash
git clone https://github.com/Romain-Chevrollier/minijira.git
cd minijira
```

Le dépôt ne contient pas encore de code applicatif : il n'y a donc pas encore de commande pour lancer l'application, les tests ou le lint. Cette section sera complétée au fur et à mesure.

## Le parcours d'une contribution

1. **Partir d'une issue.** Chaque branche correspond à une issue. Notez son numéro, il servira pour la branche et la PR.
2. **Proposer un plan pour toute tâche non triviale**, avant de commencer à coder.
3. **Créer la branche depuis un `main` à jour :**

   ```bash
   git switch main
   git pull
   git switch -c feat/12-creation-ticket
   ```

4. **Committer** en suivant les conventions ci-dessous.
5. **Pousser la branche :**

   ```bash
   git push -u origin feat/12-creation-ticket
   ```

6. **Ouvrir une pull request** vers `main`, avec `Closes #<n°>` dans sa description pour la lier à son issue.

## Nommer les branches

| Type | Format | Exemple |
| --- | --- | --- |
| Fonctionnalité | `feat/<n°>-description` | `feat/12-creation-ticket` |
| Correction | `fix/<n°>-description` | `fix/27-tri-des-tickets` |
| Documentation | `docs/...` | `docs/guide-contribution` |
| Maintenance | `chore/...` | `chore/maj-gitignore` |

## Écrire les commits

Les messages de commit suivent le format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

| Préfixe | Usage | Exemple |
| --- | --- | --- |
| `feat:` | Nouvelle fonctionnalité | `feat: ajouter la création de ticket` |
| `fix:` | Correction de bug | `fix: corriger le tri des tickets` |
| `docs:` | Documentation | `docs: ajouter le guide de contribution` |
| `chore:` | Maintenance | `chore: mettre à jour le .gitignore` |
| `test:` | Tests | `test: couvrir la création de ticket` |
| `refactor:` | Réécriture sans changement de comportement | `refactor: extraire la validation des tickets` |

## Règles à respecter

- Ne jamais committer ni pousser directement sur `main`.
- Faire de petits changements, avec une seule responsabilité par PR.
- Accompagner toute nouvelle fonctionnalité de tests.
