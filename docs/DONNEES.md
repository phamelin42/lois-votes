# Format des données préparées (`data/`)

`npm run donnees` (script `scripts/donnees/`) lit les deux archives officielles de l'Assemblée (voir PLAN.md), interroge Wikidata pour les liens Wikipédia (seule source non officielle, facultative : voir « Liens Wikipédia ») et écrit les fichiers ci-dessous dans `data/`. Le build les copie dans `dist/lois-votes/data/` ; le serveur les charge en mémoire au démarrage (`src/server/donnees.ts`). `DONNEES_DEPUIS=fixtures` lit à la place le mini-jeu `src/server/fixtures/officiel/` (régénéré par `node scripts/donnees/fixtures.mjs`).

**Ce document a été vérifié sur les vraies archives** (celles du 19/10/2026 : 8 877 scrutins, 3 175 acteurs, 10 819 organes). Chaque écart avec la première version de la spécification est listé en bas, dans « Écarts constatés ». Les types TypeScript des fichiers sont dans `src/server/donnees.types.ts`, partagé par le script et le serveur ; un test (`scripts/donnees/donnees.spec.ts`) vérifie que la sortie du mode `fixtures` y est conforme, y compris la cohérence entre `scrutins.json` et les matrices. `DONNEES_DIR=data npm test` applique le même contrôle à un `data/` produit à partir des vraies archives.

Tous les fichiers sont du JSON compact (sans indentation), sauf `votes.txt` et `groupes-votes.txt`. Dates en `AAAA-MM-JJ`.

## `meta.json`

```json
{ "genereLe": "2026-10-19T05:41:02Z", "scrutins": 8877, "deputes": 652, "groupes": 13,
  "autresGroupes": [{ "id": "PO845520", "abrege": "AD", "libelle": "À Droite", "couleur": "#3367A7", "debut": "2024-07-18", "fin": "2024-09-11" }],
  "avertissements": [],
  "sources": { "scrutins": { "url": "…", "lastModified": "Mon, 19 Oct 2026 04:25:16 GMT", "etag": "\"…\"" }, "acteurs": { "url": "…", "lastModified": "…", "etag": "…" } },
  "statistiques": { "adoptes": 3031, "rejetes": 5846, "sansDossier": 5826, "misesAuPoint": 1636, "groupesRattaches": 134, "nonVotantsCorriges": [1],
    "effectif": { "ecartMax": 1, "repartition": { "0": 8748, "1": 129, "-1": 17 }, "horsTolerance": [] },
    "couverture": { "actifs": { "deputes": 574, "wikipedia": 574, "hatvp": 565, "profession": 574, "naissance": 574, "siteWeb": 209, "x": 354, "facebook": 242 },
                    "tous": { "deputes": 652, "wikipedia": 652, "hatvp": 565, "profession": 652, "naissance": 652, "siteWeb": 232, "x": 394, "facebook": 275 } } } }
```

- En mode `fixtures`, `sources.*.url` est le dossier des fixtures et `lastModified` et `etag` valent `null`.
- `autresGroupes` : les organes `GP` de la 17ᵉ législature qu'aucun scrutin ne liste (aujourd'hui « AD », `PO845520`, 2024-07-18 → 2024-09-11, dont 16 députés ont fait partie). Même forme que `groupes.json`, mais sans index dans les matrices : ils ne servent qu'à nommer les groupes de l'historique d'un député (`deputes[].groupes`) et n'entrent ni dans `groupesSansVotant` ni dans les filtres.
- `avertissements` : défauts non bloquants de la préparation. Contient `"wikipedia"` quand Wikidata n'a pas répondu (les `liens.wikipedia` sont alors tous `null`) et `"effectif"` quand des scrutins s'écartent de l'effectif officiel de plus que la tolérance (voir « Effectif en mandat »). Vide sinon. Le build n'échoue jamais pour cela.
- `statistiques.effectif` : écart entre les députés en mandat de chaque scrutin (cases ≠ `-` de `votes.txt`) et l'effectif officiel (somme des `nombreMembresGroupe`), mesuré à la préparation : `ecartMax` (valeur absolue), `repartition` (nombre de scrutins par écart, clés « -1 », « 0 », « 1 »…), `horsTolerance` (numéros des scrutins dont l'écart dépasse 3). `null` en mode `fixtures` : la liste de députés y est réduite, son effectif n'est pas celui de l'Assemblée.
- `statistiques.couverture` : pour les députés en mandat (`actifs`) et pour tous, le nombre de députés qui ont chaque information (Wikipédia, HATVP, profession, naissance, site, X, Facebook). Le script l'écrit aussi dans son journal.
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
   "groupe": "PO845401", "departement": "59", "circonscription": "Nord (19)", "actif": true,
   "naissance": { "date": "1973-04-13", "lieu": "Beauvais" }, "deces": null,
   "profession": "Conseiller en communication",
   "mandat": { "depuis": "2024-06-30", "fin": null, "legislatures": [15, 16, 17] },
   "groupes": [{ "id": "PO840056", "debut": "2024-07-01", "fin": "2024-07-18" }, { "id": "PO845401", "debut": "2024-07-19", "fin": null }],
   "fonctions": [{ "organe": "Bureau de l'Assemblée nationale", "qualite": "Vice-président de l'Assemblée nationale", "depuis": "2025-10-01" },
                 { "organe": "Commission des affaires étrangères", "qualite": "Membre", "depuis": "2024-07-20" }],
   "parti": "Rassemblement national",
   "liens": { "hatvp": "https://www.hatvp.fr/pages_nominatives/chenu-sebastien", "wikipedia": "https://fr.wikipedia.org/wiki/S%C3%A9bastien_Chenu",
              "siteWeb": null, "x": "https://x.com/sebchenu", "facebook": "https://www.facebook.com/chenu.sebastien" } }]
