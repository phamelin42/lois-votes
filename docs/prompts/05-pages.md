# Prompt 05 : pages (accueil branché, loi, scrutin, députés, recherche, à propos)

Branche : `lv/05-pages`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion de 02, 03 et 04**.

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

Assembler les pages à partir des services de données (prompt 03) et des composants (prompt 04), avec SSR complet, `@defer` sous la ligne de flottaison et pré-chargement sur les liens. Chaque page doit être compréhensible en 5 secondes : **quel parti a voté quoi**.

## Règles communes à toutes les pages

- Données via les services `src/app/data/` uniquement, statut HTTP via `statutDePage()` (404 et 503 réels).
- `Title` et `Meta` (description, Open Graph) propres à chaque page, posés au rendu serveur. Un `<h1>` par page. `fd-breadcrumb` sur les pages de détail.
- Tout lien vers une loi, un scrutin ou un député porte `appPrefetch` avec l'URL `/api/...` correspondante.
- `@placeholder` de hauteur fixe pour chaque `@defer`. Erreur : `fd-alert` (« Données momentanément indisponibles, réessayez dans une minute. »).
- Formulations : « Adopté par l'Assemblée » / « Rejeté par l'Assemblée », jamais « loi adoptée ». « Participation aux scrutins », jamais « présence ».

## Pages

1. **Accueil** (`/`) : `accueil.ts` branche `AccueilApi` sur `accueil-vue` (prompt 04). « Voir plus » charge la page suivante et **ajoute** les cartes à la liste, sans les remplacer. Pas de `?page=` dans l'URL. Les pastilles de groupes des cartes au-delà de la 4ᵉ sont en `@defer (on viewport; hydrate on viewport)`.
2. **Shell** : branche `app-search` sur `DeputeApi.liste()`, chargé seulement quand `besoinIndex` est émis, et la date de mise à jour du pied sur `Accueil.miseAJour` quand elle est connue.
3. **Loi** (`/lois/:slug`) : en haut, titre court, titre officiel, statut, lien « Dossier sur le site de l'Assemblée ». Bloc « Vote final » : date, badge du résultat, `app-vote-bar` taille `md`, **`app-group-table`**. Si `voteFinal` est nul : « Pas encore de vote sur l'ensemble du texte. »
   - `@defer (on interaction; hydrate on interaction)` sur un bouton « Voir comment chaque député a voté » : charge `ScrutinApi.detail(numero)` et affiche la liste nominative dans `fd-tabs` (Pour / Contre / Abstention / Non-votants), puis par groupe, chaque nom vers sa fiche.
   - `@defer (on viewport; hydrate on viewport)` pour « Autres scrutins du texte » : `fd-accordion` par type (articles, amendements, autres), chaque ligne avec date, titre, badge et lien vers `/scrutins/:numero`.
4. **Scrutin** (`/scrutins/:numero`) : titre, type, date, résultat, barre, tableau par groupe, lien vers la loi si elle est connue, lien vers la page officielle, et la liste nominative sous le même `@defer (on interaction)` que la page Loi.
5. **Députés** (`/deputes`) : liste `DeputeApi.liste()` triée par `nomTri`. Filtres `fd-select` groupe et département, champ de filtre par nom (`normaliser`). Les filtres sont dans les paramètres d'URL (`?groupe=RN&dept=69&q=`), donc partageables et appliqués au rendu serveur. Cartes compactes : `app-deputy-photo` 64 en `loading=lazy` (si l'index ne fournit pas de photo, initiales), nom, `app-group-pill`, circonscription. `fd-empty-state` si aucun résultat. Au-delà de 60 résultats, « Afficher plus » ; pas de virtualisation.
6. **Député** (`/deputes/:slug`) :
   - en-tête : `app-deputy-photo` 160 en **`priority`** (LCP), nom, parti (`app-group-pill` + libellé complet), circonscription, lien vers la fiche source ;
   - 3 chiffres clés en tuiles : **Participation aux scrutins**, **Taux d'abstention**, **Vote avec son groupe**, chacun avec une phrase d'explication (« Part des scrutins publics où il ou elle a voté »…) et « — » si la valeur est nulle. Accorde « il ou elle », ou une formulation neutre : la source ne donne pas le genre de façon fiable ;
   - « Ses votes sur les 10 dernières lois » : tableau loi (lien), date, **sa position** (`app-position`), position de son groupe, résultat. Ligne mise en évidence (texte « Différent de son groupe », pas seulement une couleur) quand sa position diffère de celle de son groupe.
7. **Recherche** (`/recherche?q=`) : rendu serveur des résultats (députés et lois récentes depuis `DeputeApi.liste()`, filtrés par `normaliser`). Un seul député trouvé → redirection serveur 302 vers son profil. Sinon, deux sections de résultats. Requête vide → message d'aide.
8. **À propos** (`/a-propos`, pré-rendue) : à quoi sert le site ; d'où viennent les données (NosParlementaires, d'après l'open data de l'Assemblée ; Licence Ouverte 2.0, avec liens) ; ce qu'est un vote final, un amendement, une motion de censure ; comment adopté et rejeté sont déterminés (règle de `docs/API.md`) ; pourquoi « participation » et pas « présence » ; une adoption à l'Assemblée n'est pas une loi promulguée ; mesure d'audience Umami sans cookie ; contact.
9. **404** : `fd-empty-state` avec retour à l'accueil, statut 404.

## Tests et vérification

- Specs : chaque page rend ses états chargement, succès, erreur et vide avec les fixtures BFF ; redirection de `/recherche` sur un résultat unique ; filtres de `/deputes` lus depuis l'URL ; mise en évidence « Différent de son groupe ».
- Avec `MOCK_BFF=1 npm run serve:ssr`, puis avec le vrai BFF si une clé est disponible : parcours accueil → loi → « Voir comment chaque député a voté » → un député → recherche d'un autre député. `curl` de chaque page : HTML complet, bon `<title>`, bon statut (200, 404). JS désactivé : contenu lisible et recherche fonctionnelle.

## Terminé quand

Les 4 commandes sont vertes, budgets compris. Le rapport donne la taille du bundle initial et des chunks par page, et le résultat du parcours.
