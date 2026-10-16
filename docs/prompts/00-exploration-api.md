# Prompt 00 : exploration de l'API NosParlementaires et fixtures

Branche : `lv/00-api` (créée depuis `claude/bold-fermi-zihw5t`).

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

Le serveur et les tests doivent reposer sur des formats **vérifiés**, pas devinés. Tu dois enregistrer des réponses réelles de l'API, les réduire en fixtures versionnées, et documenter ce qui diffère du plan. **N'écris aucun code applicatif.**

## Entrées

- API : `https://nosparlementaires.fr/api/v1`, clé dans l'en-tête `X-Api-Key`, lue depuis `NOSPARLEMENTAIRES_API_KEY`. Limite : 60 requêtes par minute, reste sous 40.
- Spec : `https://nosparlementaires.fr/api/v1/openapi.json` (publique).
- Exports publics sans clé : `https://nosparlementaires.fr/opendata/{deputes.json,scrutins_an.json,votes_an.json.gz,manifest.json}`.
- Contrôle officiel : `https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip` (champ `sort.code`).

## Travail

1. **Si la clé est présente**, appelle et enregistre une réponse brute de chaque endpoint :
   - `/deputies?limit=…` (toutes les pages) et `/deputies/{slug}` pour 3 députés, dont un qui a changé de groupe et un ancien député ;
   - `/deputies/{slug}/votes?legislature=17&limit=…`, et la même requête avec `position=ABSTENTION` ;
   - `/scrutins?chamber=an&legislature=17&limit=500`, `/scrutins/an/{id}` et `/scrutins/an/{id}/votes` pour 1 vote final, 1 motion de censure et 1 amendement ;
   - `/votes?chamber=an&group=<un groupe>&date_min=…&date_max=…` (même jour qu'un vote final) ;
   - `/lois?limit=…`, `/lois/{slug}` (au moins 2), `/groups?chamber=an`.
2. **Si la clé est absente**, construis des fixtures **provisoires** à partir des exports publics, avec la forme de la spec OpenAPI, et marque-les comme telles (`"_provisoire": true` à la racine de chaque fichier). Dis-le en tête de `docs/API.md`.
3. Réduis les réponses en fixtures dans `src/server/fixtures/source/` (un fichier par appel, nom = chemin et requête lisibles, < 400 Ko au total). Garde **12 votes finaux récents cohérents entre eux** (leurs scrutins, leurs votes nominatifs complets, les députés concernés, les lois liées), 1 motion de censure, 3 amendements et 3 articles du même texte.
4. Rédige `docs/API.md` :
   - pour chaque endpoint : forme exacte (enveloppe de liste, pagination, `total` ou non), champs nuls ou absents, format des dates ;
   - les réponses aux questions ouvertes du plan : le groupe figure-t-il dans `/scrutins/{id}/votes` ? `/votes?group=` donne-t-il le groupe à la date du scrutin ? Hôte des `photo_url` ? Lien loi ↔ scrutins par `dossier_ref` ?
   - le **coût réel en appels** de chaque route BFF du plan, à froid ;
   - la **règle d'adoption** (`pour > contre`, motion de censure si `pour >= 289`), vérifiée sur au moins 200 scrutins par rapport à `sort.code` officiel, avec les exceptions trouvées. Le script de vérification va dans `scripts/verifier-adoption.mjs`, sans dépendance.
5. Si un point contredit `docs/PLAN.md` ou `docs/CONTRAT.md`, **ne les modifie pas** : liste les changements proposés dans une section « Écarts » de `docs/API.md`.

## Terminé quand

`docs/API.md`, les fixtures et `scripts/verifier-adoption.mjs` sont commités et poussés, aucun secret n'est dans le dépôt (vérifie avec `git grep -i "np_pk_"`), et le rapport résume les écarts. Les commandes npm ne s'appliquent pas encore.
