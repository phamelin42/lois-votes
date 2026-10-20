# Prompt 15 : corriger le nombre de députés « en mandat » (suppléants et suspensions)

Branche : `lv/15-effectif`, créée depuis `claude/bold-fermi-zihw5t` (`git fetch origin && git checkout -b lv/15-effectif origin/claude/bold-fermi-zihw5t`).

## Contexte commun

Dépôt `phamelin42/lois-votes`, site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`), 17ᵉ législature. Le serveur lit `data/` (archives officielles de l'Assemblée préparées au build, `scripts/donnees/`) en mémoire. Lis `docs/PLAN.md`, `docs/DONNEES.md`, `docs/CONTRAT.md` et `CLAUDE.md` avant de commencer.

Règles : textes et commits en français, ne modifie pas Fuda. Node 24 : `export PATH=/root/.local/node/node-v24.22.0-linux-x64/bin:$PATH` à chaque commande, `NODE_USE_ENV_PROXY=1` pour que Node atteigne le réseau ; `npm ci` d'abord. Chromium dans `/opt/pw-browsers` (jamais `playwright install` ; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` si besoin). Ne tue pas de processus avec `pkill -f` (récupère le PID avec `ps`). Les téléchargements peuvent être coupés par le proxy : réessaie (2, 4, 8, 16 s), ne désactive jamais la vérification TLS. Pas de pull request ; ne pousse que ta branche.

## Le bug (mesuré, déjà en production)

Le nombre de députés « en mandat » ce jour-là (`ScrutinResume.enMandat` = cases ≠ `-` de `votes.txt`) est **trop élevé**, donc « N n'ont pas voté sur M en mandat » est faux :

| Scrutin | Date | Votants | `enMandat` (site) | Effectif officiel (Σ `nombreMembresGroupe`) | « n'ont pas voté » site / officiel |
|---|---|---|---|---|---|
| 4696 | 2025-12-09 | 574 | 609 | 575 | 35 / **1** |
| 1018 | 2025-03-13 | 23 | 628 | 575 | 605 / 552 |
| 8433 | 2026-07-21 | 537 | 585 | 577 | 48 / 40 |
| 8317 | 2026-07-16 | 124 | — | 577 | — / 453 |

**Cause trouvée** : l'archive des acteurs garde des mandats `ASSEMBLEE` de la 17ᵉ **ouverts sans interruption** (`dateDebut: 2024-07-07`, `dateFin: null`) pour des députés dont un **suppléant a siégé à leur place** pendant une longue période (membres du gouvernement, etc.). Exemples dans `deputes.json` : Éric Gérard (`PA642734`, 2 votes en 8 894 scrutins, premier vote le 2026-10-13), Pauline Cestrières (`PA718820`, premier vote le 2026-10-14), Jérôme End (`PA720390`, premier vote le 2026-10-13). Pendant deux ans ils sont comptés « en mandat » (case `X`), ce qui gonfle `enMandat` de 30 à 50 et **fausse leur participation** (≈ 0 %). Hypothèse « ils sont membres du gouvernement » testée et **insuffisante** (1 sur 35 seulement a un mandat `GOUVERNEMENT` à la date).

Ce que les données officielles semblent permettre (**à vérifier avant de coder**) : le mandat du **suppléant** porte `mandature.mandatRemplaceRef` (identifiant du mandat remplacé) avec ses propres `dateDebut` / `dateFin` ; l'intervalle du suppléant est donc la **période de suspension** du titulaire.

## Travail

1. **Explore et mesure d'abord** (consigne dans `docs/DONNEES.md`, section « Effectif en mandat ») :
   - lis un mandat de suppléant et le mandat remplacé pour 5 cas (dont les trois ci-dessus) : champs `mandatRemplaceRef`, `suppleants`, `causeFin`, dates ;
   - calcule, sur **tous** les scrutins, l'écart `enMandat − Σ nombreMembresGroupe` (distribution, extrêmes, évolution dans le temps) avant et après ta correction ;
   - cherche les autres causes possibles (décès, démission, remplacement par élection partielle, annulation d'élection, jours de chevauchement titulaire/successeur).
2. **Corrige le pipeline** (`scripts/donnees/construire.mjs`, `lire.mjs`) : retire de la période « en mandat » d'un titulaire les **intervalles de suspension** établis à partir des mandats de suppléants (et de toute autre règle que tes mesures justifient, documentée). Dans `votes.txt`, un député hors période est `-` (pas en mandat), comme aujourd'hui pour un député non encore élu ; le **format des fichiers ne change pas**. `enMandat` et la participation (`taux()`) deviennent justes sans changer l'interface. Cas limite : le jour du remplacement (titulaire et suppléant le même jour) : choisis une règle, justifie-la, teste-la.
3. **Garde-fou** : le build compare, pour chaque scrutin, `enMandat` à `Σ nombreMembresGroupe` (effectif officiel). Mesure d'abord ce que tu obtiens, puis fixe les seuils : écart toléré par scrutin, nombre de scrutins hors tolérance autorisé. **Un écart modéré est un avertissement** (journal et `meta.avertissements`), **pas un échec** : un build qui échoue sur une anomalie de données bloquerait aussi la mise à jour nocturne ; l'échec est réservé à un écart grossier (par exemple plus de 20, valeur à justifier par tes mesures).
4. **Tests** : specs sur de **vrais fragments** (le suppléant et le titulaire de deux cas réels, dont les dates), cas limites (jour du remplacement, mandat sans suppléant, plusieurs suspensions), le garde-fou. Un test applique, quand `DONNEES_DIR` pointe un `data/` réel, la comparaison à l'effectif officiel sur tous les scrutins. Fixtures : mets à jour celles de `src/server/fixtures/officiel/` pour inclure au moins un cas de suspension réel (suppléant et titulaire), et les specs de `agregation.ts` qui en dépendent.
5. **Vérification en réel** (`npm run build` avec les vraies archives, puis `npm run serve:ssr`) : rapporte, pour les scrutins 4696, 1018, 8433, 8317 et 8877, `enMandat` et l'effectif officiel ; la distribution de l'écart sur tous les scrutins ; la participation d'Éric Gérard, de Pauline Cestrières, de Jérôme End et de Sébastien Chenu avant et après (attendu : Chenu quasi inchangé ; les trois autres nettement plus hautes et plausibles) ; le nombre de députés dont la participation change de plus de 5 points.
6. **Docs** : `docs/DONNEES.md` (règle, mesures, écarts résiduels), `docs/PLAN.md`, `CLAUDE.md`, et `/a-propos` si l'explication des limites doit changer. N'ajoute rien au contrat si ce n'est pas nécessaire.

## Terminé quand

`npm run lint`, `typecheck`, `test`, `build:fixtures` et `npm run e2e` sont verts (axe sans violation) ; `DONNEES_DIR=data npm test` passe sur des données réelles ; l'écart `enMandat − effectif officiel` est **réduit à quelques unités** sur la quasi-totalité des scrutins (donne les chiffres exacts et explique les exceptions). Rapport : cause confirmée (ou infirmée) avec les 5 cas lus, règle retenue, distribution avant/après, valeurs réelles contrôlées, écarts, ce qui n'a pas pu être fait. Commits en français, `git push -u origin lv/15-effectif`.
