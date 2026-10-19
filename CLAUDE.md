# Qui a voté quoi ? : instructions pour l'agent

Site public (`quiavotequoi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature). Source de vérité des choix : [docs/PLAN.md](docs/PLAN.md). Formats échangés : [docs/CONTRAT.md](docs/CONTRAT.md) (recopié dans `src/shared/contrat.ts`). Format de `data/` : [docs/DONNEES.md](docs/DONNEES.md).

## Règle de base

**Données officielles préparées au build.** Rien n'est stocké chez nous : pas de base, aucune clé API, aucune requête externe à l'exécution. `npm run build` télécharge les archives officielles de l'Assemblée nationale (data.assemblee-nationale.fr, Licence Ouverte 2.0), les réduit dans `data/` (`scripts/donnees/`) puis copie `data/` dans `dist/lois-votes/data/`. **Seule exception à « officiel »** : le lien vers la page Wikipédia d'un député vient de Wikidata (communautaire, non officiel), interrogé une fois pendant `npm run donnees` ; s'il ne répond pas, le build continue sans ces liens (`meta.avertissements`). Le serveur lit ce dossier au démarrage et répond à toute `/api/*` depuis la mémoire. Le navigateur ne parle qu'à notre serveur (et charge les photos du site de l'Assemblée). Un workflow GitHub redéploie le site chaque nuit pour renouveler les données.

## Commandes

Node ≥ 22.22.3 (`.nvmrc` : 24).

| Commande                          | Rôle                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`                       | `build:fixtures`, puis serveur SSR sur le port 4000 (jeu de test, aucun réseau)                                                                          |
| `npm run build`                   | Télécharge les archives officielles (et les liens Wikipédia de Wikidata), écrit `data/`, build de production, copie `data/` dans `dist/lois-votes/data/` |
| `npm run build:fixtures`          | Comme `build`, avec `DONNEES_DEPUIS=fixtures` (mini-jeu `src/server/fixtures/officiel/`) : tests, e2e, CI                                                |
| `npm run donnees`                 | Archives officielles vers `data/` seulement (`DONNEES_DEPUIS=fixtures` : jeu de test)                                                                    |
| `npm run serve:ssr`               | Lance le serveur SSR déjà construit (`DONNEES_DIR=/chemin/data` pour d'autres données)                                                                   |
| `npm test`                        | Tests unitaires (Vitest via `ng test`, jsdom), dont `scripts/` ; `DONNEES_DIR=data npm test` contrôle aussi un `data/` réel                              |
| `npm run lint`                    | ESLint (angular-eslint, règles Fuda adaptées au préfixe `app`)                                                                                           |
| `npm run typecheck`               | `tsc` sur l'application, le serveur et les specs                                                                                                         |
| `npm run format` / `format:check` | Prettier                                                                                                                                                 |
| `npm run e2e`                     | `build:fixtures`, puis Playwright contre trois instances SSR (voir « Tests e2e »)                                                                        |
| `npm run perf`                    | `build:fixtures`, puis Lighthouse mobile sur `/`, une loi et un député ; échoue sous 95 en performance ou accessibilité                                  |

Une tâche est terminée quand `lint`, `typecheck`, `test` et `build` sont verts, et que `npm run serve:ssr` sert les routes (`curl localhost:4000/api/accueil`). `e2e` s'exécute aussi quand une page, la navigation ou le serveur changent.

## Structure

- `src/main.ts`, `src/main.server.ts`, `src/server.ts` : entrées navigateur, serveur de rendu et Express (routes `/api/*`, `/robots.txt`, `/sitemap.xml`, en-têtes, Umami). `server.ts` charge les données au démarrage.
- `scripts/donnees/` : pipeline des données officielles (`index.mjs` orchestre, `telecharger.mjs`, `lire.mjs` (dont l'extraction de l'état civil, de la profession et des liens), `construire.mjs`, `wikipedia.mjs` (Wikidata), `ecrire.mjs`, `fixtures.mjs` pour regénérer le jeu de test) ; leurs specs tournent avec `npm test`. `scripts/copier-donnees.mjs` : dernière étape du build. `scripts/perf.mjs` : Lighthouse.
- `src/server/` : le serveur. `donnees.ts` (charge et valide `data/` sous forme compacte, mesure temps et mémoire), `agregation.ts` (calcule les types du contrat), `routes.ts` (routes `/api/*`, `Cache-Control`, erreurs), `bff.ts` (`appelerBffActif` : charge `data/` une fois, journal `[bff] url statut durée`), `donnees.types.ts` (types des fichiers de `data/`), `classify.ts` (réexporte `src/shared/classer.ts`), `umami.ts`, `seo.ts`, `en-tetes.ts` (fonctions pures : Umami, robots et sitemap, CSP et Cache-Control). `testing/` : aides de test (produit `data/` en mode fixtures). `fixtures/officiel/` : mini-jeu d'archives officielles réduites.
- `api/index.mjs`, `vercel.json` : déploiement Vercel (une fonction qui sert le serveur SSR et embarque `dist/lois-votes/**`, donc les données).
- `e2e/` : Playwright (`*.spec.ts`, `aide.ts`). `.github/workflows/` : `ci.yml` (qualité) et `actualiser.yml` (redéploiement nocturne).
- `src/app/` : application. `app.routes.ts` (routes chargées par `loadComponent`), `app.routes.server.ts` (rendu : serveur partout, `/a-propos` pré-rendue), `pages/<page>/` (un dossier par page).
- `src/shared/contrat.ts` : types du contrat, importés côté serveur et côté app avec l'alias `@contrat`. `src/shared/classer.ts` : classement des scrutins par titre, titre court et lecture (partagé avec `scripts/donnees/`). `src/shared/photo.ts` : `photoDe(pa)`, l'URL de la photo officielle (serveur et application).
- `src/index.html` : `lang="fr"`, précharge la police du texte (latin 500), script en ligne qui pose `data-theme="dark"` avant le rendu.
- `src/styles.scss` : Fuda (`fuda/styles/fuda.css`) et les polices latines seulement (Dela Gothic One 400, Zen Maru Gothic 500 et 700).

## Données et serveur

- **Dossier lu** : `DONNEES_DIR`, sinon `data/` à côté de `server/` dans le build (`dist/lois-votes/data/`). Il n'est jamais copié dans `browser/` (il ne doit pas être public).
- **Chargement** (`donnees.ts`) : les six fichiers sont lus et validés une fois (effectifs de `meta.json`, longueur de chaque ligne des matrices, caractères connus, somme des groupes = décompte du scrutin…). `scrutins.json` est réduit à des tableaux typés ; les matrices restent des tampons d'octets. Le journal indique durée et mémoire. **Données absentes ou invalides** : l'erreur est journalisée, le serveur démarre, toutes les routes `/api/*` répondent 503 `no-store` avec `Retry-After: 60` et les pages de données 503 ; `/a-propos` reste 200. Jamais de faux contenu.
- **Règles de calcul** (`agregation.ts`, détail dans DONNEES.md) : la position d'un groupe est celle de `scrutins.json` (calculée sur les décomptes), jamais la `positionMajoritaire` de l'archive ; un groupe sans aucun député listé n'est pas affiché ; la case `X` d'un député (en mandat, absent) donne `position: null` et compte dans le dénominateur de la participation ; `-` (pas en mandat) n'est jamais affiché. Les taux (participation, abstention, loyauté) sont calculés par nous et présentés comme tels. `ScrutinResume.enMandat` (cases ≠ `-` de la matrice, compté une fois au chargement) donne le nombre de députés en mandat : « ont voté » = pour + contre + abstention, « n'ont pas voté » = `enMandat` − votants (non-votants officiels `N` et absents `X`). `DeputeDetail.scrutins` répartit les scrutins en mandat d'un député (pour, contre, abstention, `nonVote` = `N` + `X`). `groupesSansVotant` (scrutin, vote final d'une loi) nomme les groupes de `groupes.json` en activité ce jour-là (`debut`/`fin` inclus) dont aucun député n'est listé. L'accueil montre une carte par dossier (son vote final le plus récent) ; les 10 derniers votes d'un député sont ses 10 derniers scrutins `final`.
- **Votes finaux sans dossier** (66 % des scrutins, dont 154 des 235 votes finaux) : l'accueil et la fiche d'un député les lient vers `/scrutins/:numero`, jamais vers une page de loi vide.
- **Groupes** : un groupe est identifié par son `id` officiel (`PO…`) et affiché par son `abrege`. Deux organes portent « UDR » : les filtres `?groupe=` de `/deputes` filtrent sur l'abrégé pour les confondre.
- **Photo** : `photoDe(pa)` (`src/shared/photo.ts`) = `…/dyn/static/tribun/17/photos/carre/<numéro SANS le préfixe PA>.jpg` (avec `PA`, 404 ; environ 47 Ko en moyenne). `DeputeIndex.pa` est ce numéro sans préfixe (pas d'URL de photo dans l'index, il doit rester petit). **Fiche** : `…/dyn/deputes/<PA>`.
- **Fiche d'un député** (`DeputeDetail`, détail dans DONNEES.md) : naissance (l'**âge est calculé à la requête**, date du jour à Paris, pas à la préparation des données), profession, mandat et législatures, historique des groupes (un groupe qu'aucun scrutin ne liste, « AD », est dans `meta.autresGroupes`), fonctions, parti de rattachement, `liens` (`assemblee`, `hatvp`, `wikipedia`, `siteWeb`, `x`, `facebook`). **Un lien absent vaut `null` et n'est pas affiché : jamais d'URL devinée.** **Jamais publiés** : téléphone, e-mail, adresse postale. Un lien externe s'ouvre avec `target="_blank"` et `rel="noopener noreferrer"`, annoncé « (nouvel onglet) » aux lecteurs d'écran. Wikipédia est dite « source communautaire et non officielle » (fiche et `/a-propos`).
- **Photos dans la liste `/deputes`** : `app-deputy-photo` (64 px, `loading="lazy"`, `decoding="async"`, dimensions fixes, repli sur les initiales si l'image échoue) ; son hôte réserve toujours la taille de la photo.
- Le `nom` d'un député peut contenir une précision d'homonyme (« Alexandra Martin (Gironde) ») : gardée pour l'affichage et le slug, retirée pour le tri (`nomTri`).

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
- Ne jamais écrire « loi adoptée » : « Adopté par l'Assemblée ». Écrire « participation aux scrutins », « ont voté » (pour + contre + abstention) et « n'ont pas voté » (en mandat sans avoir voté : non-votants officiels et absents) ; jamais « présence », « présents » ni « absents » : l'Assemblée ne publie pas la présence en séance (un député peut être présent sans voter, ou voter par délégation, et les mises au point ne sont pas appliquées).

## Budgets et polices

- Budgets `angular.json` en erreur : initial ≤ 500 Ko brut (150 Ko visé en transfert gzip), styles par composant ≤ 4 Ko.
- `outputHashing: bundles` en production : les polices gardent un nom stable, pour que le préchargement de `index.html` (`/media/zen-maru-gothic-latin-500-normal.woff2`) corresponde au fichier réellement chargé. À vérifier après chaque changement de build.

## Données et chargement

- Une page n'appelle jamais `fetch` ni `HttpClient` directement : elle injecte un service de `src/app/data/` (`AccueilApi`, `LoiApi`, `ScrutinApi`, `DeputeApi`), qui renvoie une `httpResource` typée par `@contrat`. La page lit `value()`, `isLoading()`, `error()`, et reporte l'erreur sur le statut HTTP du rendu serveur avec `statutDePage(ressource)` (404 ou 503).
- Les services ne s'abonnent jamais à la main. Une URL dépend d'un `Signal` ; tant qu'il vaut `undefined`, aucune requête n'est lancée. Les paramètres sont encodés avec `encodeURIComponent`.
- Côté serveur, `serverApiInterceptor` (fourni seulement par `app.config.server.ts`, comme intercepteur racine) exécute `/api/*` en mémoire via `APPELER_BFF` (le BFF de `bff.ts`), sans réseau. Comme intercepteur racine, il passe sous le cache de transfert HTTP, qui transmet ensuite les données au navigateur : pas de seconde requête à l'hydratation. Un intercepteur ordinaire qui court-circuite la requête empêche ce cache de voir la réponse.
- `format.ts` fournit les formats partagés (`pourcent`, `dateCourte`, `dateLongue`, `normaliser`, `libellePosition`). Les dates s'affichent dans le fuseau `Europe/Paris`.
- Hydratation : `@defer (on viewport; hydrate on viewport)` pour ce qui est sous la ligne de flottaison. La liste nominative est `@defer (on interaction)` **sans** `hydrate` : `hydrate` ferait rendre la liste entière côté serveur, alors que le bouton « Voir comment chaque député a voté » doit être dans le HTML et la requête ne partir qu'au clic. Chaque `@defer` a son `@placeholder` de hauteur fixe.
- Pré-chargement : `ViewportPreloadingStrategy` charge le code d'une route quand un `a[routerLink]` qui y mène entre dans l'écran (`AppLienVisible`). `appPrefetch="/api/…"` précharge les données au survol, au focus ou au toucher, par un seul `fetch` de priorité basse. Rien ne se précharge avec l'économiseur de données (`saveData`) ; le code d'une route ne se précharge pas non plus en 2g.

## Textes

Tous les textes de l'interface et de la documentation sont en français, ainsi que les messages de commit.

## Serveur et déploiement

- **Umami** (`umami.ts`) : le script (`defer`, `data-website-id`) est ajouté avant `</head>` seulement si `UMAMI_WEBSITE_ID` est défini ; `UMAMI_SRC` doit être en https. Pas de cookie.
- **Sécurité** (`en-tetes.ts`, posé par `server.ts`) : sur chaque réponse, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Les pages HTML ont en plus leur CSP : `script-src` autorise, pour _cette_ page, l'empreinte (sha256) de chacun de ses scripts en ligne. Angular en génère qui changent d'une page à l'autre (`ng-event-dispatch-contract`, `__jsaction_bootstrap` avec la liste des événements), donc pas de liste d'empreintes figée au démarrage. Pas de `unsafe-inline` pour les scripts. Umami n'est autorisé que s'il est configuré.
- **Cache** : une page rendue en 200 est `public, s-maxage=600, stale-while-revalidate=86400` ; une indisponibilité (503) ou une redirection est `no-store` (`cacheControlPage`). Les fichiers du build sont `public, max-age=31536000, immutable`.
- **Indisponibilité** : sans données valides, une page de données répond 503 (`statutDePage`), `/a-propos` reste 200 (pré-rendue).
- **SEO** : `/robots.txt` autorise tout et pointe vers le sitemap ; `/sitemap.xml` (`seo.ts`) liste l'accueil, les députés actifs et les textes qui ont un dossier, tirés de `/api/deputes` et calculés une fois par processus.
- **Vercel** : `vercel.json` ne déclare aucune sortie statique : la fonction `api/index.mjs` (qui réexporte `reqHandler`) sert tout, y compris les fichiers du build et les données (`includeFiles: dist/lois-votes/**`). `buildCommand: npm run build` télécharge les archives pendant le build (la documentation Vercel ne restreint pas l'accès sortant du build) ; si le téléchargement échoue, le build échoue et l'ancien déploiement reste en ligne. Limites vérifiées dans la documentation : fonction 250 Mo non compressés, 2 Go de mémoire en Hobby.
- **Mise à jour nocturne** : `actualiser.yml` appelle chaque jour à 05:30 UTC le Deploy Hook Vercel (`VERCEL_DEPLOY_HOOK_URL`, secret GitHub), qui relance le build. Gestes de l'utilisateur dans le README.

## Tests e2e

- `playwright.config.ts` lance trois instances du même build (`npm run build:fixtures`) : le site normal sur 4000, le site « sans données » sur 4001 (`DONNEES_DIR` vers un dossier inexistant : tout répond 503), le site Umami sur 4002 (`UMAMI_WEBSITE_ID=site-de-test`). Les specs `degradation` et `umami` visent ces ports. Aucun réseau externe.
- Le jeu de données est `src/server/fixtures/officiel/` : 19 scrutins réels, 97 députés, dont 10 cartes d'accueil (pas de page 2 : « Voir plus » n'est couvert que par les specs unitaires), les organes cités par leurs mandats, et `wikidata.json` (extrait réel de la réponse de Wikidata : aucun réseau en test). Les photos viennent du site de l'Assemblée : les e2e les servent eux-mêmes (`page.route`).
- Chromium : `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/chrome npm run e2e`. Le rendu du texte est épinglé par `--font-render-hinting=none`.
- `e2e/accessibilite.spec.ts` passe axe (WCAG 2.2 AA) sur chaque page, en Jour et en Nuit. `e2e/fiche-depute.spec.ts` couvre la fiche enrichie sans JavaScript (profil et liens de Sébastien Chenu), la liste avec photos et leur repli, et axe sur la fiche et la liste photos chargées.
