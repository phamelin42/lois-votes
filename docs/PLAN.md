# Qui a voté quoi ? (quiavotequi.phamelin.fr) : plan (v2)

## Contexte

Site public pour voir **quel parti a voté quoi pour une loi**. On y trouve les dernières lois votées à l'Assemblée avec les pour, contre et abstentions, une page par loi, une page par député, et une recherche. Contraintes de l'utilisateur :
- utiliser **Fuda** (`phamelin42/design-system-fuda`), sans la modifier ;
- **ne rien stocker chez nous** : les données viennent d'une API publique appelée à chaque requête ;
- **fluide et rapide** : SSR, `@defer`, pré-chargement intelligent des pages suivantes ;
- très simple à utiliser.

Décisions prises :
- **Source : API REST v1 de NosParlementaires.fr** (`https://nosparlementaires.fr/api/v1`). Elle est dérivée chaque jour de l'open data de l'Assemblée, sous Licence Ouverte 2.0. Il faut une clé gratuite (en-tête `X-Api-Key`) et la limite est de **60 requêtes par minute**. L'Assemblée elle-même ne fournit que des archives zip (27 Mo), pas d'API qu'on peut interroger.
- **Angular SSR sur Vercel Hobby** (non commercial). Mesure d'audience **Umami** (sans cookie).
- **17ᵉ législature**. Les votes finaux sont mis en avant ; articles et amendements restent consultables dans la page d'une loi.
- **Pas de résumé inventé** : titre court en titre, titre officiel en résumé (2 lignes sur l'accueil).
- Formulation : « Adopté par l'Assemblée » / « Rejeté par l'Assemblée », jamais « loi adoptée ».
- Domaine : **`quiavotequi.phamelin.fr`**. Le nom affiché du site est « Qui a voté quoi ? » ; le dépôt reste `lois-votes`.

Dépôt : `phamelin42/lois-votes` (vide), branche `claude/bold-fermi-zihw5t`.

## Ce que l'API fournit (spec OpenAPI lue, `/api/v1/openapi.json`)

| Endpoint | Utilisation |
|---|---|
| `GET /deputies?group&departement&limit&offset` | Liste et index de recherche (606 députés de la 17ᵉ) |
| `GET /deputies/{slug}` | `full_name`, `group {id,label,short,color}`, `constituency_label`, `photo_url`, `stats {votes_participation_rate, group_loyalty_rate, …}` |
| `GET /deputies/{slug}/votes?legislature&date_min&position&limit&offset` | Votes d'un député, du plus récent au plus ancien |
| `GET /scrutins?chamber=an&legislature=17&limit&offset` | Scrutins du plus récent au plus ancien, `title`, `date`, `counts {pour,contre,abstention,nonvotant}` (+ `dossier_ref` d'après l'export) |
| `GET /scrutins/an/{id}/votes` | Positions individuelles : on en tire la ventilation par groupe |
| `GET /lois`, `GET /lois/{slug}` | `title`, `short_title`, `statut`, `dossier_ref`, `url` |
| `GET /groups?chamber=an` | Groupes et couleurs |

Ce qui reste **à vérifier dès qu'on a la clé** (étape 1) : la forme exacte de `/lois` et de `/scrutins/{id}/votes` (le groupe de chaque votant y est-il ?), les champs de pagination (présence d'un `total`), l'hôte des `photo_url`.

## Architecture

```
Navigateur ──► Vercel CDN (cache HTTP) ──► fonction SSR Angular (server.ts, Express)
                                             ├─ rend les pages (SSR + hydratation incrémentale)
                                             └─ /api/*  : BFF qui appelle NosParlementaires (clé côté serveur),
                                                          agrège, renvoie un JSON compact et l'en-tête Cache-Control
```

