# Format des données préparées (`data/`)

`npm run donnees` (script `scripts/donnees/`) lit les deux archives officielles de l'Assemblée (voir PLAN.md) et écrit les fichiers ci-dessous dans `data/`. Le build les copie dans `dist/lois-votes/data/` ; le serveur les charge en mémoire au démarrage (`src/server/donnees.ts`). `DONNEES_DEPUIS=fixtures` lit à la place le mini-jeu `src/server/fixtures/officiel/`.

**Ce document est la spécification de départ.** Il a été écrit d'après la lecture de quelques fichiers de l'archive. L'agent qui écrit le script **vérifie chaque point sur les vraies archives** et corrige ce document si la réalité diffère (il le signale dans son rapport). Les types TypeScript correspondants vont dans `src/server/donnees.types.ts`, partagé par le script et le serveur.

Tous les fichiers sont du JSON compact (sans indentation), sauf `votes.txt` et `groupes-votes.txt`. Dates en `AAAA-MM-JJ`.

## `meta.json`

```json
{ "genereLe": "2026-10-19T05:41:02Z", "scrutins": 8806, "deputes": 652, "groupes": 13,
  "sources": { "scrutins": { "url": "…", "lastModified": "…", "etag": "…" }, "acteurs": { "url": "…", "lastModified": "…", "etag": "…" } } }
```

## `groupes.json`

Tableau d'organes de type `GP` de la 17ᵉ législature qui apparaissent dans au moins un scrutin, **dans l'ordre de leurs numéros d'index** (l'index d'un groupe est sa position dans ce tableau ; `groupes-votes.txt` s'en sert).

```json
[{ "id": "PO845401", "abrege": "RN", "libelle": "Rassemblement National", "couleur": "#313567", "debut": "2024-07-18", "fin": null }]
```

Observé : 13 organes. Les abrégés ne sont pas uniques : `PO847173` « UDR » (2024-09-12 → 2025-09-04) et `PO872880` « Union des droites pour la République » (abrégé `UDR`, depuis 2025-09-05) ont la même couleur. Les abrégés officiels ont de la casse (`EcoS`, `Dem`). Le groupe `PO0` apparaît dans 146 scrutins sans fiche d'organe : **à examiner** (probablement un groupe regroupant des députés sans groupe ; le script décide, documente et teste le traitement, par exemple « Non inscrit »).

## `deputes.json`

Tout acteur qui a voté au moins une fois sous la 17ᵉ législature (652 observés), dans l'ordre de leurs index (position = colonne dans `votes.txt`), trié par `PA`.

```json
[{ "pa": "PA720468", "slug": "sebastien-chenu", "nom": "Sébastien Chenu", "nomTri": "Chenu",
   "groupe": "PO845401", "departement": "59", "circonscription": "Nord (19)", "actif": true }]
```

- `slug` : `prenom-nom` en minuscules, sans accents, tirets pour tout séparateur ; suffixe `-2`, `-3`… (ordre des `PA`) en cas d'homonymes. Stable d'un jour à l'autre tant que le jeu de PA ne change pas : les liens partagés ne doivent pas casser.
- `groupe` : organe de groupe **actuel** (mandat `GP` de la 17ᵉ sans `dateFin`), sinon le dernier en date ; `null` si aucun.
- `circonscription` : `election.lieu.departement` + `(numCirco)` du mandat `ASSEMBLEE` de la 17ᵉ (« Nord (19) ») ; `departement` : `numDepartement`. `actif` : ce mandat n'a pas de `dateFin`.
- `photo` et `urlFiche` se déduisent de `pa` : pas de champ.

## `scrutins.json`

Tableau trié par numéro **décroissant** (le plus récent d'abord), un élément par scrutin :

```json
{ "n": 8317, "date": "2026-07-16", "titre": "l'amendement n° 770 de Mme Parmentier à l'article premier du projet de loi relatif à la protection des enfants",
  "type": "amendement", "adopte": false, "dossier": "DLR5L17N54372",
  "compte": { "pour": 37, "contre": 87, "abstention": 0, "nonvotant": 2 },
  "groupes": [{ "g": 0, "position": "pour", "compte": { "pour": 33, "contre": 0, "abstention": 0, "nonvotant": 1 } }] }
```

- `n` : champ `numero`. `type` : `classer(titre)` (final, motion, article, amendement, autre) ; une motion de censure est reconnue par `typeVote.codeTypeVote === 'MOC'` ou par le titre. `adopte` : `sort.code === 'adopté'`. `dossier` : `objet.dossierLegislatif.dossierRef` ou `null` (2 980 sur 8 806 en ont un). Les dossiers de la 16ᵉ législature (`DLR5L16N…`) sont conservés tels quels.
- `compte` : `syntheseVote.decompte` (`nonvotant` = `nonVotants`). Pour les groupes : `g` est l'index dans `groupes.json`, `position` la `positionMajoritaire` officielle (`partage` si absente ou à égalité), `compte` le `decompteVoix` du groupe. La somme des groupes égale `compte` ; sinon le script échoue.
- Le titre court, la lecture et le regroupement par loi se calculent au chargement (`classify.ts`), pas dans ce fichier.

## `votes.txt` et `groupes-votes.txt`

Un fichier texte par matrice, **une ligne par scrutin, dans l'ordre de `scrutins.json`**, **un caractère par député, dans l'ordre de `deputes.json`**, lignes séparées par `\n`.

- `votes.txt` : `P` pour, `C` contre, `A` abstention, `N` non-votant (présent dans la liste des non-votants, y compris les non-votants volontaires), `-` : le député n'est dans aucune liste de ce scrutin (pas membre à cette date).
- `groupes-votes.txt` : pour chaque case non `-`, un caractère qui code l'index du groupe **au jour du vote** (`0`-`9`, puis `a`-`z`) ; `-` sinon. Même longueur que `votes.txt`.
- Mises au point (`miseAuPoint`) : les listes nominatives de `ventilationVotes` sont la référence ; les mises au point ne sont **pas** appliquées (limite à signaler dans `/a-propos` si elles sont fréquentes ; l'agent mesure combien de scrutins sont concernés).

Taille observée : 5,7 Mo bruts par matrice (0,66 Mo compressés). Le serveur les garde en mémoire sous forme de chaînes ; accès à la position du député `i` au scrutin `s` : `votes[s][i]`.

## Garde-fous (le script échoue si…)

- moins de 8 000 scrutins ou moins de 570 députés ;
- un votant (`acteurRef`) sans fiche dans l'archive des acteurs ;
- un `sort.code` autre que `adopté` / `rejeté` ;
- la somme des décomptes des groupes ≠ le décompte du scrutin ;
- deux députés avec le même `slug` ;
- une matrice dont une ligne n'a pas exactement `deputes.length` caractères.

## Calculs faits par le serveur (`agregation.ts`)

- Participation d'un député = (P + C + A) / (P + C + A + N) sur les scrutins où sa case n'est pas `-`. Abstention = A / (P + C + A). Loyauté = nombre de votes P/C/A égaux à la `position` majoritaire du groupe du député **à ce scrutin** (hors `partage`) / nombre de ces votes. `null` si le dénominateur est nul.
- 10 derniers votes d'un député : les 10 derniers scrutins de type `final` (ordre de `scrutins.json`) où sa case n'est pas `-`.
