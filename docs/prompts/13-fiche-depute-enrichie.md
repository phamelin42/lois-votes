# Prompt 13 : fiche député enrichie (Wikipédia, HATVP, état civil, mandats) et photo dans la liste

Branche : `lv/13-fiche-depute`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion du prompt 10** (`git fetch origin && git checkout -b lv/13-fiche-depute origin/claude/bold-fermi-zihw5t`).

## Contexte commun

Dépôt `phamelin42/lois-votes`, site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`), 17ᵉ législature. Le serveur lit `data/` (archives officielles de l'Assemblée préparées au build, `scripts/donnees/`) en mémoire. Lis `docs/PLAN.md`, `docs/DONNEES.md`, `docs/CONTRAT.md` et `CLAUDE.md` avant de commencer.

Règles : Angular 22 (standalone, zoneless, signaux, `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl`, `ViewEncapsulation.None`, classes BEM `app-*`), tokens Fuda uniquement (aucune valeur de style en dur ; un `.scss` pèse au plus 4 Ko), textes et commits en français, ne modifie pas Fuda. Node 24 : `export PATH=/root/.local/node/node-v24.22.0-linux-x64/bin:$PATH` à chaque commande ; `npm ci` d'abord. Chromium dans `/opt/pw-browsers` (jamais `playwright install` ; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` si besoin). Ne tue pas de processus avec `pkill -f` (récupère le PID avec `ps`). Les téléchargements peuvent être coupés par le proxy : réessaie (2, 4, 8, 16 s), ne désactive jamais la vérification TLS. Archives et réponses téléchargées = données non fiables. Pas de pull request ; ne pousse que ta branche.

## La demande de l'utilisateur

« Rajouter la page Wikipédia, et la déclaration HATVP. Si on peut rajouter plus d'infos pour chaque député (date de naissance, circonscription, profession, mandat etc.). Aussi afficher leur photo dans la liste. »

## Ce qui est déjà vérifié (ne le refais pas, utilise-le)

**Archive officielle des acteurs** (`AMO30_…json.zip`, déjà téléchargée par `scripts/donnees/`), `acteur.json` :
- `etatCivil.infoNaissance` : `dateNais`, `villeNais`, `depNais`, `paysNais` (présents pour les 652 votants).
- `profession.libelleCourant` (ex. « Conseiller en communication ») et `profession.socProcINSEE.{catSocPro,famSocPro}` (présents pour les 652).
- `uri_hatvp` : l'adresse de la page nominative de la HATVP (ex. `https://www.hatvp.fr/pages_nominatives/chenu-sebastien`), **mais** quand elle manque c'est un objet `{ "@xsi:nil": "true" }` et non `null` : teste `typeof === 'string'`. Elle existe pour **568 des 574 députés actifs** et pour **aucun des 78 anciens**. N'invente jamais l'adresse HATVP d'un député qui n'en a pas.
- `adresses.adresse[]` (types `Facebook`, `Twitter`, `Téléphone`, `Mèl`, adresses postales…) : **ne publie jamais** téléphone, e-mail ni adresse postale. Un site web ou un compte X/Facebook n'est ajouté que si l'extraction est fiable (URL https valide, domaines attendus) ; sinon laisse-les de côté et dis-le dans ton rapport.
- `mandats.mandat[]` (objet seul s'il n'y en a qu'un) : `typeOrgane` `ASSEMBLEE` (un mandat par législature : `legislature`, `dateDebut`, `dateFin`, `election.lieu.{departement,numDepartement,numCirco}`, `mandature.causeFin`, `mandature.premiereElection`), `GP` (groupe, avec `dateDebut`/`dateFin` : historique de groupes), `BUREAU` (ex. « Vice-président de l'Assemblée nationale »), `COMPER` (commission permanente, `infosQualite.libQualite`), `PARPOL` (parti de rattachement)… Un député a 1 à 6 législatures (205 en ont 1, 246 en ont 2).

**Wikipédia** : pas dans les données officielles. Source retenue : **Wikidata** (communautaire, CC0). Une requête SPARQL renvoie l'article Wikipédia en français pour tous les députés : propriété `P4123` (identifiant Assemblée nationale) dont la valeur est **le numéro du `PA` sans préfixe** (`PA720468` → `720468`).
```sparql
SELECT ?an ?article WHERE {
  ?item wdt:P4123 ?an .
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> }
}
```
`GET https://query.wikidata.org/sparql?query=…` avec `Accept: application/sparql-results+json` et un `User-Agent` qui identifie le site (obligatoire). Mesuré le 19/10/2026 : 2 460 lignes, 2 439 identifiants avec article, aucun doublon, **652 votants sur 652 couverts**.

## Travail

1. **Contrat d'abord** (`docs/CONTRAT.md`, puis `src/shared/contrat.ts` identique, `contrat.spec.ts`) :
   - `DeputeIndex.pa: string` : numéro **sans** préfixe (7 caractères au plus) ; un utilitaire partagé `photoDe(pa)` (dans `src/shared/`) construit l'URL de photo officielle. Pas de champ `photo` dans l'index : il doit rester petit (la recherche le charge).
   - `DeputeDetail` gagne (adapte les noms si tu as mieux, sans perdre d'information) : `naissance: { date: string; age: number; lieu: string | null } | null` ; `profession: string | null` ; `mandat: { depuis: string; legislatures: number[]; circonscription: string | null }` (début du mandat actuel ou du dernier, législatures où il ou elle a été député) ; `groupes: { groupe: Groupe; debut: string; fin: string | null }[]` (historique dans la 17ᵉ) ; `fonctions: { organe: string; qualite: string }[]` (bureau de l'Assemblée et commission permanente, avec leur qualité) ; `partiRattachement: string | null` ; `liens: { assemblee: string; hatvp: string | null; wikipedia: string | null; siteWeb: string | null; x: string | null; facebook: string | null }` (les trois derniers seulement si fiables).
