# Prompt 03 : couche données de l'application et chargement intelligent

Branche : `lv/03-donnees`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion de 01**. Elle tourne en parallèle de 02 et 04.

## Contexte commun

Tu travailles sur le dépôt `phamelin42/lois-votes`, le site « Qui a voté quoi ? » (`quiavotequi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature).

Avant tout, lis :
- `docs/PLAN.md` : décisions, architecture, constats sur les données ;
- `docs/CONTRAT.md` : les types échangés entre le serveur (`/api/*`) et l'application ;
- `CLAUDE.md` à la racine s'il existe (créé par le prompt 01) ;
- les conventions de Fuda, `CLAUDE.md` du dépôt `phamelin42/design-system-fuda`.

Règles :
- Angular 22 : standalone, zoneless, signaux (`input()`, `computed()`, `httpResource()`…), `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl` séparés, `ViewEncapsulation.None` avec classes BEM préfixées `app-`, tokens Fuda uniquement (aucune couleur, durée ni espacement en dur).
- Français pour les libellés, la documentation et les messages de commit.
- Node ≥ 22.22.3. Si `node --version` est plus ancien, télécharge Node 24 depuis nodejs.org, vérifie-le avec `SHASUMS256.txt` et mets-le en tête du `PATH`.
- Ne modifie pas Fuda. Ne versionne jamais la clé API (`NOSPARLEMENTAIRES_API_KEY` vient de l'environnement).
- Ne change pas le contrat sans mettre à jour `docs/CONTRAT.md` et `src/shared/contrat.ts` ensemble, et sans le signaler dans ton rapport.
- Terminé = `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` verts (sauf mention contraire du prompt). Ne déclare rien de vert sans l'avoir lancé.
- Commits en français, push sur ta branche (`git push -u origin <branche>`). Pas de pull request.
- Rapport final : ce qui est fait, ce qui ne l'est pas et pourquoi, sortie résumée des vérifications, écarts par rapport au plan.

## Objectif

Donner aux pages un accès aux données simple, partagé entre serveur et navigateur, sans double requête à l'hydratation, et rendre la navigation **instantanée** : SSR, hydratation incrémentale, pré-chargement du code et des données. Travaille contre le BFF factice (`MOCK_BFF=1`, prompt 01).

## Travail

1. **Configuration** (`app.config.ts`) :
   - `provideClientHydration(withIncrementalHydration(), withHttpTransferCacheOptions({ includePostRequests: false }))` (l'event replay est inclus) ;
   - `provideHttpClient(withFetch(), withInterceptors([...]))` ;
   - `provideRouter(routes, withViewTransitions({ skipInitialTransition: true }), withPreloading(ViewportPreloadingStrategy), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))`. Désactive les transitions de vue si `prefers-reduced-motion: reduce`.
2. **Services** (`src/app/data/`), un par ressource, tous en `httpResource` typé par `@contrat` : `AccueilApi.page(page: Signal<number>)`, `LoiApi.detail(slug)`, `ScrutinApi.detail(numero)`, `DeputeApi.liste()` et `.detail(slug)`. Ils renvoient la ressource (`value`, `isLoading`, `error`, `status`) ; jamais d'abonnement manuel.
3. **Intercepteur serveur** (`server-api.interceptor.ts`, fourni seulement dans `app.config.server.ts`) : pendant le SSR, une requête vers `/api/...` n'est pas envoyée sur le réseau. Elle est exécutée par `appelerBff(url)` de `src/server/routes.ts` (le prompt 02 l'écrit ; en attendant, crée l'export dans le mode factice avec la même signature : `(url: string) => Promise<{ status: number; headers: Record<string,string>; body: unknown }>`). La réponse devient une `HttpResponse`, ce qui garde le cache de transfert automatique.
4. **Statut HTTP du SSR** : une page dont la ressource renvoie 404 répond 404 au navigateur, et une 503 répond 503 (via `RESPONSE_INIT` ou l'équivalent d'Angular 22). Fournis un utilitaire `statutDePage(resource)` réutilisable par les pages.
5. **Pré-chargement du code** (`viewport-preloading.strategy.ts`, environ 40 lignes) : une route paresseuse est préchargée quand un `routerLink` qui y mène entre dans l'écran (`IntersectionObserver`, puis `requestIdleCallback` avec repli `setTimeout`). Pas de préchargement si `navigator.connection?.saveData` est vrai ou si la connexion est en `2g`. Directive `appLienVisible` posée automatiquement : un sélecteur `a[routerLink]` qui s'enregistre auprès de la stratégie.
6. **Pré-chargement des données** (directive `appPrefetch`, entrée `appPrefetch="/api/lois/xyz"`) : au premier `pointerenter`, `focus` ou `touchstart`, un seul `fetch(url, { priority: 'low' })` alimente le cache HTTP du navigateur (le BFF envoie `Cache-Control`). Rien côté serveur, rien si `saveData`.
7. **Utilitaires** (`src/app/data/format.ts`) : `pourcent(0.734) → « 73 % »`, `dateCourte`, `dateLongue` (`fr-FR`, fuseau `Europe/Paris`), `normaliser(texte)` (minuscules, sans accents, pour la recherche), `libellePosition(position)` (« Pour », « Contre », « Abstention », « Non-votant », « Partagé »).
8. Mets à jour `CLAUDE.md` (section « Données et chargement ») : comment une page obtient ses données, et quand utiliser `@defer (on viewport; hydrate on viewport)` ou `(on interaction; hydrate on interaction)`.

## Tests

- Specs Vitest : les services appellent la bonne URL ; l'intercepteur serveur court-circuite `/api` et laisse passer le reste ; la stratégie ne précharge rien avec `saveData` et précharge quand un lien devient visible (`IntersectionObserver` simulé) ; `appPrefetch` ne fait qu'un `fetch` ; les fonctions de `format.ts`.
- Vérification manuelle avec `MOCK_BFF=1 npm run serve:ssr` dans Chromium (Playwright, `executablePath` vers `/opt/pw-browsers` si besoin) : le HTML de `/` contient les données ; après hydratation, l'onglet réseau ne montre **aucune** requête `/api/accueil` ; survoler un lien déclenche le chunk et le `fetch` de données.

## Terminé quand

Les 4 commandes sont vertes et les vérifications manuelles sont résumées dans le rapport.
