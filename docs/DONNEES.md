# Format des données préparées (`data/`)

`npm run donnees` (script `scripts/donnees/`) lit les deux archives officielles de l'Assemblée (voir PLAN.md) et écrit les fichiers ci-dessous dans `data/`. Le build les copie dans `dist/lois-votes/data/` ; le serveur les charge en mémoire au démarrage (`src/server/donnees.ts`). `DONNEES_DEPUIS=fixtures` lit à la place le mini-jeu `src/server/fixtures/officiel/` (régénéré par `node scripts/donnees/fixtures.mjs`).

**Ce document a été vérifié sur les vraies archives** (celles du 19/10/2026 : 8 877 scrutins, 3 175 acteurs, 10 819 organes). Chaque écart avec la première version de la spécification est listé en bas, dans « Écarts constatés ». Les types TypeScript des fichiers sont dans `src/server/donnees.types.ts`, partagé par le script et le serveur ; un test (`scripts/donnees/donnees.spec.ts`) vérifie que la sortie du mode `fixtures` y est conforme, y compris la cohérence entre `scrutins.json` et les matrices. `DONNEES_DIR=data npm test` applique le même contrôle à un `data/` produit à partir des vraies archives.

Tous les fichiers sont du JSON compact (sans indentation), sauf `votes.txt` et `groupes-votes.txt`. Dates en `AAAA-MM-JJ`.

## `meta.json`

```json
{ "genereLe": "2026-10-19T05:41:02Z", "scrutins": 8877, "deputes": 652, "groupes": 13,
  "sources": { "scrutins": { "url": "…", "lastModified": "Mon, 19 Oct 2026 04:25:16 GMT", "etag": "\"…\"" }, "acteurs": { "url": "…", "lastModified": "…", "etag": "…" } },
  "statistiques": { "adoptes": 3031, "rejetes": 5846, "sansDossier": 5826, "misesAuPoint": 1636, "groupesRattaches": 134, "nonVotantsCorriges": [1] } }
```

- En mode `fixtures`, `sources.*.url` est le dossier des fixtures et `lastModified` et `etag` valent `null`.
- `statistiques` : `sansDossier` (scrutins sans `dossier`), `misesAuPoint` (scrutins dont la section `miseAuPoint` n'est pas vide, voir plus bas), `groupesRattaches` (entrées de groupe dont l'identifiant d'organe était `PO0`, rattachées à leur vrai groupe), `nonVotantsCorriges` (numéros des scrutins dont le nombre de non-votants a été remplacé par la somme des groupes).

## `groupes.json`

Tableau d'organes de type `GP` de la 17ᵉ législature qui apparaissent dans au moins un scrutin, **triés par préséance officielle, puis par date de début, puis par identifiant** (l'index d'un groupe est sa position dans ce tableau ; `scrutins.json` et `groupes-votes.txt` s'en servent). Au plus 36 groupes (un caractère par groupe dans `groupes-votes.txt`).

```json
[{ "id": "PO845401", "abrege": "RN", "libelle": "Rassemblement National", "couleur": "#313567", "debut": "2024-07-18", "fin": null }]
```

Observé : 13 organes (RN, EPR, LFI-NFP, SOC, DR, EcoS, Dem, HOR, LIOT, GDR, UDR, UDR, NI). `abrege` est le `libelleAbrege` officiel, avec sa casse (`EcoS`, `Dem`) ; le `libelleAbrev` officiel, lui, est en majuscules. Les abrégés ne sont pas uniques : `PO847173` « UDR » (2024-09-12 → 2025-09-04) et `PO872880` « Union des droites pour la République » (abrégé `UDR`, depuis 2025-09-05) ont la même couleur. Le groupe `AD` (`PO845520`, 2024-07-18 → 2024-09-11) n'apparaît dans aucun scrutin : il est absent. `couleur` est la `couleurAssociee` officielle (présente sur tous les groupes de la 17ᵉ).

L'identifiant `PO0` n'est pas un groupe : voir « Entrées de groupe `PO0` ».

## `deputes.json`

Tout acteur qui a voté au moins une fois sous la 17ᵉ législature (652 observés), dans l'ordre de leurs index (position = colonne dans les matrices), trié par `PA` (ordre alphabétique des chaînes).

```json
[{ "pa": "PA720468", "slug": "sebastien-chenu", "nom": "Sébastien Chenu", "nomTri": "Chenu",
   "groupe": "PO845401", "departement": "59", "circonscription": "Nord (19)", "actif": true }]
```

