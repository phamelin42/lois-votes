# Qui a voté quoi ? : instructions pour l'agent

Site public (`quiavotequoi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature). Source de vérité des choix : [docs/PLAN.md](docs/PLAN.md). Formats échangés : [docs/CONTRAT.md](docs/CONTRAT.md) (recopié dans `src/shared/contrat.ts`).

## Règle de base

Rien n'est stocké chez nous : pas de base, pas de fichier, aucune clé API. Toute donnée passe par `/api/*`, qui interroge l'API tabulaire publique de data.gouv.fr (`https://tabular-api.data.gouv.fr/api`). Le navigateur ne parle jamais directement à data.gouv.fr.

## Commandes

Node ≥ 22.22.3 (`.nvmrc` : 24).

| Commande                          | Rôle                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm start`                       | Build, puis serveur SSR avec le BFF factice (`MOCK_BFF=1`) sur le port 4000                                  |
| `npm run build`                   | Build de production (`dist/lois-votes`)                                                                      |
| `npm run serve:ssr`               | Lance le serveur SSR déjà construit (`MOCK_BFF=1 npm run serve:ssr` pour les fixtures)                       |
| `npm test`                        | Tests unitaires (Vitest via `ng test`, jsdom)                                                                |
| `npm run lint`                    | ESLint (angular-eslint, règles Fuda adaptées au préfixe `app`)                                               |
| `npm run typecheck`               | `tsc` sur l'application, le serveur et les specs                                                             |
| `npm run format` / `format:check` | Prettier                                                                                                     |
| `npm run e2e`                     | Build, puis Playwright contre trois instances SSR et deux faux serveurs (voir « Tests e2e »)                 |
| `npm run perf`                    | Build, puis Lighthouse mobile sur `/`, une loi et un député ; échoue sous 95 en performance ou accessibilité |
| `npm run donnees`                 | Archives officielles vers `data/` (`DONNEES_DEPUIS=fixtures` : jeu de test), hors build pour l'instant       |

Une tâche est terminée quand `lint`, `typecheck`, `test` et `build` sont verts, et que `MOCK_BFF=1 npm run serve:ssr` sert les 8 routes (`curl localhost:4000/api/accueil` renvoie la fixture). `e2e` s'exécute aussi quand une page, la navigation ou le serveur changent.

## Structure

- `src/main.ts`, `src/main.server.ts`, `src/server.ts` : entrées navigateur, serveur de rendu et Express (routes `/api/*`, `/robots.txt`, `/sitemap.xml`, en-têtes, Umami).
- `src/server/umami.ts`, `seo.ts`, `en-tetes.ts` : fonctions pures du serveur (script Umami, robots et sitemap, CSP et Cache-Control).
- `api/index.mjs`, `vercel.json` : déploiement Vercel (une fonction qui sert le serveur SSR, tout passe par elle).
- `scripts/donnees/` : pipeline des données officielles (`index.mjs` orchestre, `telecharger.mjs`, `lire.mjs`, `construire.mjs`, `ecrire.mjs`, `fixtures.mjs` pour regénérer le jeu de test) ; leurs specs tournent avec `npm test`. Format de `data/` : [docs/DONNEES.md](docs/DONNEES.md) ; types : `src/server/donnees.types.ts` ; classement des titres : `src/shared/classer.ts`.
- `e2e/` : Playwright (`*.spec.ts`, `aide.ts`) et faux serveur HTTP de l'API tabulaire (`faux-tabulaire.mjs`). `scripts/perf.mjs` : Lighthouse. `.github/workflows/ci.yml` : CI.
- `src/app/` : application. `app.routes.ts` (routes chargées par `loadComponent`), `app.routes.server.ts` (rendu : serveur partout, `/a-propos` pré-rendue), `pages/<page>/` (un dossier par page).
- `src/server/` : BFF. `bff.ts` (`appelerBffActif`, choisit le mode), `routes.ts` (routes `/api/*`, `Cache-Control`, erreurs), `agregation.ts` (assemblage des réponses), `index-deputes.ts` (députés joints à Datan), `source/` (seul accès à data.gouv.fr : client tabulaire, limiteur, rid, colonnes), `cache.ts` (mémoire, périmé servi en cas de panne), `classify.ts` et `groupes.ts` (fonctions pures). `mock-bff.ts` (`appelerMock`) et `fixtures/bff/` servent le mode factice.
- `src/shared/contrat.ts` : types du contrat, importés côté serveur et côté app avec l'alias `@contrat`.
- `src/index.html` : `lang="fr"`, précharge la police du texte (latin 500), script en ligne qui pose `data-theme="dark"` avant le rendu.
- `src/styles.scss` : Fuda (`fuda/styles/fuda.css`) et les polices latines seulement (Dela Gothic One 400, Zen Maru Gothic 500 et 700).

## Modes du BFF

- `MOCK_BFF=1` : les routes `/api/*` servent les fixtures de `src/server/fixtures/bff/` avec un délai de 150 ms (`appelerMock`). C'est le mode de `npm start`.
- Sans `MOCK_BFF` : le BFF réel interroge l'API tabulaire (`TABULAR_API_BASE`, défaut `https://tabular-api.data.gouv.fr/api`), avec un limiteur (4 requêtes simultanées, 10 par seconde) et un cache mémoire. Une source en panne sans valeur en cache donne 503 avec `Retry-After: 60`. Le journal indique, par requête, le nombre d'appels à la source.

### Identifiants de ressources à confirmer

Les `rid` par défaut (`src/server/source/ressources.ts`), les noms de colonnes de Datan (`src/server/source/colonnes.ts`) et les couleurs des groupes (`src/server/groupes.ts`) sont **provisoires** : le prompt 00 n'a pas pu joindre data.gouv.fr. Les valeurs par défaut sont celles du faux serveur de test (`testing/univers.mjs`) ; sur la vraie source, elles ne correspondent à aucune ressource. Tant qu'elles ne sont pas confirmées, il faut surcharger `RID_SCRUTINS`, `RID_VOTES`, `RID_DEPUTES`, `RID_DATAN_DEPUTES` et `RID_DATAN_GROUPES`, puis exécuter le prompt 00 pour vérifier les colonnes Datan et reporter les valeurs dans `docs/API.md`. `RID_DATAN_GROUPES` n'est pas encore lu par le BFF.

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

- Budgets `angular.json` en erreur : initial ≤ 500 Ko brut (150 Ko visé en transfert gzip), styles par composant ≤ 4 Ko.
- `outputHashing: bundles` en production : les polices gardent un nom stable, pour que le préchargement de `index.html` (`/media/zen-maru-gothic-latin-500-normal.woff2`) corresponde au fichier réellement chargé. À vérifier après chaque changement de build.

## Données et chargement

- Une page n'appelle jamais `fetch` ni `HttpClient` directement : elle injecte un service de `src/app/data/` (`AccueilApi`, `LoiApi`, `ScrutinApi`, `DeputeApi`), qui renvoie une `httpResource` typée par `@contrat`. La page lit `value()`, `isLoading()`, `error()`, et reporte l'erreur sur le statut HTTP du rendu serveur avec `statutDePage(ressource)` (404 ou 503).
- Les services ne s'abonnent jamais à la main. Une URL dépend d'un `Signal` ; tant qu'il vaut `undefined`, aucune requête n'est lancée. Les paramètres sont encodés avec `encodeURIComponent`.
- Côté serveur, `serverApiInterceptor` (fourni seulement par `app.config.server.ts`, comme intercepteur racine) exécute `/api/*` en mémoire via `APPELER_BFF`, sans réseau. Comme intercepteur racine, il passe sous le cache de transfert HTTP, qui transmet ensuite les données au navigateur : pas de seconde requête à l'hydratation. Un intercepteur ordinaire qui court-circuite la requête empêche ce cache de voir la réponse.
- `format.ts` fournit les formats partagés (`pourcent`, `dateCourte`, `dateLongue`, `normaliser`, `libellePosition`). Les dates s'affichent dans le fuseau `Europe/Paris`.
- Hydratation : `@defer (on viewport; hydrate on viewport)` pour ce qui est sous la ligne de flottaison. La liste nominative est `@defer (on interaction)` **sans** `hydrate` : `hydrate` ferait rendre la liste entière côté serveur, alors que le bouton « Voir comment chaque député a voté » doit être dans le HTML et la requête ne partir qu'au clic. Chaque `@defer` a son `@placeholder` de hauteur fixe.
- Pré-chargement : `ViewportPreloadingStrategy` charge le code d'une route quand un `a[routerLink]` qui y mène entre dans l'écran (`AppLienVisible`). `appPrefetch="/api/…"` précharge les données au survol, au focus ou au toucher, par un seul `fetch` de priorité basse. Rien ne se précharge avec l'économiseur de données (`saveData`) ; le code d'une route ne se précharge pas non plus en 2g.

## Textes

Tous les textes de l'interface et de la documentation sont en français, ainsi que les messages de commit.

## Serveur et déploiement

- **Umami** (`umami.ts`) : le script (`defer`, `data-website-id`) est ajouté avant `</head>` seulement si `UMAMI_WEBSITE_ID` est défini ; `UMAMI_SRC` doit être en https. Pas de cookie.
- **Sécurité** (`en-tetes.ts`, posé par `server.ts`) : sur chaque réponse, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Les pages HTML ont en plus leur CSP : `script-src` autorise, pour _cette_ page, l'empreinte (sha256) de chacun de ses scripts en ligne. Angular en génère qui changent d'une page à l'autre (`ng-event-dispatch-contract`, `__jsaction_bootstrap` avec la liste des événements), donc pas de liste d'empreintes figée au démarrage. Pas de `unsafe-inline` pour les scripts. Umami n'est autorisé que s'il est configuré.
- **Cache** : une page rendue en 200 est `public, s-maxage=600, stale-while-revalidate=86400` ; une indisponibilité (503) ou une redirection est `no-store` (`cacheControlPage`). Les fichiers du build sont `public, max-age=31536000, immutable`.
- **Indisponibilité** : une page de données dont la source est en panne répond 503 (`statutDePage`), `/a-propos` reste 200 (pré-rendue).
- **SEO** : `/robots.txt` autorise tout et pointe vers le sitemap ; `/sitemap.xml` (`seo.ts`) liste l'accueil, les députés, les lois récentes et les députés actifs, tirés en une requête `/api/deputes`, gardés un jour en mémoire.
- **Vercel** : `vercel.json` ne déclare aucune sortie statique : la fonction `api/index.mjs` (qui réexporte `reqHandler`) sert tout, y compris les fichiers du build (`includeFiles: dist/lois-votes/**`). Le préréglage Angular n'a pas été vérifié.

## Tests e2e

- `playwright.config.ts` lance cinq serveurs : le faux serveur sain sur 4010 et celui qui répond 500 sur 4011 (`FAUX_ERREUR=500`) ; le site normal sur 4000 (`TABULAR_API_BASE` sur 4010, sans Umami), le site « panne » sur 4001 (sur 4011), le site Umami sur 4002 (`UMAMI_WEBSITE_ID=site-de-test`, sur 4010). Les specs `degradation` et `umami` visent ces ports.
- Le jeu de données est `src/server/testing/univers.mjs` ; `e2e/faux-tabulaire.mjs` le sert en HTTP (`demarrer({ port, erreur })`).
- Chromium : `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/chrome npm run e2e`. Le rendu du texte est épinglé par `--font-render-hinting=none`.
- `e2e/accessibilite.spec.ts` passe axe (WCAG 2.2 AA) sur chaque page, en Jour et en Nuit.
