# Qui a voté quoi ? : instructions pour l'agent

Site public (`quiavotequi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature). Source de vérité des choix : [docs/PLAN.md](docs/PLAN.md). Formats échangés : [docs/CONTRAT.md](docs/CONTRAT.md) (recopié dans `src/shared/contrat.ts`).

## Règle de base

Rien n'est stocké chez nous : pas de base, pas de fichier, aucune clé API. Toute donnée passe par `/api/*`, qui interroge l'API tabulaire publique de data.gouv.fr (`https://tabular-api.data.gouv.fr/api`). Le navigateur ne parle jamais directement à data.gouv.fr.

## Commandes

Node ≥ 22.22.3 (`.nvmrc` : 24).

| Commande                          | Rôle                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `npm start`                       | Build, puis serveur SSR avec le BFF factice (`MOCK_BFF=1`) sur le port 4000            |
| `npm run build`                   | Build de production (`dist/lois-votes`)                                                |
| `npm run serve:ssr`               | Lance le serveur SSR déjà construit (`MOCK_BFF=1 npm run serve:ssr` pour les fixtures) |
| `npm test`                        | Tests unitaires (Vitest via `ng test`, jsdom)                                          |
| `npm run lint`                    | ESLint (angular-eslint, règles Fuda adaptées au préfixe `app`)                         |
| `npm run typecheck`               | `tsc` sur l'application, le serveur et les specs                                       |
| `npm run format` / `format:check` | Prettier                                                                               |

Une tâche est terminée quand `lint`, `typecheck`, `test` et `build` sont verts, et que `MOCK_BFF=1 npm run serve:ssr` sert les 8 routes (`curl localhost:4000/api/accueil` renvoie la fixture).

## Structure

- `src/main.ts`, `src/main.server.ts`, `src/server.ts` : entrées navigateur, serveur de rendu et Express (routes `/api/*`).
- `src/app/` : application. `app.routes.ts` (routes chargées par `loadComponent`), `app.routes.server.ts` (rendu : serveur partout, `/a-propos` pré-rendue), `pages/<page>/` (un dossier par page).
- `src/server/` : BFF. `mock-bff.ts` (`appelerMock`, fixtures), `fixtures/bff/` (réponses conformes au contrat, écrites à partir des exports publics de NosParlementaires).
- `src/shared/contrat.ts` : types du contrat, importés côté serveur et côté app avec l'alias `@contrat`.
- `src/index.html` : `lang="fr"`, précharge la police du texte (latin 500), script en ligne qui pose `data-theme="dark"` avant le rendu.
- `src/styles.scss` : Fuda (`fuda/styles/fuda.css`) et les polices latines seulement (Dela Gothic One 400, Zen Maru Gothic 500 et 700).

## Modes du BFF

- `MOCK_BFF=1` : les routes `/api/*` servent les fixtures de `src/server/fixtures/bff/` avec un délai de 150 ms (`appelerMock`). C'est le mode de `npm start` tant que le vrai serveur (prompt 02) n'est pas livré.
- Sans `MOCK_BFF` : `/api/*` répond 503 `{ erreur }` avec `Retry-After`, faute de BFF réel.

## Conventions Angular

Reprendre celles de Fuda (`/home/user/design-system-fuda/CLAUDE.md`) :

- Angular 22, composants standalone (pas de `standalone: true`), zoneless, `OnPush` implicite. Aucun NgModule.
- Signaux : `input()`, `model()`, `output()`, `computed()`, `httpResource()`. Pas de `@Input`/`@Output`, pas de `ngOnChanges`. `@if/@for/@defer`, jamais `*ngIf`.
- `host: {}` dans le décorateur, `inject()` plutôt que le constructeur. Sélecteurs préfixés `app-`.
- Template et styles dans des fichiers séparés (`templateUrl`, `styleUrl`), jamais inline. `ViewEncapsulation.None` avec des classes BEM `app-*`.
- Les hôtes qui portent une bordure ou une hauteur reçoivent un `display` explicite.
- Un état qui change hors d'un événement Angular (observable, minuterie) passe par un signal (zoneless).

## Style et accessibilité

- Uniquement des custom properties issues des tokens Fuda (`--space-*`, `--ink`, `--surface`, `--font-display`…). Aucune couleur, longueur, durée ou courbe en dur dans un `.scss` (`conventions.spec.ts` le vérifie). Un `.scss` de composant pèse au plus 4 Ko (budget bloquant).
- Thème Jour par défaut, Nuit uniquement par `data-theme="dark"` sur `<html>`. Jamais `prefers-color-scheme` pour les couleurs.
- WCAG 2.2 AA : focus visible (`--focus-ring`), cibles de 44 px, libellé de champ visible, texte à 4.5:1 dans les deux thèmes, mouvement réduit respecté.
- Ne jamais écrire « loi adoptée » : « Adopté par l'Assemblée ». Écrire « participation aux scrutins », jamais « présence ».

## Budgets et polices

- Budgets `angular.json` en erreur : initial ≤ 150 Ko, styles par composant ≤ 4 Ko.
- `outputHashing: bundles` en production : les polices gardent un nom stable, pour que le préchargement de `index.html` (`/media/zen-maru-gothic-latin-500-normal.woff2`) corresponde au fichier réellement chargé. À vérifier après chaque changement de build.

## Textes

Tous les textes de l'interface et de la documentation sont en français, ainsi que les messages de commit.