```

- `nom` : `prénom nom` de la fiche. Quand deux députés portent le même nom, l'Assemblée les distingue dans le nom lui-même : « Alexandra Martin (Alpes-Maritimes) » et « Alexandra Martin (Gironde) ». On garde cette précision dans `nom` (elle sert à les distinguer dans la recherche) ; `nomTri` est le nom de famille sans elle (« Martin »).
- `slug` : `nom` en minuscules, sans accents (`œ` → `oe`), tirets pour tout séparateur, soit `alexandra-martin-alpes-maritimes`. Suffixe `-2`, `-3`… (ordre des `PA`) si deux députés avaient exactement le même slug (cas non observé : testé sur des données de test). Stable d'un jour à l'autre tant que le jeu de PA et les noms ne changent pas : les liens partagés ne doivent pas casser.
- `groupe` : `id` du groupe **actuel**, c'est-à-dire du mandat `GP` de la 17ᵉ sans `dateFin` (le plus récent s'il y en a deux : 11 députés), sinon du dernier mandat terminé ; `null` si aucun (aucun cas observé). Seuls les groupes présents dans `groupes.json` sont retenus.
- `circonscription` : `election.lieu.departement` + `(numCirco)` du mandat `ASSEMBLEE` de la 17ᵉ (« Nord (19) », « Français établis hors de France (3) ») ; `departement` : `numDepartement` tel quel (`"59"`, `"2A"`, `"971"`, `"099"` pour les Français de l'étranger). Le mandat retenu est celui en cours, sinon le dernier : 29 députés ont plusieurs mandats `ASSEMBLEE` dans la législature (un membre du gouvernement perd son mandat à sa nomination et le retrouve ensuite). `actif` : au moins un de ces mandats est sans `dateFin` (574 observés).
- **État civil** (`etatCivil` de l'archive des acteurs) : `naissance` = `{ date, lieu }` (`infoNaissance.dateNais` ; `lieu` = `villeNais`, suivie du pays entre parenthèses quand il n'est pas la France, « Alger (Algérie) »), `null` sans date valide ; `deces` = `dateDeces` (2 députés de la 17ᵉ sont décédés en cours de mandat). **L'âge n'est pas stocké** : le serveur le calcule à la requête. Un champ vide de l'archive n'est jamais `null` mais un objet `{ "@xsi:nil": "true" }` (`villeNais`, `paysNais`, `dateDeces`, `uri_hatvp`) : tout ce qui n'est pas du texte est ignoré (`chaine()` de `lire.mjs`).
- **`profession`** : `profession.libelleCourant`, sans le préfixe de code INSEE que l'archive met parfois devant (« (33) - Cadre de la fonction publique » devient « Cadre de la fonction publique »).
- **`mandat`** : mandat `ASSEMBLEE` de la 17ᵉ législature en cours (le plus récent d'après son début effectif, voir « Effectif en mandat »), sinon le dernier (même règle que la circonscription) : `depuis` = `dateDebut` pour un député élu (la date de son élection : « 30 juin 2024 »), mais la prise de fonction (`mandature.datePriseFonction`) pour un remplaçant, dont la `dateDebut` de l'archive est celle de l'élection de son titulaire ; `fin` = `dateFin` (`null` tant qu'il est en cours), `legislatures` = les législatures de **tous** ses mandats `ASSEMBLEE` (de la plus ancienne à la plus récente, de 1 à 6 observées). `null` sans mandat.
- **`groupes`** : l'historique de ses mandats `GP` de la 17ᵉ législature, du plus ancien au plus récent, `{ id, debut, fin }`. `id` est dans `groupes.json` ou dans `meta.autresGroupes`. Les mandats en double (même groupe et mêmes dates : un second mandat sous une autre qualité) sont écartés, et deux périodes qui se suivent sans trou dans un même groupe sont fusionnées (« NI 2024-07-08 → 2024-07-18 » puis « NI 2024-07-19 → » donne « NI 2024-07-08 → »). Un organe inconnu est ignoré. Cet historique est celui des mandats, pas des scrutins : le groupe d'un député un jour de vote reste celui de `groupes-votes.txt`.
- **`fonctions`** (députés en mandat seulement) : mandats `BUREAU` (« Vice-président de l'Assemblée nationale ») puis `COMPER` (commission permanente : « Membre » de la « Commission des affaires étrangères ») de la 17ᵉ législature sans `dateFin`, `{ organe, qualite, depuis }`. `organe` = libellé de l'organe référencé par `organeRef` ; `qualite` = `infosQualite.libQualiteSex` (accordée au genre : « Vice-présidente de l'Assemblée nationale »), sinon `libQualite`, sinon « Membre ». Doublons écartés.
- **`parti`** (députés en mandat seulement) : libellé de l'organe du mandat `PARPOL` en cours (le plus récent) : le parti de rattachement (financement des partis), tel que déclaré. Ces mandats n'ont pas de législature (`legislature` vaut `null`).
- **`liens`** : `hatvp`, `wikipedia`, `siteWeb`, `x`, `facebook`, chacun `null` quand il manque ou n'est pas fiable (voir « Liens externes »). La fiche officielle se déduit de `pa`.
- **Photo et fiche** se déduisent de `pa` : pas de champ. Attention : le fichier de la photo porte le **numéro sans le préfixe `PA`** (`…/photos/carre/720468.jpg`, 200 ; avec `PA720468.jpg`, 404), alors que la fiche garde le préfixe (`https://www.assemblee-nationale.fr/dyn/deputes/PA720468`).

## Liens externes

Rien n'est jamais deviné : un lien absent est `null` et l'interface ne l'affiche pas. **Jamais publiés** : téléphone, e-mail, adresses postales, ni les autres réseaux (Instagram, LinkedIn…) : seules les rubriques `Site internet`, `Twitter` et `Facebook` de `adresses.adresse[]` sont lues (`lireLiensWeb`).

