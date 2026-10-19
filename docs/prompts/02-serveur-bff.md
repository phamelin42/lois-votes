# Prompt 02 : serveur BFF (source tabulaire, limiteur, cache, agrégation, routes)

Branche : `lv/02-bff`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion de 00 et 01**, et seulement si `docs/API.md` conclut que l'API tabulaire suffit.

## Contexte commun

Tu travailles sur le dépôt `phamelin42/lois-votes`, le site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature).

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

Remplacer le BFF factice par le vrai. Les routes `/api/*` interrogent l'API tabulaire de data.gouv.fr, agrègent, et renvoient exactement les types de `src/shared/contrat.ts`. Elles sont rapides et économes en requêtes, et tiennent quand data.gouv.fr est lent ou limite le débit. **Rien n'est stocké** en dehors d'un cache mémoire de durée limitée. Aucune clé.

`docs/API.md` (prompt 00) fait foi sur les ressources (`rid`), les formats, la limite de débit et le coût en requêtes. Les réponses réelles sont dans `src/server/fixtures/source/`.

## Travail (TDD : chaque module a sa spec Vitest écrite avant lui)

1. `src/server/source/ressources.ts` : les `rid` de `docs/API.md`, surchargeables par variable d'environnement (`RID_SCRUTINS`, `RID_VOTES`, `RID_DEPUTES`, `RID_DATAN_DEPUTES`, `RID_DATAN_GROUPES` si elle existe).
2. `src/server/source/tabulaire.ts` : client `fetch` typé, base `TABULAR_API_BASE` (défaut `https://tabular-api.data.gouv.fr/api`), délai max 8 s. Il fournit :
   - `lignes(rid, filtres, { page, pageSize })` ;
   - `toutesLesLignes(rid, filtres)` : suit `links.next`, en parallèle borné par le limiteur ;
   - `compter(rid, filtres)` : `page_size=1`, renvoie `meta.total`.
   Les filtres sont typés (`{ colonne, op: 'exact' | 'in' | 'contains' | 'less' | 'greater', valeur }` et un tri), et l'encodage est géré ici (apostrophes, listes `__in` découpées si elles dépassent la longueur mesurée en 00). Une ligne de la source devient un type interne (`ScrutinSource`, `VoteSource`, `DeputeSource`, `DatanDepute`). C'est le seul dossier qui connaît data.gouv.fr.
3. `src/server/source/limiter.ts` : au plus 4 requêtes simultanées et 10 par seconde (ou la valeur de `docs/API.md` si elle est plus basse) ; fusion des requêtes identiques en vol ; sur 429 ou 503, attente de `Retry-After` (2 s par défaut) puis 1 seul nouvel essai. Tests avec de fausses horloges.
4. `src/server/cache.ts` : LRU en mémoire (500 entrées), `ttl` et `stale`. Pendant `stale`, la valeur périmée est servie et rafraîchie en arrière-plan ; si la source échoue, elle reste servie. Une fonction `memo(cle, ttl, stale, charger)`.
5. `src/server/classify.ts` (fonctions pures) :
   - `classer(titre)` : `final` (« l'ensemble du projet de loi / de la proposition de loi… »), `motion` (« la motion de censure… »), `article`, `amendement` (« l'amendement / les amendements / le sous-amendement… »), sinon `autre`. Au moins 30 vrais titres testés ;
   - `estAdopte(type, compte)` : la règle validée dans `docs/API.md` ;
   - `titreCourt(titre)` et `lecture(titre)` : « l'ensemble du projet de loi relatif à X (première lecture) » donne « Projet de loi relatif à X » et « première lecture » ;
   - `ventilerParGroupe(votes, groupeDe)` : groupe actuel du député, `NI` à défaut ; position majoritaire, `partage` à égalité ; tri par sièges. Test : la somme des groupes égale le `compte` du scrutin ;
   - `tauxAbstention(abstentions, exprimesEtAbst)`.
6. `src/server/index-deputes.ts` : index des députés actifs (NosParlementaires) joint à Datan par la règle de `docs/API.md` (photo `PA`, participation, loyauté), mis en mémoire 6 h avec `memo`. Couleurs des groupes : ressource Datan, sinon table des 12 couleurs officielles dans `src/server/groupes.ts`, documentée comme configuration.
7. `src/server/routes.ts` : routeur Express monté sur `/api` dans `src/server.ts`, qui remplace le mode factice (garde `MOCK_BFF=1` pour l'interface). Les routes suivent le contrat et le tableau des coûts et `Cache-Control` de `docs/PLAN.md`, corrigé par `docs/API.md` :
   - `GET /api/accueil?page=n` : 10 votes finaux par page avec ventilation. La liste des votes finaux est mise en cache, et les votes nominatifs sont demandés par paquets `scrutin_id__in` ;
   - `GET /api/lois/:dossier` : vote final = vote sur l'ensemble le plus récent, `lectures` = les autres, `scrutins` = le reste ;
   - `GET /api/scrutins/:numero`, `GET /api/deputes`, `GET /api/deputes/:slug` (10 derniers votes finaux par `deputy_slug__exact` + `scrutin_id__in`, abstention par 2 `compter`) ;
   - validation des paramètres : numéro entier, dossier `^DL[A-Z0-9]+$`, slug `^[a-z0-9-]+$`, page de 1 à 50 ;
   - erreurs : 404 `{erreur}` si l'objet est inconnu ; 503 + `Retry-After: 60` + `Cache-Control: no-store` si la source est indisponible sans valeur en cache.
8. Exporte `appelerBff(url): Promise<{ status: number; headers: Record<string,string>; body: unknown }>`. Elle exécute une route en mémoire, sans Express, pour l'intercepteur SSR du prompt 03. Garde ce nom et cette signature exacts.
9. Journalise sur stdout, par requête BFF, le nombre de requêtes à la source et leur durée (`[tabulaire] votes scrutin_id__in(10) p1/29 180 ms (cache: miss)`).

## Tests

- Specs unitaires sur les fixtures, sans réseau : un faux `fetch` sert `src/server/fixtures/source/` et applique les filtres `__exact`, `__in`, `__contains` et `__sort`, avec pagination et `meta.total`.
- Tests de route : chaque route renvoie un JSON qui respecte les types (`satisfies`), avec le bon `Cache-Control` ; une 2ᵉ requête identique ne touche pas la source.
- Robustesse : 429 puis 200 donne une réponse ; source en panne avec cache donne la valeur périmée ; sans cache, 503.

## Terminé quand

Les 4 commandes sont vertes. En réel (`npm run serve:ssr`, réseau data.gouv.fr requis), `curl` de chaque route. Compare 2 votes finaux avec leur `urlOfficielle` : totaux, adopté ou rejeté, position de 2 groupes. Donne le nombre de requêtes à froid et à chaud (0) pour chaque route. Sans réseau, dis-le.