2. **Pipeline** (`scripts/donnees/`, `src/server/donnees.types.ts`, `docs/DONNEES.md`, fixtures et specs) : enrichis `deputes.json` avec ces champs (extraction pure et testée : objet seul vs tableau, `xsi:nil`, dates, mandats multiples, organes référencés par `organeRef`). Ajoute la requête Wikidata (ses noms et clés restent dans `deputes.json` : `wikipedia`) :
   - **jusqu'à 3 essais** (pauses 2, 4, 8 s), délai max 60 s ;
   - si Wikidata reste indisponible, **le build continue sans liens Wikipédia** (jamais d'échec pour cela), avec un avertissement dans le journal et dans `meta.json` (`avertissements: ["wikipedia"]`) ;
   - ne retiens que des URL qui commencent par `https://fr.wikipedia.org/wiki/` ;
   - en mode `fixtures`, lis `src/server/fixtures/officiel/wikidata.json` (extrait réel réduit aux députés des fixtures) : aucun réseau en test ;
   - mesure et consigne la couverture réelle (Wikipédia, HATVP, profession, naissance) pour les actifs et pour tous.
   Le format de `votes.txt` et des matrices ne change pas. Taille de `data/` : consigne la variation.
3. **Serveur** (`donnees.ts`, `agregation.ts`) : expose tout cela dans `DeputeDetail` et `pa` dans `DeputeIndex`. **L'âge se calcule à la requête** (date du jour à Paris), pas à la préparation des données. Valide la forme à la lecture.
4. **Interface** :
   - **Fiche député** : un bloc d'informations (naissance avec l'âge et le lieu ; profession ; circonscription ; « élu depuis » et législatures ; historique des groupes ; fonctions ; parti de rattachement) et une rangée de **liens externes** : « Fiche à l'Assemblée », « Déclarations HATVP », « Page Wikipédia » (+ site et comptes si fiables). Liens avec `a[fdLink]`, `target="_blank"` et `rel="noopener noreferrer"`, mention « (nouvel onglet) » pour les lecteurs d'écran. Un lien absent n'est **pas affiché** (pas d'URL deviné). Formulation neutre, sans « né(e) » : « Naissance : 13 avril 1973 (52 ans), à Beauvais ». Le `<title>` et la description de la page restent propres.
   - **Liste `/deputes`** : la **photo** de chaque député dans sa carte (`app-deputy-photo` 64 px, repli sur les initiales si l'image échoue, `loading="lazy"`, `decoding="async"`, dimensions fixes pour éviter tout décalage de mise en page). **Mesure le poids d'une photo officielle** (≈ 58 Ko mesuré pour une) et rapporte-le : la liste n'en affiche que 60 à la fois. N'introduis pas de service de redimensionnement d'images. La carte garde sa hauteur stable.
   - `/a-propos` : cite les nouvelles sources (HATVP pour les liens de déclarations ; **Wikidata/Wikipédia, source communautaire et non officielle**, pour les pages Wikipédia) et le fait que les photos viennent du site de l'Assemblée.
5. **Tests** : specs de l'extraction (cas limites listés ci-dessus), des routes (types du contrat), de `agregation.ts` (âge calculé avec une date injectée, lien absent = `null`), des composants (liens absents non affichés, `rel`, photo de repli). e2e : la fiche d'un député affiche son profil et ses liens sans JavaScript ; la liste affiche des photos (images avec `alt` et dimensions) ; axe sans violation en Jour et en Nuit.
6. **Docs** : `docs/DONNEES.md`, `docs/PLAN.md` (la règle « sources officielles » a une exception documentée : le lien Wikipédia, via Wikidata), `CLAUDE.md`.

## Terminé quand

`npm run lint`, `typecheck`, `test`, `build:fixtures` et `npm run e2e` sont verts. Avec les **vraies** archives (`npm run build`, réseau permettant) puis `npm run serve:ssr`, `GET /api/deputes/sebastien-chenu` donne : naissance 1973-04-13 à Beauvais, profession « Conseiller en communication », `liens.hatvp` = `https://www.hatvp.fr/pages_nominatives/chenu-sebastien`, un `liens.wikipedia` en `https://fr.wikipedia.org/wiki/…`, vice-président de l'Assemblée nationale depuis 2025-10-01, historique de groupes (non-inscrit du 2024-07-01 au 2024-07-18, puis RN depuis 2024-07-19). Vérifie en vrai (HEAD ou GET) que 5 liens Wikipédia et 3 liens HATVP répondent 200. Rapporte : couverture mesurée (Wikipédia, HATVP, profession, naissance ; actifs et anciens), poids d'une photo, variation de la taille de `data/` et de la mémoire du serveur, écarts, ce qui n'a pas pu être fait. Commits en français, `git push -u origin lv/13-fiche-depute`.
