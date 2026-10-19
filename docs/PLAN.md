# Qui a voté quoi ? (quiavotequoi.phamelin.fr) : plan

## Contexte

Site public pour voir **quel parti a voté quoi pour une loi**. On y trouve les dernières lois votées à l'Assemblée avec les pour, contre et abstentions, une page par loi, une page par député, et une recherche. Contraintes :
- utiliser **Fuda** (`phamelin42/design-system-fuda`), sans la modifier ;
- **sources officielles uniquement** (Assemblée nationale), **aucune clé API**, aucune base de données ;
- **fluide et rapide** : SSR, `@defer`, pré-chargement intelligent des pages suivantes ;
- très simple à utiliser.

Décisions :
- **Source : l'open data officiel de l'Assemblée nationale** (`data.assemblee-nationale.fr`, Licence Ouverte 2.0), préparé **chaque nuit** (option A) : un script télécharge les archives officielles et les réduit en fichiers compacts, que le serveur charge en mémoire. Aucune requête externe à l'exécution. L'Assemblée ne propose pas d'API qu'on peut interroger, seulement ces archives quotidiennes. *Les pistes précédentes (API de NosParlementaires, API tabulaire de data.gouv.fr avec les jeux NosParlementaires et Datan) sont abandonnées : elles ne sont pas officielles, l'une demande une clé, l'autre ne sert pas les votes individuels.*
- **Angular 22 SSR sur Vercel Hobby** (non commercial). Mesure d'audience **Umami** (sans cookie).
- **17ᵉ législature**. Les votes finaux (vote sur l'ensemble d'un texte) sont mis en avant ; articles et amendements restent consultables dans la page d'une loi.
- **Pas de résumé inventé** : titre court dérivé du scrutin final en titre, titre officiel du scrutin en résumé (2 lignes sur l'accueil).
- Formulation : « Adopté par l'Assemblée » / « Rejeté par l'Assemblée », jamais « loi adoptée ». « Participation aux scrutins », jamais « présence » : l'Assemblée ne publie pas la présence en séance ni en commission.
- Domaine **`quiavotequoi.phamelin.fr`**, nom affiché « Qui a voté quoi ? », dépôt `lois-votes`.

## La source : archives officielles de l'Assemblée

| Archive | URL (`https://data.assemblee-nationale.fr/static/openData/repository/17/…`) | Taille |
|---|---|---|
| Scrutins | `loi/scrutins/Scrutins.json.zip` | 27,6 Mo ; 8 877 fichiers, 181 Mo décompressés ; régénérée chaque nuit (~04:25 GMT), ETag (le CDN sert parfois deux versions le même jour) |
| Acteurs, mandats, organes | `amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip` | 14 Mo ; acteurs, mandats, organes (groupes) |

Photos officielles : `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/<numéro du PA>.jpg`. Lien d'un scrutin : `https://www.assemblee-nationale.fr/dyn/17/scrutins/<numero>`.

Ce que contient un scrutin (`VTANR5L17V<numero>`) : `dateScrutin`, `titre`, `typeVote` (SPO, SPS, MOC), **`sort.code` (`adopté` / `rejeté`)**, `syntheseVote.decompte`, `objet.dossierLegislatif.dossierRef` (présent sur 3 051 scrutins sur 8 877), et `ventilationVotes.organe.groupes.groupe[]` : pour chaque groupe **au jour du vote**, `organeRef` (parfois `PO0`, voir DONNEES.md), `positionMajoritaire` (non utilisée : elle ne suit pas les votes), `decompteVoix`, et la liste nominative (`decompteNominatif` : `pours`, `contres`, `abstentions`, `nonVotants`, avec `acteurRef`). Quand un groupe n'a qu'un votant, la liste est un objet et non un tableau.

Constats (archive du 19/10/2026, vérifiés dans DONNEES.md) : 3 031 scrutins adoptés et 5 846 rejetés ; 652 votants, tous présents dans l'archive des acteurs ; 348 d'entre eux apparaissent dans plusieurs groupes (changements de groupe) ; 1 323 978 positions. Les absents ne figurent dans aucune liste : l'appartenance au mandat vient de l'archive des acteurs. Une matrice d'un caractère par votant et par scrutin pèse 5,8 Mo bruts (0,73 Mo compressés pour les votes, 0,03 Mo pour les groupes).

## Architecture (option A)

```
Build (Vercel ou local)  npm run donnees : télécharge les 2 archives, écrit data/ (fichiers compacts)
                         ng build : data/ est copié dans dist/lois-votes/data/
Exécution                serveur SSR : lit data/ au démarrage, tout en mémoire, aucune requête externe
Chaque nuit              GitHub Actions appelle le Deploy Hook Vercel (secret VERCEL_DEPLOY_HOOK_URL) vers 05:30 UTC
Téléchargement échoué    le build échoue : l'ancien déploiement reste en ligne
```

- **Rien en base.** `data/` est un produit de build, régénéré chaque nuit et jamais modifié à l'exécution ; il n'est pas versionné (`.gitignore`).
- **Mode `fixtures`** : `DONNEES_DEPUIS=fixtures npm run donnees` construit `data/` à partir d'un mini-jeu d'archives réelles réduites (`src/server/fixtures/officiel/`). C'est le mode des tests, des e2e et de la CI, qui ne dépendent donc pas du réseau.
- Le format des fichiers est dans [DONNEES.md](DONNEES.md), les formats de l'API interne dans [CONTRAT.md](CONTRAT.md).

### Pipeline : `scripts/donnees/`

- Téléchargement (ETag, échec si statut ≠ 200), dézippage en mémoire avec `fflate` (dépendance de dev), parsing, réduction, écriture dans `data/`.
- Garde-fous qui font échouer le build : au moins 8 000 scrutins, au moins 570 députés, aucun votant sans fiche, somme des groupes égale au décompte de chaque scrutin, `sort.code` toujours `adopté` ou `rejeté`, entrées de groupe `PO0` rattachables à un groupe (détail et autres contrôles dans DONNEES.md).
- Classement des scrutins (`classer`, dans `src/shared/classer.ts`, partagé avec le serveur) : `final` (« l'ensemble du… », « l'article unique… » quand le texte n'a pas d'autre article, apostrophes droites et typographiques), `motion` (« la motion de censure… »), `article`, `amendement`, `autre`. Titre court et lecture dérivés du titre (« l'ensemble du projet de loi relatif à X (première lecture) » → « Projet de loi relatif à X », « première lecture »).

### Serveur : `src/server/`

- `donnees.ts` : charge `data/` au démarrage et expose des accès en mémoire (aucun appel réseau).
- `agregation.ts` : calcule les réponses du contrat : accueil (10 derniers votes finaux, tri par date puis numéro décroissants, donc déterministe), loi (regroupement par dossier, lectures), scrutin (listes nominatives par groupe), député (10 derniers votes finaux, taux).
- **Taux calculés par nous** à partir des scrutins publics, et présentés comme tels : *participation* = votes exprimés (pour, contre, abstention) / scrutins où le député était membre ; *abstention* = abstentions / votes exprimés ; *loyauté* = votes alignés sur la position majoritaire de son groupe / votes exprimés.
- `routes.ts` : routes `/api/*`, `Cache-Control`, erreurs ; `cache.ts` ; `bff.ts` ; `classify.ts` (fonctions pures).

| Route BFF | Calcul | `s-maxage` / `stale-while-revalidate` |
|---|---|---|
| `GET /api/accueil?page=n` | tranche de la liste des votes finaux | 30 min / 1 jour |
| `GET /api/lois/:dossier` | scrutins du dossier | 1 h / 1 jour |
| `GET /api/scrutins/:numero` | un scrutin et ses listes nominatives | 1 jour / 1 semaine |
| `GET /api/deputes` | index des députés actifs | 6 h / 1 jour |
| `GET /api/deputes/:slug` | fiche, taux, 10 derniers votes finaux | 1 h / 1 jour |

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
| `/a-propos` | Source officielle, licence, méthode de calcul des taux, limites, mise à jour nocturne, Umami | pré-rendu |

Composants de l'app : `app-vote-bar`, `app-position`, `app-group-pill(s)`, `app-group-table`, `app-loi-card`, `app-deputy-photo`, `app-search` (combobox ; choisir un député ouvre son profil).
Fuda : `a[fdCard]`, `fd-badge`, `fd-text-field`, `fd-select`, `fd-chip`, `fd-tabs`, `fd-accordion`, `fd-breadcrumb`, `fd-avatar`, `fd-empty-state`, `fd-spinner`, `fd-alert`, `button[fdButton]`, `button[fdIconButton]`, `a[fdLink]`, `FdThemeService`.

### Chargement intelligent

1. SSR + `withIncrementalHydration()` + cache de transfert HTTP : pas de double requête à l'hydratation.
2. Services `httpResource('/api/...')`. Côté serveur, un intercepteur exécute `/api/*` en mémoire (`appelerBff`), sans aller-retour réseau.
3. `@defer (on viewport; hydrate on viewport)` sous la ligne de flottaison, `@defer (on interaction)` pour la liste nominative ; placeholders de hauteur fixe.
4. Pré-chargement : code des routes quand un lien devient visible (stratégie maison à la manière de quicklink, rien en `saveData`) ; données au survol ou au focus (`appPrefetch`, `fetch` de priorité basse).
5. `loadComponent` partout, `withViewTransitions()` (coupé en mouvement réduit).
6. `NgOptimizedImage` (photo du profil en `priority`), `preconnect` vers `www.assemblee-nationale.fr` pour les photos.
7. Polices latines de Fuda seulement ; barres en CSS ; budgets bloquants ; Lighthouse mobile ≥ 95.
8. Script de thème en ligne dans `index.html` (pas de flash pour qui a choisi Nuit).

### Robustesse

Données entièrement en mémoire : aucune dépendance externe à l'exécution. Un build dont les données sont invalides ou incomplètes échoue, et l'ancien déploiement reste servi. Cache CDN sur les réponses.

## Structure du dépôt

```
CLAUDE.md, README.md, angular.json, package.json, tsconfig*.json, eslint.config.js, vercel.json
scripts/donnees/               téléchargement et réduction des archives officielles
src/server.ts                  Express de @angular/ssr/node + routes BFF
src/server/                    donnees.ts, agregation.ts, routes.ts, bff.ts, cache.ts, classify.ts, fixtures/
src/shared/contrat.ts          types du contrat
src/app/                       config, routes, shell/, pages/, ui/, data/
e2e/                           Playwright (sur le jeu fixtures)
.github/workflows/             ci.yml, actualiser.yml (déclenche le redéploiement nocturne)
docs/                          PLAN.md, CONTRAT.md, DONNEES.md, prompts/
```

Mise en ligne : intégration Git de Vercel. Variables facultatives `UMAMI_WEBSITE_ID` et `UMAMI_SRC`. Domaine : CNAME `quiavotequoi` → `cname.vercel-dns.com` chez le registraire de `phamelin.fr`.

## Prérequis côté utilisateur

- Projet Vercel relié au dépôt, domaine `quiavotequoi.phamelin.fr` et CNAME (déjà faits d'après l'utilisateur).
- **Mise à jour nocturne** : créer un *Deploy Hook* dans le projet Vercel (branche `main`) et l'enregistrer comme secret GitHub `VERCEL_DEPLOY_HOOK_URL`. Sans lui, le site ne se met à jour qu'aux fusions sur `main`.

Les prompts des sous-agents sont dans [prompts/](prompts/README.md). Les prompts 00 (exploration de l'API tabulaire) et 02 (serveur BFF sur l'API tabulaire) sont remplacés par 08 et 09.