- **`hatvp`** : `uri_hatvp` si c'est une chaîne de la forme que le site de la HATVP produit : `https://www.hatvp.fr/pages_nominatives/<mots en minuscules sans accent, séparés par des tirets>`. L'adresse redirige (302) vers `https://www.hatvp.fr/fiche-nominative/?declarant=<même nom>`, qui répond 200. Sur l'archive du 19/10/2026, 568 des 574 députés en mandat ont une adresse (aucun des 78 anciens) ; **3 de ces 568 sont écartées** parce que le site de la HATVP répond 404 : `martin-(alpes-maritimes)-alexandra`, `martin-(gironde)-alexandra-26044` (parenthèses) et `echaniz-iñaki-24343` (accent ; sans accent, `echaniz-inaki-24343` répond 200 : on ne le reconstruit pas). Reste 565.
- **`x`** : un identifiant (`@sebchenu`, `sebchenu`, 15 caractères au plus : lettres, chiffres, `_`) ou une adresse de x.com / twitter.com, publié en `https://x.com/<compte>`. Du texte libre (« @X : x.com/BrigitteBareges ») est écarté.
- **`facebook`** : un nom de page (`chenu.sebastien` : 5 à 80 caractères ASCII, lettres, chiffres, point, tiret) ou `people/<nom>/<numéro>`, nu ou dans une adresse facebook.com, publié en `https://www.facebook.com/<page>`. Un nom avec accent ou espace est écarté.
- **`siteWeb`** : l'archive donne **toujours un nom de domaine nu** (233 sur 233 : `www.david-habib.fr`, parfois `/www.veroniquebesse.fr` ou `clementine-autain.fr/`, jamais `http://` ni `https://`). On retire les barres en trop et on ajoute `https://`, à condition que ce soit un nom de domaine valide (un point, un suffixe alphabétique) sans identifiant ni port ; sinon `null`. C'est la seule adresse dont le schéma est déduit : sur un échantillon de 25 sites, 19 répondent 200 en https depuis l'environnement de préparation, les autres échouent (un certificat qui ne correspond pas au domaine, des délais dépassés ou des connexions coupées).
- **`wikipedia`** : voir ci-dessous.

## Liens Wikipédia (Wikidata)

Les pages Wikipédia ne sont **pas** dans les données officielles : c'est l'exception à la règle « sources officielles uniquement ». Source retenue : Wikidata (base communautaire de la fondation Wikimedia, CC0). La propriété `P4123` est l'identifiant « Assemblée nationale » d'une personne, soit le numéro du `PA` sans préfixe (`PA720468` donne `720468`) ; une requête SPARQL en donne l'article de Wikipédia en français :

```sparql
SELECT ?an ?article WHERE {
  ?item wdt:P4123 ?an .
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> }
}
```

