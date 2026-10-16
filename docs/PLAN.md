# Qui a voté quoi ? (quiavotequi.phamelin.fr) : plan

## Contexte

Site public pour voir **quel parti a voté quoi pour une loi**. On y trouve les dernières lois votées à l'Assemblée avec les pour, contre et abstentions, une page par loi, une page par député, et une recherche. Contraintes :
- utiliser **Fuda** (`phamelin42/design-system-fuda`), sans la modifier ;
- **ne rien stocker chez nous** : les données viennent d'une API publique appelée à la demande ;
- **aucune clé API** ;
- **fluide et rapide** : SSR, `@defer`, pré-chargement intelligent des pages suivantes ;
- très simple à utiliser.

Décisions :
- **Source : l'API tabulaire de data.gouv.fr** (`https://tabular-api.data.gouv.fr/api`) : officielle, publique, sans clé, en lecture seule. Elle filtre et trie les fichiers CSV publiés sur data.gouv.fr (NosParlementaires et Datan, dérivés chaque jour de l'open data de l'Assemblée, Licence Ouverte 2.0). L'Assemblée elle-même ne publie que des archives zip, pas d'API. *L'API REST de NosParlementaires, envisagée un temps, est abandonnée parce qu'elle demande une clé.*
- **Angular 22 SSR sur Vercel Hobby** (non commercial). Mesure d'audience **Umami** (sans cookie).
- **17ᵉ législature**. Les votes finaux (vote sur l'ensemble d'un texte) sont mis en avant ; articles et amendements restent consultables dans la page d'une loi.
- **Pas de résumé inventé** : titre court dérivé du scrutin final en titre, titre officiel du scrutin en résumé (2 lignes sur l'accueil).
- Formulation : « Adopté par l'Assemblée » / « Rejeté par l'Assemblée », jamais « loi adoptée ». « Participation aux scrutins », jamais « présence » : l'Assemblée ne publie pas la présence en séance ni en commission.
- Domaine **`quiavotequi.phamelin.fr`**, nom affiché « Qui a voté quoi ? », dépôt `lois-votes`.

## La source : API tabulaire de data.gouv.fr

D'après la documentation de data.gouv.fr et le README de `datagouv/api-tabular` :
- `GET /api/resources/{rid}/data/?<colonne>__exact=…&<colonne>__sort=desc&page=1&page_size=…`
- Opérateurs : `__exact`, `__differs`, `__isnull` / `__isnotnull`, `__contains`, `__notcontains`, `__in` / `__notin`, `__less` / `__greater`, `__sort=asc|desc`.
- Réponse : `{ data: [...], links: { next, prev }, meta: { page, page_size, total } }`. `meta.total` permet de **compter sans tout télécharger**.
- `page_size` vaut 20 par défaut ; le maximum (200 ?) est à confirmer. Fichiers jusqu'à 100 Mo (csv et csv.gz). Spec par ressource : `/api/resources/{rid}/swagger/`. Le `rid` est dans l'onglet « Métadonnées » de la ressource.
- **À établir par le prompt 00** : la limite de débit ; si les ressources visées sont traitées par l'API (en particulier les 1,3 M lignes de votes) ; le délai de rafraîchissement ; les noms et types exacts des colonnes.

### Ressources visées (à confirmer par le prompt 00)

| Besoin | Ressource candidate sur data.gouv.fr | Colonnes utiles |
|---|---|---|
| Scrutins | NosParlementaires `scrutins_an.csv` | `id` (`VTANR5L17V<n>`), `date`, `title`, `dossier_ref`, `pour`, `contre`, `abstention`, `nonvotant` |
| Votes individuels | NosParlementaires `votes_an.csv.gz` | `scrutin_id`, `deputy_slug`, `position` (`POUR`, `CONTRE`, `ABSTENTION`, `NONVOTANT`) |
| Députés | NosParlementaires `deputes.csv` | `slug`, `first_name`, `last_name`, `full_name`, `group_short`, `group_label`, `constituency_label`, `department_code`, `active` |
| Photo, participation, loyauté | Datan « Députés actifs de l'Assemblée nationale », quotidien | identifiant `PA…`, score de participation, score de loyauté |
| Couleurs des groupes | Datan « Groupes politiques actifs » s'il existe | sinon une table des 12 couleurs officielles dans le code (de la configuration, pas de la donnée) |

- **Photo** : `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/<numéro du PA>.jpg` (format vérifié : 200).
- **Jointure NosParlementaires ↔ Datan** : par nom, prénom et département ; le prompt 00 mesure le taux de correspondance.
- **Point de décision** : si l'API tabulaire ne sert pas les votes individuels, le prompt 00 s'arrête et le signale sans rien changer seul. **Repli** proposé à l'utilisateur : lire en mémoire les exports publics de NosParlementaires (`https://nosparlementaires.fr/opendata/`, sans clé, ~10 Mo, testés), avec la même couche `source/` et sans toucher aux pages.

### Constats tirés des exports publics (16/10/2026)

- `scrutins_an` : 8 806 lignes, `{ id, date: "2024-10-07T22:00:00+00:00", title, dossier_ref | null, pour, contre, abstention, nonvotant }`. **Aucun champ « adopté / rejeté ».**
- `votes_an` : 1 317 652 lignes, `{ scrutin_id, deputy_slug, position }`. **Aucun groupe sur la ligne** : il faut joindre avec l'index des députés (groupe actuel).
- `deputes` : 2 128 lignes, dont 574 actifs, en 12 groupes (RN 121, EPR 90, LFI-NFP 70, SOC 68, DR 47, ECOS 38, DEM 37, HOR 35, LIOT 23, UDDPLR 17, GDR 17, NI 11).

Conséquences :
1. **Adopté ou rejeté se calcule** (`estAdopte`). Cas général : majorité des suffrages exprimés, soit `pour > contre`. **Motion de censure** : adoptée seulement si `pour >= 289` (majorité absolue des membres). Le prompt 00 vérifie la règle sur au moins 200 scrutins par rapport au champ `sort.code` des données officielles (archive `Scrutins.json.zip`, utilisée pour ce test seulement).
2. **Ventilation par groupe** : votes du scrutin joints au groupe **actuel** du député. C'est faux pour les rares députés qui ont changé de groupe ; à signaler dans `/a-propos`, et à corriger si une ressource donne le groupe à la date du vote.
3. Identifiant de scrutin `VTANR5L17V<numero>` ; les URL du site utilisent le numéro (`/scrutins/8317`). Lien officiel : `https://www.assemblee-nationale.fr/dyn/17/scrutins/<numero>`.
4. **Identifiant de loi = `dossier_ref`** (`/lois/DLR5L17N54372`). Un texte peut avoir plusieurs votes sur l'ensemble (lectures successives) : le plus récent est le vote final affiché, les autres sont listés.

## Architecture

```
Navigateur ──► Vercel CDN (cache HTTP) ──► fonction SSR Angular (server.ts, Express)
                                             ├─ rend les pages (SSR + hydratation incrémentale)
                                             └─ /api/*  : BFF qui interroge l'API tabulaire,
                                                          agrège, renvoie un JSON compact et l'en-tête Cache-Control
```

- **Rien en base, rien sur disque.** Seulement le cache HTTP du CDN et un cache mémoire de durée limitée dans la fonction : moins d'appels à data.gouv.fr, des pages rapides.
- **Une seule couche d'accès à la source** (`src/server/source/`) : changer de source ne touche ni le BFF ni les pages.
- Le navigateur ne parle qu'à `/api/*` (même origine, cache CDN), jamais directement à data.gouv.fr.

### Serveur : `src/server/`

- `source/tabulaire.ts` : client `fetch` typé ; base `TABULAR_API_BASE` (remplaçable par un faux serveur en test) ; `rid` de chaque ressource dans `source/ressources.ts` ; pagination ; comptage par `meta.total`. Aucune clé.
- `source/limiter.ts` : au plus 4 requêtes simultanées et 10 par seconde (à ajuster selon la limite mesurée en 00) ; fusion des requêtes identiques en vol ; nouvel essai sur 429 ou 503 (`Retry-After`).
- `cache.ts` : LRU mémoire avec TTL et `stale-while-revalidate`. La valeur périmée est servie pendant le rafraîchissement, et aussi quand la source est en erreur.
- `classify.ts` (fonctions pures, testées) : `classer(titre)` → `final | motion | article | amendement | autre` ; `estAdopte(type, compte)` ; `ventilerParGroupe(votes, groupeDe)` ; `titreCourt(titre)` et `lecture(titre)` (« l'ensemble du projet de loi relatif à X (première lecture) » → « Projet de loi relatif à X », « première lecture ») ; `tauxAbstention`.
- `routes.ts` (monté dans `server.ts`) :

| Route BFF | Requêtes à froid | `s-maxage` / `stale-while-revalidate` |
|---|---|---|
| `GET /api/accueil?page=n` | scrutins `title__contains=l'ensemble&date__sort=desc&page_size=10` (1) + votes `scrutin_id__in=<10 ids>` (~29 pages de 200) + index des députés (en cache) | 30 min / 1 jour |
| `GET /api/lois/:dossier` | scrutins `dossier_ref__exact` (1-2) + votes du vote final (3) | 1 h / 1 jour |
| `GET /api/scrutins/:numero` | scrutin (1) + votes (3) | 1 jour / 1 semaine |
| `GET /api/deputes` | députés `active__exact=true` (3) + Datan (3) | 6 h / 1 jour |
| `GET /api/deputes/:slug` | député (1) + Datan (1) + votes `deputy_slug__exact&scrutin_id__in=<10 derniers finaux>` (1) + 2 comptages `meta.total` | 1 h / 1 jour |

Les formats échangés sont dans [CONTRAT.md](CONTRAT.md).

### Application : `src/app/` (mêmes conventions que Fuda)

Angular 22 : standalone, zoneless, signaux, `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl`, tokens Fuda uniquement, textes en français. `@angular/ssr` avec `outputMode: 'server'`.

| Route | Contenu | Rendu |
|---|---|---|
| `/` | Les 10 dernières lois votées : carte avec titre court, titre officiel sur 2 lignes, date, badge Adopté/Rejeté par l'Assemblée, barre pour/contre/abst et chiffres, pastilles des groupes. « Voir plus ». | SSR |
| `/lois/:dossier` | Titre, titre officiel, lecture, lien officiel. Vote final : résultat, barre, **tableau par groupe**. Puis autres lectures, « Voir comment chaque député a voté », et autres scrutins du texte (articles, amendements). | SSR, bas de page en `@defer` |
| `/scrutins/:numero` | Un scrutin : décompte, tableau par groupe, liste nominative | SSR |
| `/deputes` | Liste avec filtres groupe et département | SSR |
| `/deputes/:slug` | **Photo**, nom, **parti**, circonscription ; **participation aux scrutins**, **taux d'abstention**, vote avec son groupe ; **ses votes sur les 10 dernières lois** (sa position, celle de son groupe, résultat) | SSR |
| `/recherche?q=` | Résultats Lois / Députés ; un seul député trouvé → son profil | SSR |
| `/a-propos` | Source, licence, méthode, limites, Umami | pré-rendu |

Composants de l'app : `app-vote-bar`, `app-position`, `app-group-pill(s)`, `app-group-table`, `app-loi-card`, `app-deputy-photo`, `app-search` (combobox ; choisir un député ouvre son profil).
Fuda : `a[fdCard]`, `fd-badge`, `fd-text-field`, `fd-select`, `fd-chip`, `fd-tabs`, `fd-accordion`, `fd-breadcrumb`, `fd-avatar`, `fd-empty-state`, `fd-spinner`, `fd-alert`, `button[fdButton]`, `button[fdIconButton]`, `a[fdLink]`, `FdThemeService`.

### Chargement intelligent

1. SSR + `withIncrementalHydration()` + cache de transfert HTTP : pas de double requête à l'hydratation.
2. Services `httpResource('/api/...')`. Côté serveur, un intercepteur exécute `/api/*` en mémoire (`appelerBff`), sans aller-retour réseau.
3. `@defer (on viewport; hydrate on viewport)` sous la ligne de flottaison, `@defer (on interaction; hydrate on interaction)` pour la liste nominative ; placeholders de hauteur fixe.
4. Pré-chargement : code des routes quand un lien devient visible (stratégie maison à la manière de quicklink, rien en `saveData`) ; données au survol ou au focus (`appPrefetch`, `fetch` de priorité basse).
5. `loadComponent` partout, `withViewTransitions()` (coupé en mouvement réduit).
6. `NgOptimizedImage` (photo du profil en `priority`), `preconnect` vers l'hôte des photos.
7. Polices latines de Fuda seulement ; barres en CSS ; budgets bloquants (initial ≤ 150 Ko brut) ; Lighthouse mobile ≥ 95.
8. Script de thème en ligne dans `index.html` (pas de flash pour qui a choisi Nuit).

### Robustesse

Cache CDN et mémoire, fusion des requêtes, limiteur. Sur erreur : valeur périmée si elle existe, sinon `fd-alert` et statut 503 + `Retry-After` (non mis en cache).

## Structure du dépôt

```
CLAUDE.md, README.md, angular.json, package.json, tsconfig*.json, eslint.config.js, vercel.json
src/server.ts                  Express de @angular/ssr/node + routes BFF
src/server/                    source/ (tabulaire, ressources, limiter), cache.ts, classify.ts, routes.ts, fixtures/
src/shared/contrat.ts          types du contrat
src/app/                       config, routes, shell/, pages/, ui/, data/
e2e/                           Playwright + faux serveur tabulaire
docs/                          PLAN.md, CONTRAT.md, API.md (prompt 00), prompts/
```

Mise en ligne : intégration Git de Vercel. Variables facultatives `UMAMI_WEBSITE_ID` et `UMAMI_SRC`. Domaine : CNAME `quiavotequi` → `cname.vercel-dns.com` chez le registraire de `phamelin.fr`.

## Prérequis côté utilisateur

- Créer le projet Vercel relié au dépôt (variables Umami facultatives).
- Ajouter le domaine `quiavotequi.phamelin.fr` au projet et créer le CNAME.

Les prompts des sous-agents sont dans [prompts/](prompts/README.md).
