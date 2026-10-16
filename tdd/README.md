# Tests écrits d'abord (TDD)

Les tests de chaque tâche du plan sont écrits **avant** le code, dans `tdd/<tâche>/`, avec l'arborescence
qu'ils auront dans le dépôt (`tdd/02-bff/src/server/routes.spec.ts` deviendra `src/server/routes.spec.ts`).

`node tdd/activer.mjs 02-bff` les déplace à leur place définitive. On active les tests d'une tâche juste avant
de lancer son développeur : tant qu'ils ne sont pas activés, ils ne cassent ni `typecheck` ni `npm test`.

| Dossier | Tâche (prompt) | Ce que les tests imposent |
|---|---|---|
| `01-squelette` | 01 | contrat = `docs/CONTRAT.md`, fixtures du BFF factice, routes, outillage, conventions Fuda/Angular |
| `02-bff` | 02 | classification, cache, limiteur, client tabulaire, routes `/api/*`, robustesse ; faux serveur et jeu de données de test |
| `03-donnees` | 03 | `httpResource`, intercepteur SSR, statut HTTP, pré-chargement du code et des données, formats |
| `04-ui` | 04 | composants de présentation, recherche (combobox), shell, vue d'accueil |
| `05-pages` | 05 | pages loi, scrutin, députés, député, recherche, à propos, 404 |
| `06-e2e` | 06 | Umami, SEO, en-têtes, faux serveur HTTP, Playwright (parcours, SSR, hydratation, axe, clavier, mouvement réduit, panne) |

Le prompt 00 (exploration de l'API tabulaire) n'a pas de test unitaire : il produit des fixtures réelles. Il
n'a pas pu être exécuté (data.gouv.fr injoignable depuis l'environnement de développement), les tests
reposent donc sur un jeu de données synthétique (`src/server/testing/univers.mjs`).