`GET https://query.wikidata.org/sparql?query=…`, `Accept: application/sparql-results+json` et un `User-Agent` qui identifie le site (obligatoire, en ASCII : c'est un en-tête HTTP). Mesuré le 19/10/2026 : 2 460 lignes, 2 439 articles, aucun doublon ; les 652 députés sont couverts.

- **Robustesse** (`scripts/donnees/wikipedia.mjs`) : une tentative, puis jusqu'à trois nouveaux essais (pauses de 2, 4 et 8 s) sur une coupure réseau, un délai dépassé (60 s par requête), un 5xx, un 408 ou un 429 ; les autres statuts échouent tout de suite. Une réponse de moins de 1 000 lignes est tenue pour incomplète. **Wikidata ne fait jamais échouer le build** : en cas d'échec, tous les `liens.wikipedia` sont `null`, `meta.avertissements` vaut `["wikipedia"]` et le journal le dit (`AVERTISSEMENT : liens Wikipédia indisponibles…`).
- **Filtre** : seules les adresses qui commencent par `https://fr.wikipedia.org/wiki/` sont retenues, sans espace. Une ligne sans article est ignorée ; deux articles différents pour un même numéro n'en donnent aucun (observé : jamais).
- **Mode `fixtures`** : le script lit `src/server/fixtures/officiel/wikidata.json` (extrait réel de la réponse, réduit aux députés des fixtures, même format SPARQL) : aucun réseau en test.
- Le serveur ne contacte jamais Wikidata : le lien est dans `deputes.json`. Le site le dit (`/a-propos`, fiche d'un député) : source communautaire et non officielle.

## `scrutins.json`

Tableau trié par numéro **décroissant** (le plus récent d'abord), un élément par scrutin :

```json
{ "n": 8317, "date": "2026-07-16", "titre": "l'amendement n° 770 de Mme Parmentier à l'article premier du projet de loi relatif à la protection des enfants (première lecture).",
  "type": "amendement", "adopte": false, "solennel": false, "dossier": "DLR5L17N54372",
  "compte": { "pour": 37, "contre": 87, "abstention": 0, "nonvotant": 2 },
  "groupes": [{ "g": 0, "position": "pour", "compte": { "pour": 33, "contre": 0, "abstention": 0, "nonvotant": 1 } }] }
```

- `n` : champ `numero`. `titre` : titre officiel, tel quel (avec son point final). `adopte` : `sort.code === 'adopté'`. `solennel` : `typeVote.codeTypeVote === 'SPS'` (scrutin public solennel : tous les députés sont convoqués) ; faux pour `SPO` (scrutin public ordinaire : en séance, seuls les députés présents dans l'hémicycle votent) et `MOC` (motion de censure). `dossier` : `objet.dossierLegislatif.dossierRef` ou `null` (3 051 scrutins sur 8 877 en ont un, 5 826 non, dont 154 des 235 votes finaux). Les dossiers de la 16ᵉ législature (`DLR5L16N…`, 12 scrutins) sont conservés tels quels.
- `type` : `classerTous` de `src/shared/classer.ts` (final, motion, article, amendement, autre). Une motion de censure est reconnue par `typeVote.codeTypeVote === 'MOC'` ou par le titre ; le classement des titres est décrit dans PLAN.md. « L'article unique » d'un projet ou d'une proposition de loi compte comme `final` quand le texte (même titre, même lecture) n'a ni vote sur l'ensemble ni vote sur un autre article ; une proposition de résolution n'est pas une loi, son article unique reste un `article`, et le vote sur l'ensemble d'une résolution est `autre`.
- `compte` : `syntheseVote.decompte` (`nonvotant` = `nonVotants` ; les abstentions comprennent les « non-votants volontaires », voir plus bas). Seule exception : si le nombre de non-votants annoncé diffère de la somme des groupes, on garde la somme des groupes (observé : le scrutin 1, 10 annoncés contre 21 listés) et le script le consigne dans `meta.statistiques.nonVotantsCorriges` ; au-delà de 5 scrutins, il échoue.
- `groupes` : `g` est l'index dans `groupes.json`, par ordre croissant ; `compte` le `decompteVoix` du groupe ; `position` la position majoritaire du groupe **calculée par nous** sur ses suffrages exprimés : la position (pour, contre, abstention) qui a le plus de voix, `partage` quand deux positions sont à égalité en tête, `nonvotant` quand le groupe n'a aucun suffrage exprimé. Le champ officiel `positionMajoritaire` n'est pas utilisé (voir « Écarts constatés »). La somme des groupes égale `compte` ; sinon le script échoue.
- Un groupe sans aucun député listé dans le scrutin garde une entrée avec un `compte` à zéro (c'est le cas de l'archive) ; une entrée `PO0` sans aucun député est écartée.
- Le titre court, la lecture et le regroupement par loi se calculent au chargement (`classify.ts`, qui réexporte `src/shared/classer.ts`), pas dans ce fichier.

## `votes.txt` et `groupes-votes.txt`

Un fichier texte par matrice, **une ligne par scrutin, dans l'ordre de `scrutins.json`**, **un caractère par député, dans l'ordre de `deputes.json`**, lignes séparées par `\n` (pas de saut de ligne final).

- `votes.txt` :
  - `P` pour, `C` contre, `A` abstention (les « non-votants volontaires » y sont, voir plus bas), `N` non-votant : le député figure dans la liste des non-votants du scrutin (président de séance, membre du gouvernement, ou député présent qui n'a pas voté) ;
  - `X` : **absent**. Le député est en mandat ce jour-là (un mandat `ASSEMBLEE` de la 17ᵉ couvre la date du scrutin, bornes comprises, **de sa prise de fonction à sa `dateFin`** : voir « Effectif en mandat ») mais ne figure dans aucune liste ;
  - `-` : le député n'est pas en mandat à cette date.
- `groupes-votes.txt` : pour chaque case `P`, `C`, `A` ou `N`, un caractère qui code l'index du groupe **au jour du vote** (`0`-`9`, puis `a`-`z`), d'après la ventilation du scrutin. Pour une case `X`, le groupe de ses mandats ce jour-là s'il figure dans le scrutin, sinon `-`. `-` pour une case `-`. Même longueur que `votes.txt`.
- Mises au point (`miseAuPoint`, dont `dysfonctionnement`) : les listes nominatives de `ventilationVotes` sont la référence ; les mises au point ne sont **pas** appliquées. Elles concernent **1 636 scrutins sur 8 877 (18 %)** : 1 534 avec des mises au point et 102 avec seulement des dysfonctionnements de boîtier. C'est fréquent : à signaler dans `/a-propos`.

Taille observée : 5,8 Mo bruts par matrice (`votes.txt` 0,73 Mo en gzip, `groupes-votes.txt` 0,03 Mo). Le serveur les garde en mémoire sous forme de chaînes ; accès à la position du député `i` au scrutin `s` : `votes[s][i]`.

## Entrées de groupe `PO0`

Dans 14 scrutins (146 entrées de groupe au total), l'archive ne renseigne pas l'organe du groupe : `organeRef` vaut `PO0`. Ce n'est pas un groupe de députés sans étiquette : c'est un identifiant manquant (voir « Écarts constatés »). Dans 12 scrutins du 2 décembre 2024 (489, 491 à 501) toutes les entrées sont `PO0` ; dans les scrutins 1302 et 6256, seule l'entrée du Rassemblement National l'est. Le script rattache chaque entrée à son vrai groupe : celui que ses députés ont ce jour-là d'après leurs mandats `GP` (en pratique, tous les députés d'une entrée sont dans le même groupe). Il échoue si la majorité stricte des députés de l'entrée ne désigne pas un groupe, ou si deux entrées désignent le même groupe. Une entrée sans aucun député listé (12 cas) n'a rien à compter : elle est écartée.

## Effectif en mandat

Le nombre de députés « en mandat » d'un scrutin (`ScrutinResume.enMandat`, cases ≠ `-` de `votes.txt`) doit être celui de l'Assemblée. Mesuré sur l'archive du 20/10/2026 (8 894 scrutins, 654 acteurs avec un mandat `ASSEMBLEE` de la 17ᵉ), il ne l'était pas : le site annonçait 609 députés en mandat le 9 décembre 2025 (scrutin 4696) pour un effectif officiel de 575, donc « 35 n'ont pas voté » quand l'Assemblée en compte 1.

### Cause

**Confirmée dans son effet, corrigée dans son mécanisme.** L'hypothèse de départ (un titulaire dont un suppléant siège garde un mandat ouvert, à retrancher) n'est pas ce que dit l'archive. Les trois députés cités en exemple (Éric Gérard, Pauline Cestrières, Jérôme End) ne sont pas des titulaires : ce sont les **remplaçants**. Un mandat de remplaçant porte pour `dateDebut` la date de l'élection générale (`2024-07-07`, ou `2024-06-30`), pas le jour de son arrivée ; le jour réel est dans `mandature.datePriseFonction`. Lu tel quel, le remplaçant est « en mandat » dès 2024, en même temps que son titulaire (qui, lui, a la bonne `dateFin`) : un siège compte deux fois pendant des mois, et la participation du remplaçant s'écroule (il est `X` partout avant d'être arrivé).

Les cas lus dans l'archive (mandats `ASSEMBLEE` de la 17ᵉ ; dates : `dateDebut` / `datePriseFonction` / `dateFin`) :

| Siège | Titulaire | Remplaçant | Ce que dit l'archive |
|---|---|---|---|
| Moselle 4 | Fabien Di Filippo (`PA720386`) : `2024-07-07` / `2024-07-08` / **`2026-04-20`**, démission pour incompatibilité | Jérôme End (`PA720390`) : `2024-07-07` / **`2026-04-21`** / ouvert | Le remplaçant entre le lendemain du dernier jour du titulaire. `mandatRemplaceRef` vaut `null` ; sa `dateDebut` est celle de 2024. |
| Aveyron 1 | Stéphane Mazars (`PA677483`) : fin **`2026-04-26`** | Pauline Cestrières (`PA718820`) : `2024-07-07` / **`2026-04-27`** / ouvert | Même schéma. |
| Eure-et-Loir 3 | Harold Huwart (`PA841017`) : fin **`2026-07-25`** | Éric Gérard (`PA642734`) : `2024-07-07` / **`2026-07-26`** / ouvert | Même schéma. |
| Nord 14 | Paul Christophe (`PA642868`) : `2024-07-08` → `2024-10-21` (ministre), puis `2025-01-24` → `2026-04-06` (démission) | Pierre Marle (`PA794518`) : `2024-10-22` → `2025-01-23`, puis `2026-04-07` → ouvert | Quatre mandats, tous avec la `dateDebut` de 2024. Le **retour** d'un titulaire est un nouveau mandat dont `mandatRemplaceRef` désigne l'ancien (`PM843122`) ; il en va de même du second mandat de Marle. |
| Eure-et-Loir 2 | Olivier Marleix (`PA606098`) : fin **`2025-07-07`**, décès | Christelle Minard (`PA643104`) : `2024-07-07` / **`2025-07-08`** / ouvert | Un décès : le remplaçant siège le lendemain. |
| Loiret 1 | Stéphanie Rist (`PA720066`) : `2024-07-08` → `2025-11-12` (ministre), puis élue à une partielle (`dateDebut` `2026-01-25`, prise de fonction `2026-01-26`) → `2026-02-26` (ministre de nouveau) | Stéphane Chouin (`PA841347`) : `2025-11-13` → `2025-11-13`, puis Marie-Philippe Lubet (`PA879389`) : `2026-02-27` → ouvert | Un remplaçant peut ne siéger qu'un jour : Chouin démissionne le jour même. |

`mandatRemplaceRef` n'est donc **pas** le marqueur d'une suspension : il ne figure que sur 27 mandats (sur 683), toujours un mandat de retour, jamais sur celui d'un premier remplaçant (Cestrières, End, Gérard : `null`). Le bloc `suppleants` du mandat d'un titulaire (`suppleantRef`, `dateDebut` `2024-07-07`, `dateFin` égale à celle du titulaire) nomme son suppléant mais ne donne pas la période où celui-ci siège. Seule `datePriseFonction` la donne.

Sur les 683 mandats `ASSEMBLEE` de la 17ᵉ, `datePriseFonction` est toujours présente et jamais antérieure à `dateDebut`. Pour les 587 mandats d'un député élu (577 élections générales, 10 élections partielles), elle tombe le lendemain de `dateDebut` (le jour de l'élection, un dimanche). Pour les **96 mandats de remplaçants**, elle tombe de 33 à 830 jours plus tard : 42 « remplacement d'un député nommé au Gouvernement », 27 « remplacement d'un député ayant démissionné pour cause d'incompatibilité », 21 « reprise de l'exercice du mandat d'un ancien membre du Gouvernement », 4 « remplacement d'un député en mission au-delà de 6 mois », 2 « remplacement d'un député décédé ». Aucune `dateFin` ne précède une `datePriseFonction`.

Les autres causes ont été cherchées et écartées : la `dateFin` des titulaires est juste (décès, démission, nomination au gouvernement, élection au Sénat, annulation d'élection) ; aucun jour de chevauchement entre un titulaire et son remplaçant (75 sièges ont plusieurs mandats, la prise de fonction du suivant tombe toujours après la fin du précédent) ; aucune case listée d'un scrutin ne tombe hors de la période recalculée (0 sur 1 323 978 positions, comme avant).

### Règle retenue

Un mandat de député compte « en mandat » **du jour de sa prise de fonction à sa `dateFin`, bornes comprises** : début effectif = `mandature.datePriseFonction` quand elle est postérieure à `dateDebut`, sinon `dateDebut` (`debutEffectif`, `scripts/donnees/construire.mjs`). Une case reste `-` en dehors, comme pour un député pas encore élu. Le format des fichiers de `data/` ne change pas.

- **Le jour du remplacement** : les bornes sont incluses des deux côtés et chaque mandat est jugé seul. Quand le remplaçant entre le lendemain du dernier jour de son titulaire (91 transitions de l'archive ; les autres laissent le siège vacant quelques jours), un seul des deux est en mandat chaque jour. Si l'archive donnait un jour commun (aucun cas observé), les deux compteraient ce jour-là, et le garde-fou y verrait un écart de plus un.
- **Un vote listé n'est jamais effacé** : si un député figurait dans une liste nominative hors de sa période calculée (aucun cas), sa case garderait `P`, `C`, `A` ou `N`.
- **Sans `datePriseFonction`** (champ absent de l'archive), le début est `dateDebut` : l'ancien comportement, que le garde-fou détecte.
- **Fiche** : `mandat.depuis` est la prise de fonction pour un remplaçant (« En cours depuis le 21 avril 2026 » pour Jérôme End) et la `dateDebut` pour un élu (« 30 juin 2024 »). Le mandat en cours se choisit sur le début effectif : les mandats de retour ont tous la même `dateDebut`.

### Mesures

Écart `enMandat − effectif officiel` (somme des `nombreMembresGroupe`, relue dans l'archive), sur les 8 894 scrutins :

| | Avant | Après |
|---|---|---|
| Plus petit et plus grand écart | 0 et +65 | -1 et +1 |
| Scrutins exacts | 286 (3 %) | 8 748 (98,4 %) |
| Scrutins à ±1 au plus | 286 | 8 894 (129 à +1, 17 à -1) |
| Scrutins à plus de 3 | 8 608 | 0 |
| Scrutins à plus de 20 | 6 284 (71 %) | 0 |

Avant, l'écart moyen baissait avec le temps (62 au dernier trimestre 2024, 52 au deuxième trimestre 2025, 34 au premier trimestre 2026, 13 au deuxième, 2 depuis octobre 2026) : chaque remplaçant à venir était déjà compté, et il y en a de moins en moins à venir.

Valeurs réelles (archive du 20/10/2026) :

| Scrutin | Date | Votants | `enMandat` avant | `enMandat` après | Effectif officiel | « N'ont pas voté » : avant / après / officiel |
|---|---|---|---|---|---|---|
| 4696 | 2025-12-09 | 574 | 609 | 575 | 575 | 35 / 1 / 1 |
| 1018 | 2025-03-13 | 23 | 628 | 575 | 575 | 605 / 552 / 552 |
| 8433 | 2026-07-21 | 537 | 585 | 577 | 577 | 48 / 40 / 40 |
| 8317 | 2026-07-16 | 124 | 586 | 577 | 577 | 462 / 453 / 453 |
| 8877 | 2026-10-16 | 71 | 574 | 574 | 574 | 503 / 503 / 503 |

Participation (votes exprimés sur scrutins en mandat), avant et après :

| Député | Avant | Après |
|---|---|---|
| Sébastien Chenu (élu en 2024) | 11,3 % (1 009 / 8 894) | 11,3 % (1 009 / 8 894), inchangée |
| Pauline Cestrières (en fonction depuis le 2026-04-27) | 10,4 % (922 / 8 894) | 35,3 % (922 / 2 610) |
| Jérôme End (depuis le 2026-04-21) | 3,1 % (277 / 8 894) | 10,6 % (277 / 2 610) |
| Éric Gérard (depuis le 2026-07-26) | 0,0 % (2 / 8 894) | 0,4 % (2 / 460) : il n'a voté que deux fois depuis son arrivée, ce chiffre est exact |

47 députés sur 652 changent de plus de 5 points de participation (11 de plus de 20 points) ; 89 changent de dénominateur ; aucune participation ne baisse.

### Écarts résiduels

Cinq journées gardent un écart d'un député (146 scrutins sur 8 894), aucune ne dépasse un :

- **2025-07-07** (+1, 19 scrutins) et **2025-11-06** (+1, 39 scrutins) : le jour d'un décès (Olivier Marleix) et d'une démission (Christelle Petex), qui comptent par leur `dateFin` inclusive, alors que le décompte officiel baisse en cours de journée (577 puis 576). Nos dates sont des jours entiers.
- **2025-11-13** (-1, 17 scrutins) : Stéphane Chouin entre en fonction et démissionne le même jour, sans jamais voter. L'effectif officiel le compte, mais `deputes.json` ne garde que les acteurs qui figurent dans au moins une liste (652 sur 654 acteurs avec un mandat : Chouin, et Flavien Termet dont le mandat finit le 2024-10-04, avant le premier scrutin).
- **2026-01-26** (+1, 37 scrutins) et **2026-05-26** (+1, 34 scrutins) : le lendemain de l'élection partielle de Stéphanie Rist (nommée ministre un mois plus tard) et de l'entrée en fonction de Dominique Paillat. Le décompte officiel ne compte pas encore ces deux députés ces jours-là ; les dates de l'archive ne l'expliquent pas, et l'écart ne dure qu'un jour.

### Garde-fou

À chaque préparation (hors mode `fixtures`), `construire` compare, pour chaque scrutin, `enMandat` à la somme des `nombreMembresGroupe` de **toutes** les entrées de groupe de l'archive (y compris celles écartées faute de député listé) et range le résultat dans `meta.statistiques.effectif`. Les seuils, fixés d'après les mesures ci-dessus (`SEUILS_EFFECTIF`) :

- **Tolérance de 3** par scrutin. Le plus grand écart mesuré après correction est de 1, et le 13/11/2025 une trentaine d'entrées et de sorties le même jour ne donnent que ±1 ; 3 laisse de la marge sans cacher un défaut. Au-delà, c'est un **avertissement** (journal, `"effectif"` dans `meta.avertissements`, numéros dans `horsTolerance`) : un build qui échouerait sur une anomalie de la source bloquerait aussi la mise à jour nocturne.
- **Échec** seulement si plus de **1 %** des scrutins (89 sur 8 894) ont un écart de plus de **20**. Le défaut corrigé ici donnait un écart de plus de 20 sur 71 % des scrutins : un champ de date qui disparaît ou change de sens est attrapé, alors que quelques journées anormales de la source (une soixantaine de scrutins au plus par jour) ne bloquent rien.

`DONNEES_DIR=data npm test` rejoue le contrôle sur un `data/` réel : écart maximal dans la tolérance et, quand l'archive des scrutins mise en cache par le pipeline (`.cache/officiel`) est bien celle de `data/` (même ETag), recalcul indépendant de l'effectif officiel de chaque scrutin, avec au moins 95 % de scrutins exacts. Les specs `scripts/donnees/effectif.spec.ts` rejouent des fragments réels de l'archive (Di Filippo et End, Christophe et Marle, Bellamy et Paillat), le jour du remplacement, un mandat sans suppléant, plusieurs suspensions et le garde-fou. Les fixtures (`src/server/fixtures/officiel/`) contiennent les mandats réels de Di Filippo, End, Christophe et Marle avec leur `datePriseFonction` (`PAIRES_DE_REMPLACEMENT` dans `fixtures.mjs`).

## Garde-fous (le script échoue si…)

(Wikidata n'en fait pas partie : une source facultative qui manque donne un avertissement, pas un échec.)

- moins de 8 000 scrutins ou moins de 570 députés (seuils levés en mode `fixtures`) ;
- le téléchargement n'a pas répondu 200, est incomplet, ou fait moins de 1 Mo ;
- un votant (`acteurRef`) sans fiche dans l'archive des acteurs ;
- un `sort.code` autre que `adopté` / `rejeté` ;
- une liste nominative dont la longueur diffère du `decompteVoix` de son groupe ;
- la somme des groupes ≠ le décompte du scrutin pour les pour, les contre ou les abstentions (pour les non-votants : corrigé jusqu'à 5 scrutins, voir `scrutins.json`) ;
- une entrée de groupe `PO0` ou inconnue impossible à rattacher, ou deux entrées pour le même groupe ;
- plus de 36 groupes ;
- deux députés avec le même `slug` ;
- une matrice dont une ligne n'a pas exactement `deputes.length` caractères, ou dont le nombre de lignes diffère de celui des scrutins ;
- plus de 1 % des scrutins (89 sur 8 894) dont le nombre de députés en mandat diffère de plus de 20 de l'effectif officiel (contrôle de l'effectif, détail dans « Effectif en mandat » : un écart de plus de 3 sur quelques scrutins n'est qu'un avertissement).

## Calculs faits par le serveur (`agregation.ts`)

- Participation d'un député = (P + C + A) / (P + C + A + N + X) sur les scrutins où sa case n'est pas `-` (là où il était en mandat). Abstention = A / (P + C + A). Loyauté = nombre de votes P/C/A égaux à la `position` majoritaire du groupe du député **à ce scrutin** (hors `partage` et `nonvotant`) / nombre de ces votes. `null` si le dénominateur est nul. Sur les données réelles, la participation d'un député va de 0 % à 89 % (médiane 23 % ; 22 % avant la correction de l'effectif en mandat) : la plupart des scrutins (amendements) n'ont que 100 à 150 votants.
- **Ont voté / n'ont pas voté** : `enMandat` d'un scrutin = nombre de cases ≠ `-` de sa ligne de `votes.txt`, compté une fois au chargement (`donnees.ts`) : aucun changement du format de `data/`. « Ont voté » = pour + contre + abstention du `compte` ; « n'ont pas voté » = `enMandat` − votants, soit les non-votants officiels (`N`) plus les absents (`X`). Les pourcentages de pour, contre et abstention sont calculés sur les votants (arrondis par la méthode du plus fort reste, somme de 100) ; le pourcentage de ceux qui n'ont pas voté sur `enMandat`. `enMandat ≥ votants` pour chaque scrutin (vérifié sur les fixtures et sur les vraies archives), et `enMandat` s'accorde avec l'effectif officiel à un député près (voir « Effectif en mandat »).
- Compteurs d'un député (`DeputeDetail.scrutins`), dans la même boucle que les taux : `enMandat` = cases ≠ `-`, `pour`, `contre`, `abstention` = cases `P`, `C`, `A`, `nonVote` = cases `N` + `X`, avec `pour + contre + abstention + nonVote = enMandat` et `taux.participation = (pour + contre + abstention) / enMandat`.
- **Groupes sans votant** (`groupesSansVotant`, sur un scrutin et sur le vote final d'une loi) : les groupes de `groupes.json` dont `debut` ≤ date du scrutin ≤ `fin` (bornes incluses, `null` = sans borne) et qui n'ont aucune ligne dans les groupes affichés. L'interface les nomme sous le tableau par groupe au lieu de les masquer sans explication.
- Un groupe dont le `compte` est nul (aucun député listé) est écarté des `VoteGroupe` renvoyés par l'API : une ligne « non-votant » à zéro laisserait croire que ses membres se sont tenus à l'écart. La somme des groupes affichés reste égale au décompte du scrutin.
- L'accueil montre une carte par dossier : le vote final le plus récent de chaque dossier (un vote final sans dossier a sa propre carte). Les 10 derniers votes d'un député, eux, sont ses 10 derniers scrutins de type `final`, sans regrouper par dossier.
- **Fiche d'un député** (`DeputeDetail`) : tout vient de `deputes.json`, rien n'est recalculé sauf **l'âge**, calculé à chaque requête d'après la date du jour à Paris (`Europe/Paris`) : un anniversaire change l'âge à minuit à Paris. Pour un député décédé, c'est l'âge au décès. Une date de naissance dans le futur n'a pas de sens : pas de naissance servie plutôt qu'un âge faux. La partie mémorisée de la fiche ne contient pas l'âge. L'historique de groupes remplace chaque `id` par le groupe complet (de `groupes.json` ou de `meta.autresGroupes`) ; `liens.assemblee` se déduit de `pa`. Le serveur contrôle la forme de chaque champ au chargement (dates réelles, liens en https sur le site attendu, identifiants de groupe connus, `pa` de 7 chiffres au plus) et refuse le dossier sinon (503).
- `DeputeIndex.pa` : le numéro de `pa` sans préfixe (`720468`), pour que l'interface construise la photo (`photoDe`, `src/shared/photo.ts`) sans que l'index (que la recherche charge en entier) grossisse d'une URL par député.
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
| `photo` se déduit de `pa`. | Le fichier de photo porte le numéro **sans** `PA`. | Documenté ci-dessus ; appliqué dans `agregation.ts`. |
| Les listes de scrutins ont tous leurs groupes. | Chaque vrai groupe figure dans tous les scrutins de sa période d'existence (`UDR` ancien : 3 041 scrutins, nouveau : 5 824 ; `AD` : jamais). Les seuls trous sont les 14 scrutins `PO0` (RN absent de la liste sous son nom). Aucun scrutin n'a de groupe unique en objet. | Aucun traitement particulier. |
| Types de scrutin. | `SPO` 8 780, `SPS` 74, `MOC` 23 : les 23 motions de censure (toutes `MOC`) ont un titre « la motion de censure… ». Des votes sur l'ensemble d'un texte sont écrits sans « l'ensemble » (« la proposition de loi… (première lecture). », 3 cas) ou avec une faute (« l'ensemble de de la… », 1 cas). | `classerTous`. |
| `dateDebut` d'un mandat `ASSEMBLEE` est le début du mandat. | Vrai pour un député élu, **faux pour un remplaçant** : 96 mandats (nommés au gouvernement, démissionnaires, décédés, en mission, retours de ministres) gardent la `dateDebut` de l'élection générale (2024-06-30 ou 2024-07-07). Le jour réel est `mandature.datePriseFonction` (toujours présente, de 33 à 830 jours après `dateDebut` pour ces 96 mandats, le lendemain pour les 587 autres). Lu tel quel, `enMandat` dépassait l'effectif officiel de 0 à 65 députés. | Début effectif = `datePriseFonction` (voir « Effectif en mandat »). |
| `mandatRemplaceRef` et `suppleants` donnent les périodes de suspension d'un titulaire. | `mandatRemplaceRef` n'est renseigné que sur 27 mandats de retour (il désigne l'ancien mandat du même député) ; `suppleants` nomme le suppléant mais sa `dateFin` est celle du titulaire. Aucun des deux ne donne la période où le remplaçant siège. | Non utilisés. |
| Archive régénérée chaque nuit, avec ETag. | Vrai, mais le CDN sert parfois deux versions du fichier : le même jour, `Last-Modified` 04:25:16 GMT (27 563 304 octets, ETag `"1a49528-…"`) et 10:25:07 GMT (27 563 289 octets, ETag `"1a49519-…"`). Les deux sont valides et donnent les mêmes effectifs (8 877 scrutins, 3 031 adoptés) ; elles ne diffèrent que par le scrutin 8805, corrigé entre-temps : l'archive est donc republiée en cours de journée. | `If-None-Match` fonctionne ; un changement d'ETag télécharge à nouveau (27 Mo). |

### Enrichissement des fiches (prompt 13) : ce que l'archive contient vraiment

Vérifié sur l'archive du 19/10/2026 (654 acteurs ont un mandat `ASSEMBLEE` de la 17ᵉ législature, dont les 652 votants).

| Affirmation ou attente | Réalité observée | Traitement |
|---|---|---|
| `uri_hatvp` est `null` quand elle manque. | Un objet `{ "@xsi:nil": "true" }` (86 acteurs sur 654). Même chose pour `villeNais`, `depNais`, `paysNais`, `dateDeces`. | `chaine()` : seul un texte non vide compte. |
| Une adresse HATVP existe pour 568 députés en mandat. | Vrai (568 sur 574, 0 sur 78 anciens), mais 3 adresses répondent 404 sur le site de la HATVP (deux avec parenthèses, une avec un accent). | Forme stricte exigée ; 565 retenues. |
| `profession.libelleCourant` est un libellé. | Souvent préfixé d'un code INSEE : « (33) - Cadre de la fonction publique » (30 fois), « (37) - … » (26 fois), la même profession existe aussi sans préfixe. | Préfixe retiré. |
| Les adresses web sont des URL. | `Site internet` : 233 noms de domaine nus (jamais de schéma), parfois avec une barre devant ou derrière. `Twitter` : `@compte` ou du texte libre (« @X : x.com/… »). `Facebook` : un nom de page, parfois `people/<nom>/<numéro>`, parfois avec accents. | Extraction stricte (`lireSiteWeb`, `lireX`, `lireFacebook`) ; ce qui n'est pas fiable est écarté. |
| Un mandat par groupe et par période. | Des mandats `GP` en double (même organe, mêmes dates) et des périodes contiguës dans le même groupe (49 cas). | `periodesDeGroupe` les écarte et les fusionne. |
| Tous les groupes de l'historique sont dans les scrutins. | Le groupe `AD` (16 députés, 2024-07-18 → 2024-09-11) n'apparaît dans aucun scrutin donc pas dans `groupes.json`. | `meta.autresGroupes`. |
| Les mandats `PARPOL` ont une législature. | `legislature` vaut `null`. Les `BUREAU` et `COMPER` ont leur législature. | Parti : le mandat sans `dateFin`. |
| Les députés vivent. | Deux députés de la 17ᵉ législature sont décédés en cours de mandat (2025-07-07 et 2026-05-24). | `deces` ; l'âge est celui du décès. |
| `etatCivil.infoNaissance` est complet. | Un député n'a pas de ville ni de pays de naissance, seulement la date. | Naissance sans lieu. |
| Les photos existent pour tous. | Au moins une photo répond 404 (`PA841347`). | Repli sur les initiales (`app-deputy-photo`). |

**Couverture mesurée** (journal du build, 19/10/2026) :

| | Wikipédia | HATVP | Profession | Naissance | Site | X | Facebook |
|---|---|---|---|---|---|---|---|
| En mandat (574) | 574 (100 %) | 565 (98 %) | 574 (100 %) | 574 (100 %) | 209 (36 %) | 354 (62 %) | 242 (42 %) |
| Anciens (78) | 78 (100 %) | 0 (0 %) | 78 (100 %) | 78 (100 %) | 23 (29 %) | 40 (51 %) | 33 (42 %) |
| Tous (652) | 652 (100 %) | 565 (87 %) | 652 (100 %) | 652 (100 %) | 232 (36 %) | 394 (60 %) | 275 (42 %) |

**Coût** : `data/` passe de 24,17 à 24,61 Mo (+0,45 Mo, +1,9 %) : `deputes.json` de 114 Ko à 562 Ko (21,6 Ko à 69,1 Ko compressé en gzip), `meta.json` +0,4 Ko ; les matrices et `scrutins.json` ne changent pas. En mémoire, les 652 fiches occupent 0,88 Mo de tas au lieu de 0,12 Mo (+0,76 Mo, mesuré après `JSON.parse` et ramasse-miettes) ; au démarrage, le serveur charge `data/` en 0,5 s pour un tas de 60 Mo (tampons 15 Mo, rss 175 Mo).

### Ce que la spec n'avait pas prévu

- `positionMajoritaire` ne peut pas servir de source (voir ci-dessus). Si on préfère la position officielle à la position calculée, il suffit de lire le champ dans `lire.mjs` et de l'utiliser dans `construire.mjs` ; elle est déjà lue (`positionOfficielle`) mais ignorée.
- Les titres sont ceux de l'archive : ils finissent par un point, qui est retiré dans les titres courts.
- La liste `groupes.json` est ordonnée par préséance officielle ; l'ancien UDR (index 10) précède le nouveau (index 11) et les non-inscrits (préséance 99) sont derniers.