- **Rien en base, rien sur disque.** Le seul « stockage », c'est le cache HTTP du CDN et un petit cache mémoire (durée limitée) dans la fonction. Il est indispensable : la limite est de 60 requêtes par minute, et une page froide coûte de 2 à 12 appels.
- **La clé ne quitte jamais le serveur.** Après l'hydratation, le navigateur passe par `/api/*` (même origine, mis en cache par le CDN), jamais directement par NosParlementaires.
- **Une seule couche d'accès à la source** (`src/server/source/`) : changer de source (autre API, données officielles) ne touche ni le BFF ni les pages.

### Serveur : `src/server/`

- `source/nosparlementaires.ts` : client `fetch` typé, base `NP_API_BASE` (remplaçable par un faux serveur en test) et clé `NOSPARLEMENTAIRES_API_KEY`.
- `source/limiter.ts` : file d'attente de 50 requêtes par minute, fusion des requêtes identiques en vol, nouvel essai sur 429 selon `Retry-After`.
- `cache.ts` : cache mémoire LRU avec TTL et `stale-while-revalidate` : on renvoie la valeur périmée pendant qu'on la rafraîchit, et aussi quand l'API est en erreur.
- `classify.ts` : fonctions pures, testées. `classer(titre)` donne `final | motion | article | amendement | autre` (« l'ensemble du projet/de la proposition de loi… », « la motion de censure… »…) ; `ventilerParGroupe(votes)` donne pour chaque groupe pour/contre/abst/non-votant et sa position majoritaire ; `tauxAbstention(...)`.
- `routes.ts` (monté dans `server.ts`), chaque route renvoie un JSON prêt à afficher, avec son `Cache-Control` :

| Route BFF | Appels NosParlementaires (à froid) | `s-maxage` / `stale-while-revalidate` |
|---|---|---|
| `GET /api/accueil?page=` | `/scrutins` (pages de 500 jusqu'à trouver 10 votes finaux) + `/lois` + 10 × `/scrutins/an/{id}/votes` | 30 min / 1 jour |
| `GET /api/lois/:slug` | `/lois/{slug}` + scrutins du `dossier_ref` (depuis la liste en cache) + ventilation du vote final | 1 h / 1 jour |
| `GET /api/scrutins/:id` | `/scrutins/an/{id}` + `/votes` | 1 jour / 1 semaine (un scrutin passé ne change plus) |
| `GET /api/deputes` | `/deputies` (toutes les pages) + `/groups` : index compact pour la recherche | 6 h / 1 jour |
| `GET /api/deputes/:slug` | `/deputies/{slug}` + `/deputies/{slug}/votes` (depuis la date du 10ᵉ dernier vote final) + 2 comptages (abstention / total) | 1 h / 1 jour |

### Application : `src/app/` (mêmes conventions que Fuda)

Angular 22 : standalone, zoneless, signaux, `@if/@for`, `host: {}`, `inject()`, `templateUrl` + `styleUrl`, tokens Fuda uniquement, textes en français. `@angular/ssr` avec `outputMode: 'server'`.

**Pages :**

| Route | Contenu | Rendu |
|---|---|---|
| `/` | Les 10 dernières lois votées : carte `a[fdCard]` avec titre court, titre officiel sur 2 lignes, date, badge Adopté/Rejeté par l'Assemblée, barre pour/contre/abst et chiffres, pastilles des groupes (« RN Pour · LFI-NFP Contre… »). Bouton « Voir plus » (page suivante). | SSR |
| `/lois/:slug` | Titre, titre officiel, statut, lien vers le dossier de l'Assemblée. Vote final : résultat, barre, **tableau par groupe** (position majoritaire, pour/contre/abst/non-votants). Puis « Voir les députés » (liste nominative par groupe) et « Autres scrutins du texte » (articles, amendements). | SSR, le bas de page en `@defer` |
| `/scrutins/:id` | Un scrutin d'article ou d'amendement : décompte et tableau par groupe | SSR |
| `/deputes` | Liste avec filtres groupe et département | SSR |
| `/deputes/:slug` | **Photo**, nom, **parti** (pastille de couleur + libellé), circonscription. **Taux de participation aux scrutins** (`votes_participation_rate`) en guise de présence, nommé honnêtement : l'Assemblée ne publie pas la présence en séance ni en commission. **Taux d'abstention** sur la législature, loyauté au groupe. **Ses votes sur les 10 dernières lois** : loi, date, sa position, position de son groupe, résultat. | SSR |
| `/recherche?q=` | Résultats Lois / Députés (repli sans JS de la recherche) | SSR |
| `/a-propos` | Source (« Données : NosParlementaires.fr, d'après l'open data de l'Assemblée nationale »), licence, méthode, avertissement, Umami | pré-rendu |

**Recherche** (`app-search`, dans l'en-tête, partout) : combobox ARIA sur `fd-text-field`. L'index des députés (`/api/deputes`) et des lois récentes est chargé au premier focus, puis filtré sans accents ni casse. Choisir un député **ouvre directement son profil** ; Entrée sans choix ouvre `/recherche?q=`. C'est un formulaire GET classique, donc ça marche aussi sans JS.

**Composants de l'app** (`src/app/ui/`) : `app-vote-bar` (barre empilée `--tokiwa` / `--enji` / `--yamabuki` / `--surface-sunken`, chiffres écrits, `aria-label` complet), `app-group-table` (`<table>` sémantique, pastille `color` du groupe, défilable sur mobile), `app-group-pills`, `app-deputy-photo` (`NgOptimizedImage`, repli sur `fd-avatar` à initiales).
**Fuda utilisé** : `a[fdCard]`, `fd-badge`, `fd-text-field`, `fd-select`, `fd-chip`, `fd-tabs`, `fd-accordion`, `fd-breadcrumb`, `fd-avatar`, `fd-empty-state`, `fd-spinner`, `fd-alert` (API indisponible), `button[fdButton]`, `a[fdLink]`, `FdThemeService`.

### Chargement intelligent

1. **SSR + hydratation incrémentale** : `provideClientHydration(withIncrementalHydration(), withHttpTransferCacheOptions({ includeRequestsWithAuthHeaders: false }))`. Le HTML arrive complet, l'event replay est actif par défaut, et les données servies au rendu serveur ne sont pas redemandées à l'hydratation.
2. **Un même code de données côté serveur et navigateur** : les services utilisent `httpResource('/api/...')`. Côté serveur, un intercepteur (`server-api.interceptor.ts`, fourni seulement dans `app.config.server.ts`) répond aux URL `/api/*` en appelant directement le BFF, sans aller-retour réseau. Le transfert vers le navigateur reste automatique.
3. **`@defer`** pour ce qui est sous la ligne de flottaison : `@defer (on viewport; hydrate on viewport)` pour les autres scrutins du texte et les pastilles des cartes ; `@defer (on interaction; hydrate on interaction)` pour la liste nominative. Chaque `@placeholder` a une hauteur fixe (pas de saut de mise en page, CLS ≈ 0).
4. **Pré-chargement des pages suivantes** : stratégie `ViewportPreloadingStrategy` maison (~40 lignes, à la manière de quicklink). Le code d'une route est chargé quand un lien vers elle entre dans l'écran, pendant `requestIdleCallback`, et jamais si `navigator.connection.saveData` est actif. Une directive `appPrefetch` sur les liens de carte, de loi et de député précharge aussi la **donnée** au survol ou au focus (`fetch` de priorité basse vers `/api/...`, servi ensuite par le cache HTTP du navigateur).
5. **Routes paresseuses** (`loadComponent`) et `withViewTransitions()` pour des transitions douces (désactivées en mouvement réduit).
6. **Images** : `NgOptimizedImage` avec dimensions fixes, `priority` sur la photo du profil, `loading="lazy"` ailleurs, `preconnect` vers l'hôte des photos.
7. **Légèreté** : seulement les 3 polices latines de Fuda (pas `fonts.css` qui charge aussi le japonais), avec preload ; pas de bibliothèque de graphiques (barres en CSS) ; budgets `angular.json` bloquants (initial ≤ 150 Ko brut, ~50 Ko gzip) ; objectif Lighthouse mobile ≥ 95.
8. **Thème** : `FdThemeService` fonctionne en SSR (accès à `localStorage` protégés). Pour éviter un flash clair chez qui a choisi Nuit, un script en ligne de 3 lignes dans `index.html` pose `data-theme` avant le premier rendu.

### Robustesse face à la limite de 60 requêtes/min

- Le cache du CDN absorbe l'essentiel : une page n'appelle l'API qu'une fois par période de cache, quel que soit le nombre de visiteurs.
- Cache mémoire et fusion des requêtes, plus la file de 50 requêtes/min, côté fonction.
- En cas de 429 ou d'erreur : contenu périmé servi s'il existe, sinon page dégradée avec `fd-alert` (« Données momentanément indisponibles ») et code 503 + `Retry-After` (le CDN ne le met pas en cache).
- `robots.txt` raisonnable ; si l'audience grandit, demander une limite plus haute à NosParlementaires.

## Structure du dépôt

```
CLAUDE.md, README.md           conventions et commandes (français)
angular.json, package.json, tsconfig*.json, eslint.config.js, vercel.json
src/server.ts                  Express de @angular/ssr/node + routes BFF
src/server/                    source/, cache.ts, classify.ts, routes.ts (+ specs, fixtures/ réelles réduites)
src/app/                       app.config(.server).ts, app.routes(.server).ts, shell/, pages/<page>/, ui/, data/ (types, services httpResource, intercepteur, préchargement)
src/styles.scss                Fuda + polices latines + mise en page
e2e/                           Playwright contre le build SSR branché sur un faux serveur NosParlementaires (fixtures)
.github/workflows/ci.yml       lint, typecheck, test, build, e2e (sans clé, grâce au faux serveur)
```

Dépendances : `fuda` épinglée sur un commit (`github:phamelin42/design-system-fuda#<sha>`), `@angular/cdk`, `@fontsource/*`, `@angular/ssr`, `express`. Node ≥ 22.22.3.

**Déploiement** : intégration Git de Vercel (aperçu par PR, production sur `main`), préréglage Angular SSR. Si le préréglage ne prend pas Angular 22 en charge, on passe par un `api/index.mjs` qui exporte le `reqHandler` d'Angular, plus une réécriture dans `vercel.json`. Variables Vercel : `NOSPARLEMENTAIRES_API_KEY` (obligatoire), `UMAMI_WEBSITE_ID` (facultative : le script Umami n'est ajouté que si elle existe). Domaine : `quiavotequi.phamelin.fr`, avec un enregistrement CNAME `quiavotequi` → `cname.vercel-dns.com` chez le registraire de `phamelin.fr`, et le domaine ajouté au projet Vercel.

## Étapes

1. **Exploration avec la clé** (fournie par l'utilisateur) : enregistrer des réponses réelles de chaque endpoint dans `src/server/fixtures/`, confirmer leur forme et la pagination, ajuster le tableau des appels.
2. Squelette Angular 22 SSR, ESLint, Vitest, Fuda depuis git, styles, polices, `CLAUDE.md`.
3. Serveur : client, file d'attente, cache, `classify` (TDD sur les fixtures), routes BFF.
4. Données côté app : types, services `httpResource`, intercepteur serveur, préchargement des routes et des données.
5. Shell (en-tête avec recherche, bascule Jour/Nuit, pied avec la source), accueil, `app-vote-bar`, `app-group-table`.
6. Pages loi, scrutin, députés (liste et profil), recherche, à propos.
7. Umami, `vercel.json` (en-têtes), CI, README (créer la clé, variables Vercel, domaine).
8. Commit et push sur `claude/bold-fermi-zihw5t` (pas de PR sans demande).

## Vérification

- `npm run lint`, `npm run typecheck`, `npm test` verts : `classer` sur de vrais titres, ventilation par groupe dont la somme égale les `counts` du scrutin, taux d'abstention, cache (TTL, valeur périmée sur erreur), file d'attente (jamais plus de 50 requêtes/min, 429 relancé), composants (ARIA de la barre et du combobox).
- `npm run build` : budgets respectés, serveur SSR produit.
- Avec la vraie clé en local : accueil → loi → député. Contrôle croisé d'un vote final avec la page officielle de l'Assemblée (totaux et position de 2 groupes). Compter les appels à l'API pour une page froide puis chaude (0 en chaud).
- Playwright sur le build SSR + faux serveur : page servie complète avec JS désactivé ; pas de nouvelle requête `/api` à l'hydratation ; la recherche d'un député ouvre son profil ; chunk et donnée préchargés au survol ; axe sans violation en Jour et Nuit ; clavier.
- Lighthouse mobile sur `/`, `/lois/:slug`, `/deputes/:slug` (objectif ≥ 95, LCP < 2 s, CLS < 0,05).

## Prérequis côté utilisateur

- Demander la clé gratuite sur https://nosparlementaires.fr/donnees-ouvertes (formulaire avec ton e-mail : je ne le fais pas à ta place) et me la transmettre comme variable d'environnement (pas dans le dépôt).
- Créer le projet Vercel relié au dépôt et y mettre la clé.

## Constats tirés des exports publics de NosParlementaires (sans clé, 16/10/2026)

Les exports `https://nosparlementaires.fr/opendata/*.json` ont probablement la même forme que les réponses de l'API. À confirmer à l'étape 0.

- `scrutins_an.json` (8 806 lignes) : `{ id: "VTANR5L17V1", date: "2024-10-07T22:00:00+00:00", title, dossier_ref: "DLR5L17N50557" | null, pour, contre, abstention, nonvotant }`. **Aucun champ « adopté / rejeté ».**
- `votes_an.json.gz` (1,3 M lignes) : `{ scrutin_id, deputy_slug, position: "POUR" | "CONTRE" | "ABSTENTION" | "NONVOTANT" }`. **Aucun groupe sur la ligne** : il faut joindre avec l'index des députés.
- `deputes.json` : `{ slug, first_name, last_name, full_name, group_short, group_label, constituency_label: "Rhône (7)", department_code, active }`. On y trouve 574 députés actifs dans 12 groupes : RN 121, EPR 90, LFI-NFP 70, SOC 68, DR 47, ECOS 38, DEM 37, HOR 35, LIOT 23, UDDPLR 17, GDR 17, NI 11.

Conséquences pour l'implémentation :
1. **Adopté ou rejeté se calcule** (`classify.ts`, `estAdopte`). Cas général : majorité des suffrages exprimés, soit `pour > contre` (les abstentions ne comptent pas). **Motion de censure** : adoptée seulement si `pour >= 289`, la majorité absolue des membres (seuls les pour sont comptés). Valider la règle sur un échantillon en la comparant au champ `sort.code` des données officielles de l'Assemblée (archive `Scrutins.json.zip`, utilisée seulement pour ce test, jamais par le site).
2. **Ventilation par groupe** : de préférence `GET /votes?chamber=an&group=…` (le groupe y est « celui de l'élu à la date du scrutin »). À défaut, joindre `/scrutins/an/{id}/votes` au groupe actuel des députés, en sachant que ce sera faux pour ceux qui ont changé de groupe. L'étape 0 tranche.
3. **Identifiant de scrutin** : `VTANR5L17V<numero>`. Les URL du site utilisent le numéro (`/scrutins/8317`).
4. **Lien officiel d'un scrutin** : `https://www.assemblee-nationale.fr/dyn/17/scrutins/<numero>`. Photos officielles (à vérifier par rapport à `photo_url`) : `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/<id sans PA>.jpg`.

Le contrat entre le serveur (BFF) et l'application est dans [CONTRAT.md](CONTRAT.md). Les prompts des sous-agents sont dans [prompts/](prompts/README.md).
