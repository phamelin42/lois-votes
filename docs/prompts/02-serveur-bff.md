# Prompt 02 : serveur BFF (source, file d'attente, cache, agrégation, routes)

Branche : `lv/02-bff`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion de 00 et 01**.

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

Remplacer le BFF factice par le vrai. Les routes `/api/*` interrogent NosParlementaires, agrègent, et renvoient exactement les types de `src/shared/contrat.ts`. Elles sont rapides et économes en appels, et tiennent quand l'API est lente ou limitée. **Rien n'est stocké** en dehors d'un cache mémoire de durée limitée.

Lis `docs/API.md` (prompt 00) : il fait foi sur les formats réels et le coût en appels. Les fixtures brutes sont dans `src/server/fixtures/source/`.

## Travail (TDD : chaque module a sa spec Vitest écrite avant lui)

1. `src/server/source/nosparlementaires.ts` : client `fetch` typé, un type par réponse **telle que documentée dans `docs/API.md`**. Base `NP_API_BASE` (défaut : `https://nosparlementaires.fr/api/v1`), clé `NOSPARLEMENTAIRES_API_KEY` en en-tête `X-Api-Key`, délai max 8 s (`AbortSignal.timeout`). Pagination gérée ici (`toutesLesPages`). C'est le seul fichier qui connaît la source.
2. `src/server/source/limiter.ts` : au plus 50 requêtes par fenêtre glissante de 60 s ; fusion des requêtes identiques en vol ; sur 429, attente de `Retry-After` puis 1 seul nouvel essai. Tests avec de fausses horloges.
3. `src/server/cache.ts` : LRU en mémoire (500 entrées max), `ttl` et `stale`. Pendant `stale`, la valeur périmée est servie et rafraîchie en arrière-plan ; si la source échoue, la valeur périmée reste servie jusqu'à expiration. Une fonction `memo(cle, ttl, stale, charger)`.
4. `src/server/classify.ts` (fonctions pures) :
   - `classer(titre): TypeScrutin` : « l'ensemble du projet de loi / de la proposition de loi… » → `final` ; « la motion de censure… » → `motion` ; « l'article… » → `article` ; « l'amendement… / les amendements… / le sous-amendement… » → `amendement` ; sinon `autre`. Teste sur au moins 30 vrais titres des fixtures ;
   - `estAdopte(type, compte)` : la règle validée dans `docs/API.md` ;
   - `ventilerParGroupe(votes, groupeDe)` : `VoteGroupe[]`. Position majoritaire, `partage` en cas d'égalité, non-inscrits en `NI`, tri par sièges. Test : la somme des groupes égale le `compte` du scrutin ;
   - `tauxAbstention(...)` et `titreCourtDepuisScrutin(titre)` (repli quand la loi n'a pas de `short_title`).
5. `src/server/routes.ts` : un routeur Express monté sur `/api` dans `src/server.ts`, qui remplace le mode factice (garde `MOCK_BFF=1` pour le développement de l'interface). Routes, coûts et `Cache-Control` : tableau de `docs/PLAN.md`, corrigé par `docs/API.md`.
   - `GET /api/accueil?page=n` : 10 votes finaux par page avec la ventilation par groupe.
   - `GET /api/lois/:slug`, `GET /api/scrutins/:numero`, `GET /api/deputes`, `GET /api/deputes/:slug`.
   - Erreurs : 404 `{erreur}` si l'objet est inconnu ; 503 + `Retry-After: 60` et `Cache-Control: no-store` si la source est indisponible sans valeur en cache.
   - Valide les paramètres (numéro entier, slug `[a-z0-9-]+`, page de 1 à 50).
6. Expose aussi `appelerBff(url): Promise<{status, headers, body}>`, une fonction **sans Express** qui exécute une route en mémoire. L'intercepteur serveur du prompt 03 s'en sert pour éviter un aller-retour HTTP pendant le SSR. Coordonne-toi via ce nom exact.
7. Journalise sur stdout le nombre d'appels à la source par requête BFF (`[np] GET /scrutins… 212 ms (cache: miss)`), sans la clé.

## Tests

- Specs unitaires sur les fixtures (aucun réseau). Un faux `fetch` sert `src/server/fixtures/source/`.
- Test de route avec `supertest` (ou un `fetch` vers un serveur éphémère) : chaque route renvoie un JSON qui respecte les types (`satisfies`), avec le bon `Cache-Control`. Une 2ᵉ requête identique ne fait **aucun** appel à la source.
- Test de robustesse : la source renvoie 429 puis 200, la route répond quand même ; la source tombe, la valeur en cache est servie ; pas de cache et source en panne donnent 503.

## Terminé quand

Les 4 commandes sont vertes. Avec une vraie clé (si disponible) : `npm run serve:ssr` puis `curl` de chaque route. Compare un vote final avec sa page officielle (`urlOfficielle`) : totaux, adopté ou rejeté, position de 2 groupes. Mets le résultat dans le rapport. Sans clé, dis-le.