- `nom` : `prénom nom` de la fiche. Quand deux députés portent le même nom, l'Assemblée les distingue dans le nom lui-même : « Alexandra Martin (Alpes-Maritimes) » et « Alexandra Martin (Gironde) ». On garde cette précision dans `nom` (elle sert à les distinguer dans la recherche) ; `nomTri` est le nom de famille sans elle (« Martin »).
- `slug` : `nom` en minuscules, sans accents (`œ` → `oe`), tirets pour tout séparateur, soit `alexandra-martin-alpes-maritimes`. Suffixe `-2`, `-3`… (ordre des `PA`) si deux députés avaient exactement le même slug (cas non observé : testé sur des données de test). Stable d'un jour à l'autre tant que le jeu de PA et les noms ne changent pas : les liens partagés ne doivent pas casser.
- `groupe` : `id` du groupe **actuel**, c'est-à-dire du mandat `GP` de la 17ᵉ sans `dateFin` (le plus récent s'il y en a deux : 11 députés), sinon du dernier mandat terminé ; `null` si aucun (aucun cas observé). Seuls les groupes présents dans `groupes.json` sont retenus.
- `circonscription` : `election.lieu.departement` + `(numCirco)` du mandat `ASSEMBLEE` de la 17ᵉ (« Nord (19) », « Français établis hors de France (3) ») ; `departement` : `numDepartement` tel quel (`"59"`, `"2A"`, `"971"`, `"099"` pour les Français de l'étranger). Le mandat retenu est celui en cours, sinon le dernier : 29 députés ont plusieurs mandats `ASSEMBLEE` dans la législature (un membre du gouvernement perd son mandat à sa nomination et le retrouve ensuite). `actif` : au moins un de ces mandats est sans `dateFin` (574 observés).
- **Photo et fiche** se déduisent de `pa` : pas de champ. Attention : le fichier de la photo porte le **numéro sans le préfixe `PA`** (`…/photos/carre/720468.jpg`, 200 ; avec `PA720468.jpg`, 404), alors que la fiche garde le préfixe (`https://www.assemblee-nationale.fr/dyn/deputes/PA720468`).

## `scrutins.json`

Tableau trié par numéro **décroissant** (le plus récent d'abord), un élément par scrutin :

```json
{ "n": 8317, "date": "2026-07-16", "titre": "l'amendement n° 770 de Mme Parmentier à l'article premier du projet de loi relatif à la protection des enfants (première lecture).",
  "type": "amendement", "adopte": false, "dossier": "DLR5L17N54372",
  "compte": { "pour": 37, "contre": 87, "abstention": 0, "nonvotant": 2 },
  "groupes": [{ "g": 0, "position": "pour", "compte": { "pour": 33, "contre": 0, "abstention": 0, "nonvotant": 1 } }] }
```

- `n` : champ `numero`. `titre` : titre officiel, tel quel (avec son point final). `adopte` : `sort.code === 'adopté'`. `dossier` : `objet.dossierLegislatif.dossierRef` ou `null` (3 051 scrutins sur 8 877 en ont un, 5 826 non, dont 154 des 235 votes finaux). Les dossiers de la 16ᵉ législature (`DLR5L16N…`, 12 scrutins) sont conservés tels quels.
- `type` : `classerTous` de `src/shared/classer.ts` (final, motion, article, amendement, autre). Une motion de censure est reconnue par `typeVote.codeTypeVote === 'MOC'` ou par le titre ; le classement des titres est décrit dans PLAN.md. « L'article unique » d'un projet ou d'une proposition de loi compte comme `final` quand le texte (même titre, même lecture) n'a ni vote sur l'ensemble ni vote sur un autre article ; une proposition de résolution n'est pas une loi, son article unique reste un `article`, et le vote sur l'ensemble d'une résolution est `autre`.
- `compte` : `syntheseVote.decompte` (`nonvotant` = `nonVotants` ; les abstentions comprennent les « non-votants volontaires », voir plus bas). Seule exception : si le nombre de non-votants annoncé diffère de la somme des groupes, on garde la somme des groupes (observé : le scrutin 1, 10 annoncés contre 21 listés) et le script le consigne dans `meta.statistiques.nonVotantsCorriges` ; au-delà de 5 scrutins, il échoue.
- `groupes` : `g` est l'index dans `groupes.json`, par ordre croissant ; `compte` le `decompteVoix` du groupe ; `position` la position majoritaire du groupe **calculée par nous** sur ses suffrages exprimés : la position (pour, contre, abstention) qui a le plus de voix, `partage` quand deux positions sont à égalité en tête, `nonvotant` quand le groupe n'a aucun suffrage exprimé. Le champ officiel `positionMajoritaire` n'est pas utilisé (voir « Écarts constatés »). La somme des groupes égale `compte` ; sinon le script échoue.
- Un groupe sans aucun député listé dans le scrutin garde une entrée avec un `compte` à zéro (c'est le cas de l'archive) ; une entrée `PO0` sans aucun député est écartée.
- Le titre court, la lecture et le regroupement par loi se calculent au chargement (`classify.ts`, qui réexporte `src/shared/classer.ts`), pas dans ce fichier.

## `votes.txt` et `groupes-votes.txt`

Un fichier texte par matrice, **une ligne par scrutin, dans l'ordre de `scrutins.json`**, **un caractère par député, dans l'ordre de `deputes.json`**, lignes séparées par `\n` (pas de saut de ligne final).

- `votes.txt` :
  - `P` pour, `C` contre, `A` abstention (les « non-votants volontaires » y sont, voir plus bas), `N` non-votant : le député figure dans la liste des non-votants du scrutin (président de séance, membre du gouvernement, ou député présent qui n'a pas voté) ;
  - `X` : **absent**. Le député est en mandat ce jour-là (un mandat `ASSEMBLEE` de la 17ᵉ couvre la date du scrutin, bornes comprises) mais ne figure dans aucune liste ;
  - `-` : le député n'est pas en mandat à cette date.
- `groupes-votes.txt` : pour chaque case `P`, `C`, `A` ou `N`, un caractère qui code l'index du groupe **au jour du vote** (`0`-`9`, puis `a`-`z`), d'après la ventilation du scrutin. Pour une case `X`, le groupe de ses mandats ce jour-là s'il figure dans le scrutin, sinon `-`. `-` pour une case `-`. Même longueur que `votes.txt`.
- Mises au point (`miseAuPoint`, dont `dysfonctionnement`) : les listes nominatives de `ventilationVotes` sont la référence ; les mises au point ne sont **pas** appliquées. Elles concernent **1 636 scrutins sur 8 877 (18 %)** : 1 534 avec des mises au point et 102 avec seulement des dysfonctionnements de boîtier. C'est fréquent : à signaler dans `/a-propos`.

Taille observée : 5,8 Mo bruts par matrice (`votes.txt` 0,73 Mo en gzip, `groupes-votes.txt` 0,03 Mo). Le serveur les garde en mémoire sous forme de chaînes ; accès à la position du député `i` au scrutin `s` : `votes[s][i]`.

## Entrées de groupe `PO0`

Dans 14 scrutins (146 entrées de groupe au total), l'archive ne renseigne pas l'organe du groupe : `organeRef` vaut `PO0`. Ce n'est pas un groupe de députés sans étiquette : c'est un identifiant manquant (voir « Écarts constatés »). Dans 12 scrutins du 2 décembre 2024 (489, 491 à 501) toutes les entrées sont `PO0` ; dans les scrutins 1302 et 6256, seule l'entrée du Rassemblement National l'est. Le script rattache chaque entrée à son vrai groupe : celui que ses députés ont ce jour-là d'après leurs mandats `GP` (en pratique, tous les députés d'une entrée sont dans le même groupe). Il échoue si la majorité stricte des députés de l'entrée ne désigne pas un groupe, ou si deux entrées désignent le même groupe. Une entrée sans aucun député listé (12 cas) n'a rien à compter : elle est écartée.

## Garde-fous (le script échoue si…)

- moins de 8 000 scrutins ou moins de 570 députés (seuils levés en mode `fixtures`) ;
- le téléchargement n'a pas répondu 200, est incomplet, ou fait moins de 1 Mo ;
- un votant (`acteurRef`) sans fiche dans l'archive des acteurs ;
- un `sort.code` autre que `adopté` / `rejeté` ;
- une liste nominative dont la longueur diffère du `decompteVoix` de son groupe ;
- la somme des groupes ≠ le décompte du scrutin pour les pour, les contre ou les abstentions (pour les non-votants : corrigé jusqu'à 5 scrutins, voir `scrutins.json`) ;
- une entrée de groupe `PO0` ou inconnue impossible à rattacher, ou deux entrées pour le même groupe ;
- plus de 36 groupes ;
- deux députés avec le même `slug` ;
- une matrice dont une ligne n'a pas exactement `deputes.length` caractères, ou dont le nombre de lignes diffère de celui des scrutins.

## Calculs faits par le serveur (`agregation.ts`)

- Participation d'un député = (P + C + A) / (P + C + A + N + X) sur les scrutins où sa case n'est pas `-` (là où il était en mandat). Abstention = A / (P + C + A). Loyauté = nombre de votes P/C/A égaux à la `position` majoritaire du groupe du député **à ce scrutin** (hors `partage` et `nonvotant`) / nombre de ces votes. `null` si le dénominateur est nul. Sur les données réelles, la participation d'un député va de 0 % à 89 % (médiane 22 %) : la plupart des scrutins (amendements) n'ont que 100 à 150 votants.
- 10 derniers votes d'un député : les 10 derniers scrutins de type `final` (ordre de `scrutins.json`) où sa case n'est pas `-`. Une case `X` donne `position: null` (absent).

## Écarts constatés

Vérification faite sur les archives du 19/10/2026 (`Scrutins.json.zip` : 27,6 Mo, 181 Mo décompressés, 8 877 fichiers ; archive des acteurs : 13,7 Mo, 87 Mo d'acteurs et 8 Mo d'organes). Chaque ligne est un écart avec la première version de ce document.

| Affirmation de la spec | Réalité observée | Traitement |
|---|---|---|
| 8 806 scrutins, 3 018 adoptés, 5 788 rejetés, 2 980 avec un dossier, 1 317 652 positions | Les chiffres avancent avec l'archive : 8 877 scrutins, 3 031 adoptés, 5 846 rejetés, 3 051 avec un dossier, 1 323 978 positions. Les 652 votants, tous présents dans l'archive des acteurs, et les 348 qui changent de groupe sont confirmés. | Chiffres mis à jour. |
| Le groupe `PO0` apparaît dans 146 scrutins, sans fiche d'organe. | `PO0` apparaît dans **14 scrutins**, 146 fois : plusieurs entrées d'un même scrutin le portent (12 dans le 2 décembre 2024). Ce n'est pas un groupe mais un `organeRef` manquant : les députés de chaque entrée sont tous du même vrai groupe (le RN dans 1302 et 6256). Le site de l'Assemblée affiche les bons groupes. | Rattachement par les mandats `GP` (134 entrées), 12 entrées vides écartées. |
| `position` = `positionMajoritaire` officielle (`partage` si absente ou à égalité). | Le champ est toujours présent et vaut `pour`, `contre` ou `abstention` : jamais `partage`. Il **ne suit pas les votes** : sur 96 977 entrées de groupe qui ont au moins un suffrage, il diffère de la position en tête dans 5 164 cas (5,3 %), dont 3 129 où une seule position est en tête et ce n'est pas celle-là : par exemple « pour » avec 7 pour, 11 contre, 4 abstentions (scrutin 3004, SOC). Et il vaut « pour » dans 9 547 entrées où personne n'a exprimé de suffrage. Il n'est pas expliqué par les mises au point ni les délégations, et le site de l'Assemblée ne l'affiche pas. | `position` est **calculée** à partir de `decompteVoix` (voir `scrutins.json`). La définition du contrat (« position majoritaire, `partage` à égalité ») est ainsi respectée. |
| `N` : non-votant « y compris les non-votants volontaires ». | `nonVotantsVolontaires` n'est pas un sous-ensemble des non-votants : dans chacun des 14 625 groupes où il est non nul (tous ceux qui ont des abstentions), il **égale** `abstentions`. Les non-votants volontaires sont les abstentions : leurs noms sont dans la liste `abstentions`, pas dans `nonVotants`. Au niveau du scrutin, `nonVotantsVolontaires` vaut toujours 0. | Rien à ajouter : ils sont déjà `A`. La spec est corrigée. |
| `-` : le député n'est dans aucune liste (pas membre à cette date). | Les listes ne contiennent que les députés présents ou non-votants : en médiane, 132 des 577 députés sont listés par scrutin. Un député absent n'est dans aucune liste, comme un non-membre. Avec cette seule règle, la participation (votes exprimés sur scrutins où le député était membre) serait calculée sur les seuls scrutins où il est listé : médiane de 100 % (mesurée sur les données), alors que la vraie médiane est de 22 %. | Nouveau caractère `X` (membre absent), `-` ne signifie plus que « pas en mandat ». Le mandat sert à les distinguer ; aucune case listée n'est hors mandat (0 sur 1 323 978), ce qui valide les dates. |
| Les listes à un seul élément sont des objets. | Confirmé : 37 372 `votant` isolés. `groupe` est toujours un tableau (au moins 12 groupes). Un acteur peut avoir un seul `mandat` (objet, 5 cas). Les listes vides sont `null`, et dans `miseAuPoint` des tableaux de `null` (`[null, null]`) ou `[null, {votant}]`. | `liste()` de `lire.mjs`. |
| L'identifiant d'un acteur est une chaîne. | `acteur.uid` est un objet `{ "@xsi:type": …, "#text": "PA720468" }`. | `lireActeur`. |
| Les mises au point sont à mesurer. | `miseAuPoint` : 1 534 scrutins (17 %) ont des députés dans ses listes, 102 de plus n'ont qu'un `dysfonctionnement` : 1 636 au total (18 %). | Non appliquées, comptées dans `meta.json`. À signaler dans `/a-propos`. |
| La somme des groupes égale le décompte de chaque scrutin. | Vrai pour tous, sauf le scrutin 1 (première motion de censure) : 10 non-votants annoncés, 21 dans les groupes. Pour, contre et abstentions concordent. Les listes nominatives concordent avec les `decompteVoix` partout. | Tolérance documentée (somme des groupes), au plus 5 scrutins. |
| Homonymes : suffixe `-2`, `-3`. | Aucun homonyme exact (`prénom nom`) : l'Assemblée précise elle-même dans le nom (« Alexandra Martin (Alpes-Maritimes) » / « (Gironde) »). Le slug garde cette précision ; le suffixe n'a jamais servi. D'autres noms ont des caractères spéciaux (« K/Bidi »). | `nom` garde la précision, `nomTri` la retire, le suffixe reste en secours. |
| `photo` se déduit de `pa`. | Le fichier de photo porte le numéro **sans** `PA`. | Documenté ci-dessus ; à appliquer dans `agregation.ts`. |
| Les listes de scrutins ont tous leurs groupes. | Chaque vrai groupe figure dans tous les scrutins de sa période d'existence (`UDR` ancien : 3 041 scrutins, nouveau : 5 824 ; `AD` : jamais). Les seuls trous sont les 14 scrutins `PO0` (RN absent de la liste sous son nom). Aucun scrutin n'a de groupe unique en objet. | Aucun traitement particulier. |
| Types de scrutin. | `SPO` 8 780, `SPS` 74, `MOC` 23 : les 23 motions de censure (toutes `MOC`) ont un titre « la motion de censure… ». Des votes sur l'ensemble d'un texte sont écrits sans « l'ensemble » (« la proposition de loi… (première lecture). », 3 cas) ou avec une faute (« l'ensemble de de la… », 1 cas). | `classerTous`. |
| Archive régénérée chaque nuit, avec ETag. | Vrai, mais le CDN sert parfois deux versions du fichier : le même jour, `Last-Modified` 04:25:16 GMT (27 563 304 octets, ETag `"1a49528-…"`) et 10:25:07 GMT (27 563 289 octets, ETag `"1a49519-…"`). Les deux sont valides et donnent les mêmes effectifs (8 877 scrutins, 3 031 adoptés) ; elles ne diffèrent que par le scrutin 8805, corrigé entre-temps : l'archive est donc republiée en cours de journée. | `If-None-Match` fonctionne ; un changement d'ETag télécharge à nouveau (27 Mo). |

### Ce que la spec n'avait pas prévu

- `positionMajoritaire` ne peut pas servir de source (voir ci-dessus). Si on préfère la position officielle à la position calculée, il suffit de lire le champ dans `lire.mjs` et de l'utiliser dans `construire.mjs` ; elle est déjà lue (`positionOfficielle`) mais ignorée.
- Les titres sont ceux de l'archive : ils finissent par un point, qui est retiré dans les titres courts.
- La liste `groupes.json` est ordonnée par préséance officielle ; l'ancien UDR (index 10) précède le nouveau (index 11) et les non-inscrits (préséance 99) sont derniers.
