# Qui a voté quoi ? : instructions pour l'agent

Site public (`quiavotequoi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature). Source de vérité des choix : [docs/PLAN.md](docs/PLAN.md). Formats échangés : [docs/CONTRAT.md](docs/CONTRAT.md), recopié dans `src/shared/contrat.ts`.

## Règle de base

**Rien n'est stocké chez nous** : pas de base, pas de fichier de données, **aucune clé API**. Toute donnée passe par `/api/*`, qui interroge l'API tabulaire publique de data.gouv.fr (`https://tabular-api.data.gouv.fr/api`). Le navigateur ne parle jamais directement à data.gouv.fr. Les fixtures de `src/server/fixtures/` ne servent qu'au développement et aux tests.

## Commandes

Node ≥ 22.22.3 exigé par Angular 22 (`.nvmrc` : 24).

| Commande                          | Rôle                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm start`                       | Build, puis serveur SSR avec le BFF factice (`MOCK_BFF=1`) sur le port 4000                     |
| `npm run build`                   | Build de production (`dist/lois-votes`)                                                         |
| `npm run serve:ssr`               | Lance le serveur SSR déjà construit (`MOCK_BFF=1 npm run serve:ssr` pour servir les fixtures)   |
| `npm test`                        | Tests unitaires (Vitest via `ng test`, jsdom)                                                   |
| `npm run lint`                    | ESLint (angular-eslint, règles de Fuda au préfixe `app`, `prefer-signals`, `prefer-standalone`) |
| `npm run typecheck`               | `tsc --noEmit` sur l'application, le serveur (`src/server.ts`, `src/server/`) et les specs      |
| `npm run format` / `format:check` | Prettier (mêmes réglages que Fuda ; `docs/` et `src/shared/contrat.ts` sont exclus)             |

## Définition de « terminé »

`npm run lint`, `npm run typecheck`, `npm test` et `npm run build` sont verts, et `MOCK_BFF=1 npm run serve:ssr` sert les 8 routes (`curl localhost:4000/api/accueil` renvoie la fixture). Ne rien déclarer de vert sans l'avoir lancé.

## Structure

- `src/main.ts`, `src/main.server.ts`, `src/server.ts` : entrées navigateur, rendu serveur, Express (routes `/api/*`, puis fichiers statiques, puis rendu Angular).
- `src/app/` : application. `app.routes.ts` (routes chargées par `loadComponent`), `app.routes.server.ts` (`RenderMode.Server` partout, `/a-propos` pré-rendue), `pages/<page>/` (un dossier par page : `.ts`, `.html`, `.scss`).
- `src/server/` : code serveur. `mock-bff.ts` (`appelerMock`, fonction pure) et `fixtures/bff/` (une réponse conforme au contrat par route). Le vrai BFF (`source/`, `cache.ts`, `classify.ts`, `routes.ts`) viendra avec le prompt 02 ; les fixtures de l'API tabulaire iront dans `fixtures/source/` (prompt 00).
- `src/shared/contrat.ts` : types du contrat, importés côté serveur et côté application avec l'alias `@contrat`.
- `src/index.html` : `lang="fr"`, précharge la police du texte (latin 500), script en ligne qui pose `data-theme="dark"` avant le rendu si `localStorage['fuda-theme'] === 'dark'` (dans un `try/catch`).
- `src/styles.scss` : Fuda (`fuda/styles/fuda.css`) puis les **polices latines seulement** (Dela Gothic One 400, Zen Maru Gothic 500 et 700). Ne pas importer `fuda/styles/fonts.css`, qui charge aussi le japonais.
- `docs/` : `PLAN.md`, `CONTRAT.md`, `prompts/`.

## Contrat

`docs/CONTRAT.md` est la source unique des formats échangés entre `/api/*` et l'application. `src/shared/contrat.ts` en est la **copie exacte** du bloc TypeScript (un test le vérifie). Modifier l'un sans l'autre est interdit, et tout changement du contrat est signalé dans le rapport. Les fixtures de `src/server/fixtures/bff/` doivent rester conformes (`fixtures.spec.ts`, `satisfies`).

Les dossiers (`dossier_ref`) des données réelles ne sont pas tous de la 17ᵉ législature : un scrutin de la 17ᵉ peut porter un dossier `DLR5L16N…` (texte repris d'une législature précédente). Les fixtures n'en contiennent pas, mais le vrai BFF et les routes `/lois/:dossier` doivent accepter `DLR5L1\dN\d+`.

## Modes du BFF

- `MOCK_BFF=1` : les routes `/api/*` servent les fixtures de `src/server/fixtures/bff/` avec un délai de 150 ms et les `Cache-Control` du plan. Une ressource inconnue répond 404 `{ "erreur": "…" }`. C'est le mode de `npm start`.
- Sans `MOCK_BFF` : les routes `/api/*` répondent 503 (`Retry-After: 60`, `Cache-Control: no-store`) tant que le prompt 02 n'a pas livré le vrai serveur.

Fixtures disponibles : `/api/accueil` (10 lois), `/api/lois/DLR5L17N51670` (3 lectures) et `/api/lois/DLR5L17N54372`, `/api/scrutins/8280` et `/api/scrutins/8430`, `/api/deputes` (574 actifs), `/api/deputes/marine-le-pen` et `/api/deputes/mathilde-panot`. Elles viennent des exports publics de NosParlementaires (19 octobre 2026) ; `taux.participation` et `taux.loyaute` des fiches sont calculés à partir des votes (Datan n'est pas lu) et ne servent qu'à la mise en page.

## Conventions Angular

Reprendre celles de Fuda :

- Angular 22 : composants standalone, `OnPush` et zoneless sont les valeurs par défaut, on ne les répète pas. Aucun NgModule, aucun `standalone: true`.
- Signaux partout : `input()`, `input.required()`, `model()`, `output()`, `computed()`, `viewChild()`, `httpResource()`. Pas de `@Input`/`@Output`, pas de `ngOnChanges`. Les drapeaux booléens utilisent `{ transform: booleanAttribute }`.
- Contrôle de flux natif (`@if`, `@for`, `@switch`, `@defer`), jamais `*ngIf`.
- `host: {}` dans le décorateur, pas de `@HostBinding`/`@HostListener`. `inject()` plutôt que l'injection par constructeur.
- Sélecteurs préfixés `app`. Composants posés sur l'élément natif quand c'est possible (`button[appX]`) pour garder la sémantique HTML.
- Formulaires : champs Fuda en `FormValueControl<T>` de `@angular/forms/signals` (`[formField]`), pas de `ControlValueAccessor`.
- Un état qui change hors d'un événement Angular (observable, minuterie) passe par un signal, sinon l'affichage ne se met pas à jour (zoneless).

## Conventions de style

- Uniquement des custom properties issues des tokens Fuda (`--space-*`, `--ink`, `--surface`, `--font-display`, `--duration-*`…), aucune valeur en dur (couleur, espacement, durée, courbe). Classes BEM préfixées `app-`.
- **Template et styles dans des fichiers séparés** : `templateUrl` (`.html`) et `styleUrl` (`.scss`), jamais de `template:` ni de `styles:` inline.
- **`ViewEncapsulation.None`** avec un `.scss` par composant et des classes BEM `app-*`. Les hôtes de composants sont des éléments personnalisés, donc `inline` par défaut : un hôte qui porte une bordure ou une hauteur reçoit un `display` explicite.
- Thème Jour par défaut. Thème Nuit **uniquement** par `data-theme="dark"` sur `<html>`, posé par `FdThemeService` sur choix de l'utilisateur. Jamais de `prefers-color-scheme` pour les couleurs.
- Mouvement : durées et courbes des tokens, animation de `transform` et `opacity` seulement, `prefers-reduced-motion` respecté (bloc de `base.css` de Fuda).
- Budgets `angular.json` en erreur : initial ≤ 260 Ko brut (voir ci-dessous), style d'un composant ≤ 4 Ko.
- `outputHashing: bundles` : les polices gardent un nom stable (`/media/zen-maru-gothic-latin-500-normal.woff2`), pour que le préchargement de `index.html` corresponde au fichier réellement chargé. À vérifier après un changement de build.

## Accessibilité (WCAG 2.2 AA)

Focus toujours visible (`--focus-ring`), cibles de 44 px, libellé de champ toujours visible, texte à 4.5:1 dans les deux thèmes, mouvement réduit respecté, un seul `<h1>` par page, `<main>` dans `app.html`.

## Textes

Libellés, documentation et messages de commit en français. « Adopté par l'Assemblée » / « Rejeté par l'Assemblée », jamais « loi adoptée ». « Participation aux scrutins », jamais « présence ».

## Budget du bundle initial

Le plan visait 150 Ko brut. C'est impossible avec Angular 22 : le squelette (cœur + routeur + hydratation) pèse déjà 232 Ko brut (65 Ko transférés en gzip), dont `@angular/core` ≈ 150 Ko et `@angular/router` ≈ 86 Ko avant la moindre page. Le budget bloquant est donc réglé à 260 Ko brut (alerte à 250 Ko) ; la cible de 150 Ko vaut pour le **transfert** (aujourd'hui 66 Ko). Ne pas relever ce budget sans mesure.
