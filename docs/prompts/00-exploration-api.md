# Prompt 00 : exploration de l'API tabulaire de data.gouv.fr et fixtures

Branche : `lv/00-api` (créée depuis `claude/bold-fermi-zihw5t`). **Il faut un accès réseau à `www.data.gouv.fr` et `tabular-api.data.gouv.fr`** : vérifie-le d'abord (`curl -sS -o /dev/null -w "%{http_code}" https://tabular-api.data.gouv.fr/api/`). Sans accès, arrête-toi et dis-le.

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
- Ne modifie pas Fuda. **Aucune clé API** : toutes les sources sont publiques (API tabulaire de data.gouv.fr).
- Ne change pas le contrat sans mettre à jour `docs/CONTRAT.md` et `src/shared/contrat.ts` ensemble, et sans le signaler dans ton rapport.
- Terminé = `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` verts (sauf mention contraire du prompt). Ne déclare rien de vert sans l'avoir lancé.
- Commits en français, push sur ta branche (`git push -u origin <branche>`). Pas de pull request.
- Rapport final : ce qui est fait, ce qui ne l'est pas et pourquoi, sortie résumée des vérifications, écarts par rapport au plan.

## Objectif

Le serveur et les tests doivent reposer sur des formats **vérifiés**, pas devinés. Tu dois trouver les ressources data.gouv.fr que le site interrogera, prouver que l'API tabulaire les sert avec les filtres prévus, enregistrer des réponses réelles en fixtures, et documenter le tout. **N'écris aucun code applicatif.**

## Entrées

- API tabulaire : `https://tabular-api.data.gouv.fr/api/resources/{rid}/data/?<col>__exact=…&<col>__in=a,b&<col>__contains=…&<col>__sort=desc&page=1&page_size=…`. La réponse est `{ data, links: {next, prev}, meta: {page, page_size, total} }`, et la spec de chaque ressource est à `/api/resources/{rid}/swagger/` (README : https://github.com/datagouv/api-tabular).
- Catalogue : `https://www.data.gouv.fr/api/1/datasets/?q=…` et `https://www.data.gouv.fr/api/1/organizations/<org>/datasets/`. Organisations probables : « Nos Parlementaires », « Datan ».
- Ressources visées et colonnes attendues : tableau « Ressources visées » de `docs/PLAN.md`.
- Exports de référence, sans clé, pour comparer : `https://nosparlementaires.fr/opendata/{deputes.json,scrutins_an.json,votes_an.json.gz}`.
- Contrôle officiel : `https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip` (champ `sort.code`).

## Travail

1. **Trouver les ressources** : pour chaque besoin du tableau (scrutins, votes individuels, députés, photo/participation/loyauté via Datan, couleurs des groupes), donne le jeu de données, le `rid`, l'URL, le format, la date de dernière mise à jour et la fréquence annoncée.
2. **Vérifier l'API tabulaire sur chaque ressource** :
   - elle répond (pas 404, ni « en cours d'analyse », ni « trop volumineux ») ;
   - colonnes et types détectés (swagger), opérateurs autorisés par colonne ;
   - `page_size` maximum réel ; présence et exactitude de `meta.total` ;
   - les requêtes exactes du plan fonctionnent : `title__contains=l'ensemble` + `date__sort=desc`, `scrutin_id__in=<10 ids>`, `dossier_ref__exact`, `deputy_slug__exact` + `position__exact=ABSTENTION` (comptage par `meta.total`), `active__exact=true` ;
   - longueur maximale d'une liste `__in` et encodage de l'apostrophe dans `__contains` ;
   - **limite de débit** : mesure-la prudemment, sans dépasser 5 requêtes par seconde (en-têtes `RateLimit-*`/`Retry-After`, 429 éventuels) ; temps de réponse médian et p95 ;
   - **fraîcheur** : écart entre le dernier scrutin servi par l'API et l'export du jour.
3. **Point de décision** : si les **votes individuels** ne sont pas servis par l'API tabulaire (ressource absente, non traitée, trop grosse, filtres impossibles), **arrête-toi** après avoir documenté ce que tu as trouvé. Le rapport doit dire clairement « l'API tabulaire ne suffit pas » et rappeler le repli du plan (exports publics lus en mémoire). Ne bascule pas seul.
4. **Jointure NosParlementaires ↔ Datan** pour les députés actifs : par nom, prénom et département normalisés. Donne le taux de correspondance et la liste des échecs, et propose la règle de jointure finale. Vérifie 5 URL de photo construites depuis l'identifiant `PA` (`https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/<n>.jpg`).
5. **Fixtures** dans `src/server/fixtures/source/` : des réponses **réelles** de l'API tabulaire, un fichier par requête (nom lisible : ressource et filtres), < 400 Ko au total. Garde **12 votes finaux récents cohérents** (leurs scrutins, tous leurs votes nominatifs, l'index des députés actifs, les lignes Datan correspondantes), 1 motion de censure, 3 amendements et 3 articles du même texte, plus un texte à plusieurs lectures. Ajoute `src/server/fixtures/source/ressources.json` : `{ besoin → rid }`.
6. **Règle d'adoption** : `scripts/verifier-adoption.mjs` (Node, sans dépendance) compare `pour > contre` (motion de censure : `pour >= 289`) au `sort.code` officiel sur au moins 200 scrutins, dont toutes les motions. Donne le taux d'accord et les exceptions.
7. **`docs/API.md`** : ressources et `rid` retenus, formats exacts, opérateurs, pagination, limite de débit, latence, fraîcheur, jointure, règle d'adoption, et **coût réel en requêtes** de chaque route BFF (tableau de `docs/PLAN.md` corrigé).
8. Si un point contredit `docs/PLAN.md` ou `docs/CONTRAT.md`, ne les modifie pas : liste les changements proposés dans une section « Écarts » de `docs/API.md`.

## Terminé quand

`docs/API.md`, les fixtures et `scripts/verifier-adoption.mjs` sont commités et poussés, et le rapport donne la décision : l'API tabulaire suffit, ou il faut le repli. Les commandes npm ne s'appliquent pas encore.
