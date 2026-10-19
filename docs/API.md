# API tabulaire de data.gouv.fr : constats du prompt 00

Mesures faites le **19/10/2026** (09 h 30 à 12 h UTC) depuis l'environnement d'exploration, derrière un proxy sortant qui coupe parfois les connexions (« Connection reset by peer », voir « Limites des mesures »). Tout ce qui suit a été vérifié par requête réelle ; ce qui ne l'a pas été est dit.

## Décision

**L'API tabulaire ne suffit pas.** Les votes individuels (NosParlementaires, `votes_an.csv.gz`) sont publiés sur data.gouv.fr, mais **l'API tabulaire ne les sert pas** : la ressource n'a pas pu être chargée dans sa base (`meta.total = 0`, `data = []`, quelle que soit la requête). Tout le reste (scrutins, députés, Datan) est servi correctement, avec les filtres prévus, à environ 170 ms.

Repli prévu par le plan (à décider par l'utilisateur, **non appliqué ici**) : lire en mémoire l'export public `https://nosparlementaires.fr/opendata/votes_an.csv.gz` (5,6 Mo, 51 Mo décompressés, ETag et `If-None-Match` pris en charge), et garder l'API tabulaire pour le reste. Détails et coût dans « Repli ».

### Pourquoi les votes ne sont pas servis

La ressource, d'après la fiche data.gouv.fr (`GET /api/1/datasets/6a86f9a3a570a6bc4b9f7ef4/`) :

- `url` : `https://nosparlementaires.fr/opendata/votes_an.csv.gz`, format déclaré `csv`, type MIME détecté `application/gzip` ;
- `extras["analysis:parsing:error"]` : `copy_records_to_table:'utf-8' codec can't decode byte 0x8b in position 1: invalid start byte`. L'octet `0x8b` est le deuxième octet de l'en-tête gzip (`1f 8b`) : le chargeur de l'API lit le fichier compressé comme du texte, sans le décompresser ;
- les trois copies publiées de la ressource (`2b9fd269-…`, `f6be8e70-…`, `3ffe20f0-…`) ont la même erreur à chaque analyse (18/10 et 19/10) ;
- `GET /api/resources/2b9fd269-…/profile/` répond pourtant (détection correcte des colonnes `scrutin_id`, `deputy_slug`, `position`, `total_lines: 1249652`), et `/swagger/` liste les opérateurs : l'API **annonce** donc des filtres qu'elle ne peut pas appliquer. Piège pour tout test de ressource qui s'arrêterait à la spec.
- `GET …/data/?scrutin_id__exact=VTANR5L17V8695&page_size=200` → `200 {"data": [], "meta": {"total": 0}}` (fixture `votes__NON-SERVI__scrutin_id-exact-VTANR5L17V8695.json`) ; idem pour `deputy_slug__exact=mathilde-panot&position__exact=ABSTENTION` (`total = 0`).
- Les ressources JSON (`votes_an.json.gz` et toutes les `.json`) : `GET …/data/` → **404 « Not Found »** (l'API ne traite que les CSV).
- Aucun autre jeu de données du catalogue ne donne les votes individuels de la 17ᵉ législature en CSV non compressé servi par l'API : Datan n'a que 4 jeux (députés et groupes, actifs et historiques, sans votes) ; « Données parlementaires françaises – CIVIX » (`69deda333d08655687515c9e`, quotidien, Licence Ouverte) publie les votes individuels dans une archive **zip** de 17,7 Mo (non servie) ; « Scrutins publics … agrégés et thématisés » (`6aa126b722f207d2e45389be`, quotidien, tiers) ne contient que les scrutins.

**Piste à signaler au producteur** (à décider, non testée) : l'export `votes_an.csv.gz` décompressé ferait environ **51 Mo** (1 323 978 lignes), sous la limite de 100 Mo de l'API ; publié en `votes_an.csv` non compressé, il serait vraisemblablement chargé. C'est la seule voie pour que le plan initial (tout via l'API tabulaire) fonctionne.

## Ressources retenues

Le jeu NosParlementaires est **publié trois fois** dans le même jeu de données (chaque ressource existe en trois exemplaires, créés à 12:57:07, 12:57:13 et 12:57:23 le 20/08/2026, avec les mêmes URL). Les exemplaires renvoient les mêmes lignes mais ne sont pas analysés au même moment (voir « Fraîcheur »). Rid retenu : l'exemplaire **créé en dernier, analysé le plus récemment** ; les autres sont équivalents.

| Besoin | Jeu de données | `rid` retenu | Source (URL du fichier) | Format | Mis à jour | Annoncé |
|---|---|---|---|---|---|---|
| Scrutins AN | NosParlementaires « Votes et activité des parlementaires français — 17e législature », id `6a86f9a3a570a6bc4b9f7ef4` | `341c15dc-0cc3-4bcf-8954-8f4b519b7a4d` | `https://nosparlementaires.fr/opendata/scrutins_an.csv` | CSV, 2 136 526 o, 8 877 lignes | 19/10/2026 04:53 UTC (analysé 05:20) | quotidien |
| Votes individuels AN | idem | **aucun** (non servi) ; `2b9fd269-cd30-4edc-81d2-c64a1ff258c8` est la ressource CSV gzip en erreur | `https://nosparlementaires.fr/opendata/votes_an.csv.gz` | CSV gzip, 5 651 953 o, 1 323 978 lignes | 19/10/2026 04:54 UTC | quotidien |
| Députés | idem | `f779eac6-34ca-4cb6-b3bb-a50ccce9d04d` | `https://nosparlementaires.fr/opendata/deputes.csv` | CSV, 158 470 o, 2 128 lignes dont 574 actifs | 19/10/2026 04:53 UTC (analysé 05:08) | quotidien |
| Photo, participation, loyauté | Datan « Députés actifs de l'Assemblée nationale - Informations et statistiques », id `5fc8b732d30fbf1ed6648aab` | `092bd7bb-1543-405b-b53c-932ebb49bb8e` | `https://static.data.gouv.fr/resources/deputes-actifs-de-lassemblee-nationale-informations-et-statistiques/<horodatage>/deputes-active.csv` | CSV, 150 397 o, 574 lignes | 19/10/2026 09:08 UTC (analysé 08:07 : voir « Fraîcheur ») | quotidien |
| Couleurs et libellés des groupes | Datan « Groupes politiques actifs de l'Assemblée nationale - Informations et statistiques », id `60ed57a9f0c7c3a1eb29733f` | `4612d596-9a78-4ec6-b60c-ccc1ee11f8c0` | `…/groupes-active.csv` | CSV, 1 577 o, 12 lignes | 19/10/2026 09:08 UTC | quotidien |

Licences : Licence Ouverte 2.0 (NosParlementaires : `lov2` ; Datan : `fr-lo`). L'URL des fichiers de Datan contient un horodatage qui change à chaque mise à jour : **ne jamais la coder, passer par le `rid`**.

Autres ressources utiles, non retenues : Datan « Historique des députés (depuis 2002) » `817fda38-d616-43e9-852f-790510f4d157` (2 128 lignes, servi par l'API) et « Historique des groupes » `530940ab-45f3-41e3-8de3-759568c728b8` (53 lignes, servi).

Le fichier `src/server/fixtures/source/ressources.json` donne `{ besoin → rid }` (`votes: null`). Valeurs par défaut à reporter dans `src/server/source/ressources.ts` : `RID_SCRUTINS`, `RID_DEPUTES`, `RID_DATAN_DEPUTES`, `RID_DATAN_GROUPES` (celle-ci n'est pas encore lue par le BFF) ; `RID_VOTES` n'a pas de valeur utile.

**Les `rid` ne sont pas stables à coup sûr** : les trois exemplaires peuvent être nettoyés par le producteur. Voir « Écarts » §9 (résolution du `rid` par l'URL du fichier).

## Comportement de l'API tabulaire

Base : `https://tabular-api.data.gouv.fr/api/resources/{rid}/data/` (HTTPS, sans clé, `access-control-allow-origin: *`, `cache-control: public`, `content-encoding: gzip`, nginx avec en-tête `x-cache-status: MISS|HIT`).

### Réponse

```json
{ "data": [ { "__id": 1, "id": "VTANR5L17V1", … } ],
  "links": { "profile": "…/profile/", "swagger": "…/swagger/", "next": "https://…/data/?page=2&page_size=1", "prev": null },
  "meta": { "page": 1, "page_size": 1, "total": 8877 } }
```

- Chaque ligne porte `__id` (numéro de ligne dans le CSV, à partir de 1, dans l'ordre du fichier, qui est l'ordre **lexicographique** des identifiants : `VTANR5L17V999` a `__id = 8877`). Il faut l'ignorer.
- `meta.total` est **exact** : 8 877 (scrutins, égal à `manifest.json` et à l'archive officielle), 2 128 (députés), 574 (Datan), 574 avec `active__exact=true`, 219 pour `l'ensemble`. Il est présent aussi quand `page_size=1`, d'où le comptage sans télécharger les lignes. Il est **absent** des réponses `groupby` (`meta` ne contient que `page` et `page_size`).
- `links.next` est une URL absolue ; `null` sur la dernière page.
- `columns=a,b,c` limite les colonnes renvoyées (vérifié). Les payloads fondent : députés actifs 146 Ko → 108 Ko avec les 7 colonnes utiles ; Datan 364 Ko → 72 Ko avec 6 colonnes.

### Pagination

- `page_size` **maximum : 200** (20 par défaut). Au-dessus : `400 {"errors":[{"title":"Invalid query string","detail":"Page size exceeds allowed maximum: 200"}]}`.
- Une page au-delà de la dernière répond **`500 Internal Server Error`** (texte « Server got itself in trouble »), pas une liste vide : le BFF doit calculer la dernière page à partir de `meta.total`.
- **Tri sur des ex æquo instable.** `date__sort=desc` ne trie que sur la date ; beaucoup de scrutins ont la même date. Mesuré : 4 pages de 10 de `title__contains=ensemble&date__sort=desc` renvoient 40 lignes mais **38 identifiants distincts** (doublons et trous entre pages). Avec `page_size=200`, trois appels successifs renvoient exactement la même séquence. Un second critère de tri (`date__sort=desc&__id__sort=desc` ou `&id__sort=desc`) n'a pas donné l'ordre attendu. `__id__sort` fonctionne seul (hors spec) mais l'ordre du fichier n'est pas chronologique (799 inversions de date sur 8 877).
  → Pour « les 10 dernières lois » : **une seule requête** `page_size=200` (ou 30), puis tri `(date, numéro)` décroissant et pagination par 10 **dans le BFF**. Au-delà de 200 lignes, reprendre avec `date__strictly_less=<jour>`.

### Opérateurs (spec `/swagger/` de chaque ressource, confirmés par requête)

Pour chaque colonne : `exact`, `differs`, `isnull`, `isnotnull`, `in`, `notin`, `groupby`, `count`, `sort` (`asc|desc`), `less`, `greater`, `strictly_less`, `strictly_greater`. Les colonnes texte ajoutent `contains` et `notcontains` ; les colonnes numériques ajoutent `avg`, `min`, `max`, `sum` (et n'ont pas `contains`). Les booléens (`active`) n'ont que `exact`, `differs`, `isnull`, `isnotnull`, `groupby`, `count`, `sort`. Paramètres globaux : `page`, `page_size`, `columns`, `or`.

Comportements vérifiés :

| Besoin | Requête | Résultat |
|---|---|---|
| Votes sur l'ensemble | `scrutins`: `title__contains=l'ensemble&date__sort=desc&page_size=12` | 200, `total` 219 (voir piège de l'apostrophe) |
| Insensible à la casse | `title__contains=L'ENSEMBLE` | même résultat (219) |
| Texte | `title__contains=l%27ensemble` ou `l'ensemble` brut | identiques : l'apostrophe peut rester brute ou être encodée `%27` ; `encodeURIComponent` convient |
| Apostrophe typographique | `title__contains=l%E2%80%99ensemble` | **10 lignes de plus**, que `l'ensemble` ne trouve pas (voir ci-dessous) |
| Liste d'identifiants | `id__in=V1,V2,…` | 200 ; 200 ids (3 110 caractères) et 500 ids (7 000 caractères) répondent ; **800 ids (11 200 caractères) : `414 Request-URI Too Large`** (nginx). Limite pratique : URL ≤ environ 8 000 caractères, soit ~500 identifiants de scrutin. Les dix ids du plan passent sans souci. |
| Dossier | `dossier_ref__exact=DLR5L17N52746&date__sort=desc` | 200, `total` 15 |
| Dossier hors amendements | `dossier_ref__exact=DLR5L17N51670&title__notcontains=amendement` | 893 lignes → 60 |
| Actifs | `deputes`: `active__exact=true` (aussi `True`) | 200, `total` 574, 3 pages de 200 |
| Un député | `slug__exact=mathilde-panot` | 1 ligne |
| Liste de slugs | `slug__in=<80 slugs>` | 200 (1 346 caractères) |
| Datan, un député | `nom__exact=Panot&prenom__exact=Mathilde` | 1 ligne (`PA720892`) ; `nom__exact=Le%20Pen` fonctionne |
| Comparaisons de date | `date__less=2026-10-12` | **inclusif** (≤) ; `strictly_less` exclusif ; `date__exact=2026-10-12` compare le **jour** (sans heure) |
| Comptage par groupe | `active__exact=true&group_short__groupby&group_short__count` | 12 groupes, effectifs corrects ; pas de `meta.total` |
| Valeurs nulles | `dossier_ref__isnull` / `isnotnull` | 160 / 8 717 (somme 8 877) |

À éviter ou piégeux :

- **`or=(a.contains.x,b.contains.y)` ne fonctionne pas avec une apostrophe** (`400 Malformed query: argument 'title.contains.l'ensemble' could not be parsed`) ; je n'ai pas trouvé d'échappement. Même sans apostrophe, la syntaxe testée a été refusée (`or=(title.contains.ensemble,title.contains.motion)`).
- `date__contains` : la spec le liste, mais la requête répond `404` avec une erreur de base (`No operator matches …`). La colonne `date` est un horodatage ; `swagger` la déclare `string`, `profile` la détecte `datetime_aware`.
- Colonne inconnue : `400 « Database error … column … does not exist »`. Opérateur inconnu : `400 « Malformed query »`.
- Un même paramètre répété avec deux valeurs (`title__notcontains=a&title__notcontains=b`) : le résultat n'a pas pu être interprété (je n'ai pas établi s'il s'agit d'un ET ou si seule une valeur compte) ; ne pas s'y fier, enchaîner plutôt les filtres sur des colonnes différentes ou filtrer dans le BFF.
- Le `profile` indique `categorical: ["position"]` pour les votes, sans conséquence.

### Colonnes et types détectés

`scrutins` (`341c15dc…`) : `id` string (`VTANR5L17V<n>`) ; `date` datetime avec fuseau (`2026-10-16T00:00:00+02:00`, **minuit heure de Paris**) ; `title` string ; `dossier_ref` string (null pour 160 scrutins) ; `pour`, `contre`, `abstention`, `nonvotant` int.

`deputes` (`f779eac6…`) : `slug`, `first_name`, `last_name`, `full_name`, `group_short`, `group_label`, `constituency_label`, `department_code` (string : `01`…`95`, `2A`, `2B`, `971`…`988`, `099`) ; `active` bool (574 vrais, 1 554 faux).

`votes` (non servi ; d'après `profile`) : `scrutin_id`, `deputy_slug`, `position` (`POUR`, `CONTRE`, `ABSTENTION`, `NONVOTANT`), tous string, 1 323 978 lignes dans l'export (580 652 `POUR`, 643 533 `CONTRE`, 75 754 `ABSTENTION`, 24 039 `NONVOTANT`).

Datan députés (`092bd7bb…`) : `id` (`PA1008`), `legislature` int, `civ`, `nom`, `prenom`, `villeNaissance`, `naissance` date, `age` int, `groupe`, `groupeAbrev`, `departementNom`, `departementCode` (minuscules pour la Corse : `2a`, `2b`), `circo` int, `datePriseFonction` date, `job`, `mail`, `twitter`, `facebook`, `website`, `nombreMandats` int, `experienceDepute`, `scoreParticipation` float, `scoreParticipationSpecialite` float, `scoreLoyaute` float, `scoreMajorite` float, `dateMaj` date. **Pas de slug ni d'identifiant NosParlementaires.**

Datan groupes (`4612d596…`) : `id` (`PO845401`, identifiant officiel de l'organe), `legislature`, `libelle`, `libelleAbrev` (même abrégé que `group_short`), `libelleAbrege`, `dateDebut`, `positionPolitique` (toujours null), `couleurAssociee` (hex), `effectif`, `women`, `age`, `scoreRose`, `socreCohesion` (faute de frappe dans le nom de colonne), `scoreParticipation`, `scoreMajorite`, `dateMaj`. Les 12 groupes actifs y sont, **NI compris** (libellé « Non inscrit », `#8D949A`), avec leur couleur : la table de couleurs en dur du plan est inutile.

### Couleurs des groupes (pour `groupes.ts`)

ECOS `#77AA79`, DEM `#F07E26`, LIOT `#FFD96F`, GDR `#830E21`, DR `#8CB0DC`, HOR `#B5E2F9`, LFI-NFP `#C00D0D`, RN `#313567`, SOC `#F5B4CE`, UDDPLR `#3367A7`, NI `#8D949A`, EPR `#7B4591` (à utiliser en pastille seulement, jamais pour du texte).

## Débit, latence

- **Aucun en-tête `RateLimit-*`, `X-RateLimit-*` ni `Retry-After`** n'a été vu sur aucune réponse, et **aucun `429`** sur plusieurs centaines de requêtes (environ 800 au total, dont deux séries de 300). La documentation de l'API n'annonce pas de quota dans ce que j'ai lu. **Limite de débit : non atteinte jusqu'à environ 5 requêtes par seconde ; au-delà, non mesurée** (consigne : ne pas dépasser 5/s). Voir l'aveu plus bas.
- Mesure principale (300 requêtes toutes distinctes, scrutins et députés, une toutes les 205 ms pendant 61,5 s, soit 4,88 req/s) : **289 réponses 200, 1 réponse 500** (page hors limites, erreur de mon plan de test), **10 coupures de connexion** (`ECONNRESET`, 3,3 %, attribuées au proxy de l'environnement : elles se produisent aussi sur des hôtes qui répondent 200 à la requête suivante, et le journal du proxy les signale comme `ws_closed_mid_exchange`).
  Latence des 289 réponses 200 : **médiane 166 ms, p95 193 ms, p99 639 ms**, min 129 ms, max 686 ms.
- Première passe (même scénario avec une cadence mal réglée, voir plus bas) : 295 réponses 200, médiane 176 ms, p95 211 ms, p99 739 ms ; aucun `429`.
- Lecture séquentielle de la table complète des scrutins (45 pages de 200 lignes, 66 Ko compressés chacune) : médiane 189 ms, p95 1 933 ms, max 5 163 ms (les pages lourdes sont plus variables). Députés : 11 pages de 200 en 0,18 à 0,26 s chacune (une à 0,72 s). Datan (40 requêtes, `page_size=5`) : médiane 299 ms, p95 482 ms. Les endpoints `profile` et `swagger` de Datan sont lents (10 à 13 s, parfois `502`) : ne jamais les appeler à l'exécution.
- Cache : `x-cache-status: HIT` apparaît sur des requêtes répétées ; la première est `MISS`. `cache-control: public` sans durée.

**Aveu sur la cadence.** Ma première passe de mesure de débit avait un défaut de planification (un `sleep` réglé sur le modulo du temps écoulé) : sa cadence réelle a dépassé 5 req/s par instants (jusqu'à 9 requêtes dans une même seconde, 5,8 req/s en moyenne) pendant environ 50 s. Elle n'a produit aucun `429`. J'ai refait la mesure avec un espacement absolu de 205 ms (maximum de 6 démarrages dans une fenêtre d'une seconde, dû au rattrapage des minuteurs). Les chiffres de référence sont ceux de la seconde passe.

Conséquence pour le plan : le limiteur prévu (4 simultanées, 10/s) n'est pas justifié par une limite connue ; tant que 10/s n'est pas mesuré, **le régler à 5/s** (valeur éprouvée) et garder la gestion de `429`/`Retry-After`, `502`, `500` et coupures par nouvel essai (2, 4, 8 s). Ce n'est pas un coût : le BFF fait au plus quelques requêtes par route.

## Fraîcheur

- Le **19/10/2026**, le dernier scrutin de l'API tabulaire est `VTANR5L17V8877` (16/10/2026). L'export `scrutins_an.json` du même jour contient les **mêmes 8 877 scrutins**, avec **zéro différence** de décompte, titre ou dossier ; l'archive officielle `Scrutins.json.zip` (générée à 04:25 GMT) en contient aussi 8 877. Aucun écart sur le dernier scrutin.
- Le décalage tient au calendrier de reparse de l'API : exemplaire `341c15dc` analysé à 05:20 UTC le 19/10 pour un fichier produit à 04:53 (27 min) ; mais les exemplaires plus anciens d'une même ressource ont été analysés la veille (`8c5fbee7`, 18/10 11:57 pour le fichier du 18/10 04:58). Datan : le fichier de Datan est daté 09:08 UTC mais la dernière analyse remonte à 08:07 : **l'API tabulaire peut servir la version de la veille jusqu'à ce que le prochain contrôle de data.gouv.fr relance l'analyse**. Prévoir au pire environ un jour de retard.
- Le producteur publie `manifest.json` (`generated_at: 2026-10-19T04:54:19+00:00`, nombre de lignes et SHA-256 par fichier) : utile pour `miseAJour` et pour comparer à l'API.
- La métadonnée du jeu (`temporal_coverage.end = 2026-08-20`) est périmée ; l'ignorer.

## Jointure NosParlementaires ↔ Datan (députés actifs)

Entrées : 574 députés actifs NosParlementaires (`active = true`), 574 lignes Datan.

| Clé (normalisée) | Appariés | Ambigus | Échecs |
|---|---|---|---|
| prénom + nom + code de département | **574 / 574 (100 %)** | 0 | 0 |
| prénom + nom | 574 / 574 (100 %) | 0 | 0 |
| nom complet + département | 574 / 574 (100 %) | 0 | 0 |

Aucune ligne Datan non appariée. Les groupes concordent pour les 574 (`group_short` = `groupeAbrev`). **Liste des échecs : vide.**

**Règle de jointure finale proposée** : clé `prénom|nom|département`, chaque champ normalisé par : décomposition Unicode (NFD) puis retrait des accents, minuscules, apostrophes (`'`, `’`) et traits d'union remplacés par une espace, espaces multiples réduits ; département en majuscules (Datan écrit `2a`, `2b` ; NosParlementaires `2A`, `2B`). Si la clé donne plusieurs lignes, retomber sur `prénom|nom|circo` (non nécessaire aujourd'hui). Si aucune ligne : photo et taux Datan à `null` (déjà prévu par `DeputeDetail`). Cette règle ne s'applique qu'aux **députés actifs** (Datan « actifs ») : un ancien député n'a ni photo ni score ici (un jeu « Historique des députés » existe, non testé en jointure).

**Photos** : 7 URL construites depuis `id` (`PA…` → numéro sans `PA`) ont toutes répondu 200 `image/jpeg` : `…/photos/carre/1008.jpg` (37 Ko), `719558` (39 Ko), `793672` (53 Ko), `795912` (55 Ko), `942` (43 Ko), `720892` (Panot, 58 Ko), `720614` (Le Pen, 57 Ko). Latence 76 ms à 2,3 s.

**Sens du score de participation de Datan** (`scoreParticipation`, 0 à 1, arrondi au centième) : proche de la part des 8 877 scrutins publics auxquels le député a pris part. Vérifié sur l'export : Alain David 524 votes / 8 877 = 0,059 pour 0,06 ; Mathilde Panot 2 938 / 8 877 = 0,331 pour 0,33 ; corrélation de 0,875 sur les 574 députés (écarts attendus pour les arrivées en cours de législature). La moyenne est basse (0,26) parce que l'immense majorité des scrutins sont des amendements : l'application doit l'étiqueter « Participation aux scrutins », jamais « présence ». `scoreLoyaute` (nom exact de la colonne) : 0 à 1, non recalculé.

## Règle d'adoption

`scripts/verifier-adoption.mjs` (Node, sans dépendance ; lit l'archive zip officielle avec `node:zlib`) compare la règle au champ officiel `sort.code` :

- cas général : adopté si `pour > contre` ;
- motion de censure (titre commençant par « la motion de censure ») : adoptée si `pour >= 289`.

**Résultat (19/10/2026, décomptes servis par l'API tabulaire, vérité = `Scrutins.json.zip` du jour) : accord sur 8 877 scrutins sur 8 877 (100,00 %), exceptions : aucune.** Cela couvre les 23 motions de censure (23/23 ; le type officiel `MOC` en compte aussi 23), 58 scrutins à égalité exacte (`pour = contre`, tous rejetés) et 155 scrutins à une voix d'écart ou moins. Une seule motion est adoptée (`VTANR5L17V519`, 04/12/2024, 331 pour) ; les 22 autres ont au plus 271 pour. Le seuil de 289 est donc cohérent avec les données mais **non éprouvé près de la limite** (aucune motion entre 272 et 330 voix) ; il vient du texte constitutionnel et de `syntheseVote.nbrSuffragesRequis = 289` dans les données officielles. Les « motions de rejet préalable » (scrutin ordinaire) suivent bien la règle générale.

Le script accepte `--source=export` (export public au lieu de l'API), `--officiel=<chemin ou URL>`, `--min=200`, `--sortie=<fichier>` ; il sort en erreur s'il compare moins de 200 scrutins, s'il y a une exception ou si le nombre de motions repérées par le titre diffère du nombre de `MOC` officiels. Derrière un proxy : `NODE_USE_ENV_PROXY=1`.

Remarque de données : pour `VTANR5L17V1` (première motion), NosParlementaires donne 21 non-votants, l'archive officielle 10 ; le sort n'en dépend pas.

## Classement des titres (pour `classify.ts`, indicatif)

Mesuré sur les 8 877 titres. Le classement par préfixe du titre donne : votes sur l'ensemble `l'ensemble …` (ou `l’ensemble …`) 225, motions de censure 23, amendements (dont sous-amendements) 7 589, articles 936, autres 104 (motions de rejet préalable, propositions de résolution, déclarations de politique générale, prolongation de séance).

- **31 dossiers n'ont aucun vote « l'ensemble » mais un vote `l'article unique du projet de loi/de la proposition de loi …`** (textes à article unique : ratifications, etc.). Pour que ces lois apparaissent, `classer()` doit traiter « l'article unique de/du projet de loi|proposition de loi » comme `final`. Les 47 titres `l'article unique …` comprennent aussi des propositions de résolution.
- Lectures dans le titre des votes sur l'ensemble : « première lecture » 151, « deuxième lecture » 17, « nouvelle lecture » 4, « lecture définitive » 3, aucune 50.
- `title__contains=ensemble` (229 lignes) et `title__contains=l'ensemble` (219) ont les mêmes 4 faux positifs (`V915`, `V916`, `V917` : amendement et article d'une proposition de loi sur les vignes ; `V7003` : un article unique dont le titre contient « l'ensemble des compétences ») : le préfixe `^l['’]ensemble ` doit être vérifié dans le BFF. La requête du plan manque en plus les 10 votes finaux à apostrophe typographique.

## Fixtures

`src/server/fixtures/source/` : **305 571 octets** (limite : 400 Ko). Les réponses de l'API tabulaire sont enregistrées telles que reçues, **minifiées** (les espaces de mise en forme sont retirés ; contenu identique) ; un fichier par requête. Les sélections portent sur le même univers cohérent.

| Fichier | Requête (`/api/resources/<rid>/data/?…`) |
|---|---|
| `scrutins__title-contains-l-ensemble__date-sort-desc__page_size-12.json` | scrutins : `title__contains=l'ensemble&date__sort=desc&page_size=12` (les 12 votes finaux récents : `V8695, V8694, V8693, V8434, V8433, V8431, V8430, V8427, V8421, V8419, V8418, V8279`) |
| `scrutins__title-contains-l-ensemble-apostrophe-typographique__date-sort-desc.json` | `title__contains=l’ensemble&date__sort=desc&page_size=20` (10 votes finaux que la requête précédente ne voit pas : preuve du piège) |
| `scrutins__id-in-motion-3-articles-3-amendements.json` | `id__in=V519,V8290,V8291,V8292,V8385,V8399,V8408` : 1 motion de censure (`V519`, la seule adoptée), 3 amendements et 3 articles du même texte (`DLR5L17N54372`, projet de loi relatif à la protection des enfants, aussi vote final `V8430`) |
| `scrutins__dossier_ref-exact-DLR5L17N52746__date-sort-desc.json` | texte à plusieurs lectures : deux votes sur l'ensemble (`V5240` le 28/01/2026 puis `V8434` le 21/07/2026) et 13 autres scrutins |
| `scrutins__dossier_ref-exact-DLR5L17N54096.json` | texte sans autre scrutin que le vote final (`V8695`) |
| `scrutins__title-contains-motion-de-censure__page_size-1.json` | exemple de comptage par `meta.total` (23 motions) |
| `deputes__active-exact-true__page-1.json` … `-3.json` | `active__exact=true&columns=slug,first_name,last_name,full_name,group_short,department_code,constituency_label&page=n&page_size=200` (574 actifs) |
| `datan-deputes__page-1.json` … `-3.json` | `columns=id,nom,prenom,departementCode,scoreParticipation,scoreLoyaute&page=n&page_size=200` (574 lignes ; ce sont **toutes** les lignes Datan, donc aussi celles des 12 votes) |
| `datan-groupes.json` | `columns=id,libelle,libelleAbrev,couleurAssociee,effectif` (12 groupes) |
| `votes__NON-SERVI__scrutin_id-exact-VTANR5L17V8695.json` | la réponse vide qui prouve que les votes ne sont pas servis |
| `ressources.json` | `{ besoin → rid }` |
| `export/votes_an__<scrutin>.json` (20 fichiers) | **Pas une réponse de l'API tabulaire.** Extrait de l'export public `votes_an.json.gz` du 19/10/2026 pour les 12 votes finaux, la motion `V519`, les 3 amendements, les 3 articles et le premier vote `V5240` du texte à deux lectures. Les lignes `{scrutin_id, deputy_slug, position}` sont **regroupées par position** (`{"POUR":[slugs…], "CONTRE":[…], "ABSTENTION":[…], "NONVOTANT":[…]}`) pour tenir dans la limite de taille (4 597 lignes pour les 12 votes finaux, 5 512 pour les 20 fichiers). |

Contrôle de cohérence fait à la génération : pour chacun des 20 scrutins, le nombre de `POUR`, `CONTRE` et `ABSTENTION` des votes égale celui du scrutin servi par l'API. Les 12 votes finaux comptent 79 votes (1,7 %) d'anciens députés, qui ne sont pas dans l'index des actifs (voir « Écarts » §4). Les fichiers `export/` ne servent que si le repli est retenu ; sinon, les supprimer. Le dossier est dans `.prettierignore` (réponses minifiées, à ne pas reformater).

Les requêtes `deputy_slug__exact=…&position__exact=ABSTENTION` (comptage) et `scrutin_id__in=<10 ids>` n'ont pas de fixture : elles renvoient `total = 0` (voir la fixture `NON-SERVI`).

## Coût réel en requêtes de chaque route

Hypothèses : requêtes à froid, `page_size=200` partout (maximum), `columns=` pour réduire les charges. Statistiques sur la législature : médiane de 177 votes par vote final (p90 545, max 574) ; les 10 votes finaux les plus récents (page 1 de l'accueil) comptent 3 598 lignes de votes (18 pages de 200), la page 2 en compte 4 825 (25 pages) ; un scrutin quelconque a 132 votes (médiane) ; un dossier a 5 scrutins (médiane), 55 (p90), 906 (max, « aide à mourir »).

| Route BFF | Plan (PLAN.md) | **Réel avec l'API tabulaire seule** | **Avec le repli** (votes lus dans l'export) |
|---|---|---|---|
| `GET /api/accueil?page=n` | 1 scrutins + ~29 votes + index (cache) | Impossible (aucun vote). Si les votes étaient servis : 1 + 18 à 25 pages de votes (pas ~29) | **1** scrutins (`title__contains=ensemble&date__sort=desc&page_size=200`, 70 Ko, sert 20 pages de 10 ; filtrage `^l['’]ensemble ` dans le BFF) + index des députés (cache 6 h : 3 actifs + 1 `slug__in` des anciens votants, ou 11 pour l'index complet) + 1 groupes Datan (cache 1 j) |
| `GET /api/lois/:dossier` | scrutins (1-2) + votes du vote final (3) | scrutins : 1 page pour 90 % des dossiers, jusqu'à 5 pour « aide à mourir » (utiliser `title__notcontains=amendement` : 60 lignes au lieu de 893, puis les amendements à la demande) ; votes : impossible | **1** (1 à 5 pour les très gros dossiers) ; votes en mémoire |
| `GET /api/scrutins/:numero` | scrutin (1) + votes (3) | 1 (`id__exact`) ; votes : impossible | **1** (+ index en cache) |
| `GET /api/deputes` | députés (3) + Datan (3) | **3 + 3**, plus **1** pour les groupes (couleurs) = 7. Totalement faisable aujourd'hui | idem : **7** |
| `GET /api/deputes/:slug` | député (1) + Datan (1) + votes (1) + 2 comptages | député 1 (`slug__exact`) + Datan 1 (`nom__exact&prenom__exact`) ; votes et comptages : impossibles ; si servis : `position__groupby&position__count` ferait 1 comptage au lieu de 2 (non testé sur les votes) | **2** (ou 0 si l'index `/api/deputes` est en cache) + `id__in` des 10 derniers votes finaux (1, ou 0 depuis le cache de l'accueil) ; votes et abstention en mémoire |

Coût mémoire du repli : le JSON de l'export fait 119 Mo décompressés (1,3 M d'objets), trop pour un parse naïf dans une fonction Vercel ; le **CSV gzip** (5,6 Mo, 51 Mo décompressés) se lit en flux, une ligne à la fois, et s'indexe par scrutin (`Map<scrutin_id, Uint16Array…>`) en quelques dizaines de Mo. Téléchargement mesuré : 1,3 s pour 5,6 Mo, décompression 0,2 s. `HEAD` + `If-None-Match` (ETag) répond `304` : le rafraîchissement quotidien est peu coûteux.

## Écarts avec PLAN.md et CONTRAT.md (propositions, rien n'est modifié)

1. **PLAN, « Source » et « Point de décision »** : les votes individuels ne sont pas servis par l'API tabulaire. Il faut le repli (exports publics en mémoire, même couche `source/`) ou obtenir de NosParlementaires un `votes_an.csv` non compressé. À trancher par l'utilisateur.
2. **PLAN, requête `title__contains=l'ensemble`** : elle manque les votes finaux écrits avec l'apostrophe typographique `’` (**10 des 225** votes finaux de la législature, dont `V2874`, `V3018` et `V7494`, le plus récent, du 24/06/2026) et renvoie 4 faux positifs sur 219 (titres d'amendement ou d'article qui contiennent « l'ensemble » plus loin : `V915`, `V916`, `V917`, `V7003`). Utiliser `title__contains=ensemble` (229 lignes : les 225 votes finaux et les 4 mêmes faux positifs) puis filtrer côté BFF par `^l['’]ensemble ` (+ `^l['’]article unique de(s)? ` pour les 31 dossiers sans vote sur l'ensemble). `or=` n'aide pas (voir ci-dessus).
3. **PLAN, `date__sort=desc&page_size=10` + « Voir plus »** : la pagination côté API est instable sur les ex æquo (doublons, trous). Faire une requête de 200 lignes, trier et paginer dans le BFF.
4. **PLAN, « index des députés (en cache) » = députés actifs** : insuffisant. 78 des 652 députés qui ont voté sont **inactifs** (anciens députés) : **84 795 votes sur 1 323 978 (6,4 %)**, dont 40 ex-députés n'ont **aucun groupe** (`group_short` nul) et 38 en ont un. Avec l'index des actifs seulement, ces votes tombent dans « NI » à tort, et les tableaux par groupe sont faux. Pour la ventilation, utiliser l'**index complet** (2 128 lignes, 11 pages) ou ajouter les votants absents de l'index des actifs par `slug__in`. À rapprocher de la règle du contrat « un député sans groupe connu va dans NI » : elle masque ce problème. Mettre un avertissement dans `/a-propos`.
5. **CONTRAT, `Groupe.libelle`** : Datan donne « Non inscrit » (singulier) pour NI, le contrat « Non inscrits ». Les couleurs et libellés peuvent venir de Datan (`couleurAssociee`), ce qui supprime la table en dur de `groupes.ts` (le prompt dit « s'il existe » : il existe).
6. **PLAN, `page_size` maximum « 200 ? »** : confirmé, 200. Limite de débit : aucune observée jusqu'à 5 req/s ; **limiteur à 5/s** plutôt que 10/s tant que ce n'est pas mesuré. Les erreurs à gérer en plus de 429 et 503 : `500` (page hors limites), `502` (Datan lent), `414` (liste `__in` trop longue), coupures de connexion.
7. **CONTRAT, `ScrutinResume.date` : « ISO 8601, jour du scrutin »** : l'API tabulaire renvoie `2026-10-16T00:00:00+02:00` (minuit à Paris), l'export JSON renvoie `2026-10-15T22:00:00+00:00` (le même instant en UTC). Lire le jour par `date.slice(0, 10)` sur la valeur de l'API tabulaire ; si on lit l'export, convertir en `Europe/Paris` avant de prendre le jour (sans quoi la date est celle de la veille). Les exemples de PLAN.md (`2024-10-07T22:00:00+00:00`) sont ceux de l'export.
8. **CONTRAT, `miseAJour`** : l'API tabulaire ne donne pas de date de génération. Sources possibles : `manifest.json` (`generated_at`), la colonne `dateMaj` de Datan, ou la métadonnée `analysis:parsing:finished_at` de data.gouv.fr (`GET /api/1/datasets/<id>/`). Sinon la date de la réponse, comme prévu.
9. **Stabilité des `rid`** : le jeu NosParlementaires est publié en trois exemplaires. Proposition : le BFF résout le `rid` au démarrage par `GET https://www.data.gouv.fr/api/1/datasets/6a86f9a3a570a6bc4b9f7ef4/` (champ `resources[]`, filtre sur `url` finissant par `/scrutins_an.csv` ou `/deputes.csv`, tri par `extras["analysis:parsing:finished_at"]` décroissant) avec les `rid` ci-dessus en secours ; pour Datan, par `organization`/jeu de données. `RID_SCRUTINS`, `RID_DEPUTES`, `RID_DATAN_DEPUTES` restent surchargeables par variable d'environnement.
10. **CONTRAT, `taux.abstention`** : calculable seulement avec les votes (en mémoire avec le repli). La formule `abstentions / (pour + contre + abstention)` suppose d'exclure `NONVOTANT`. `taux.participation` vient de `scoreParticipation` de Datan et se définit comme « part des scrutins publics auxquels le député a pris part » (voir plus haut).
11. **Observation hors périmètre** : l'archive officielle `Scrutins.json.zip` (27,5 Mo, 8 877 fichiers) contient, scrutin par scrutin, la ventilation par **groupe à la date du vote** (`organeRef` du groupe) et les identifiants `PA…` de chaque votant. Elle résoudrait la limite « groupe actuel » et la jointure NosParlementaires ↔ Datan, mais pèse 27 Mo et ne se prête pas à une lecture à la demande ; je ne la propose pas pour le BFF, seulement comme piste si l'on veut un jour le groupe au moment du vote.
12. **PLAN, `RID_DATAN_GROUPES` « pas encore lu par le BFF »** : il est utile (couleurs, libellés, 12 groupes dont NI).

## Limites des mesures et ce qui n'a pas été fait

- **Coupures de connexion** : environ 3 % des requêtes ont été coupées par le proxy de l'environnement (`ws_closed_mid_exchange`, 7 à 13 s) et reprises avec 2, 4, 8, 16 s d'attente. Les latences ci-dessus sont celles des requêtes abouties ; les délais de reprise ne sont pas comptés. Ces coupures ne sont pas imputables à l'API et ne disent rien de sa disponibilité depuis un autre réseau.
- **Débit au-delà de 5 req/s non mesuré** (consigne) ; en l'absence d'en-têtes `RateLimit-*`, la limite éventuelle reste inconnue.
- **Votes individuels** : aucune requête sur `scrutin_id__in`, `deputy_slug__exact` ou `position__exact` n'a pu être vérifiée au-delà de la réponse vide ; la longueur maximale d'une liste `__in` a été mesurée sur la ressource des scrutins (même moteur et même limite d'URL), pas sur les votes.
- **Jointure avec les anciens députés** : non testée (Datan « Historique des députés » existe, 2 128 lignes).
- **`or=`** : aucune syntaxe acceptée n'a été trouvée avec une apostrophe ; la documentation officielle (`datagouv/api-tabular`) n'a pas été relue dans cet environnement.
- **Seuil de 289 voix** pour les motions : jamais approché par les données (voir plus haut).
- Rien n'a été fait au-delà de ce que demande le prompt : aucun code applicatif, `docs/PLAN.md`, `docs/CONTRAT.md` et `CLAUDE.md` inchangés.
