# Prompt 10 : afficher ceux qui ont voté et ceux qui n'ont pas voté

Branche : `lv/10-votants-absents`, créée depuis `claude/bold-fermi-zihw5t` (`git fetch origin && git checkout -b lv/10-votants-absents origin/claude/bold-fermi-zihw5t`).

## Contexte commun

Dépôt `phamelin42/lois-votes`, site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`), 17ᵉ législature. Le serveur lit `data/` (archives officielles de l'Assemblée préparées au build) en mémoire ; tout est déjà en place. Lis `docs/PLAN.md`, `docs/DONNEES.md`, `docs/CONTRAT.md` et `CLAUDE.md` avant de commencer.

Règles : Angular 22 (standalone, zoneless, signaux, `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl`, tokens Fuda uniquement, aucune valeur de style en dur), textes et commits en français. Node 24 est dans `/root/.local/node/node-v24.22.0-linux-x64/bin` (mets-le en tête du `PATH` à chaque commande ; fais `npm ci` d'abord). Chromium préinstallé dans `/opt/pw-browsers` : jamais `playwright install` ; utilise `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` si besoin. Pas de pull request. Ne pousse que `lv/10-votants-absents`. Ne modifie pas `scripts/donnees/` ni le format de `data/`.

## La demande de l'utilisateur

« Le but est de montrer le taux de participation. On doit afficher le pourcentage de pour / contre / abstention sur le nombre de députés présents ET le nombre d'absents. »

Aujourd'hui l'interface ne montre que des nombres bruts de pour, contre et abstentions, et la participation d'un député en un seul chiffre (11 % pour Sébastien Chenu, parce que la plupart des scrutins n'ont que ~130 votants sur 577), sans dire combien de députés n'ont pas voté.

## Vocabulaire (décision prise, à respecter)

L'Assemblée ne publie pas la présence en séance : le projet interdit « présence ». Dis donc **« ont voté »** (pour + contre + abstention) à la place de « présents », et **« n'ont pas voté »** (non-votants officiels + absents, soit `enMandat − votants`) à la place de « absents ». La page `/a-propos` explique pourquoi (un député peut être en séance sans voter, ou voter par délégation, et les mises au point ne sont pas appliquées). Mets à jour la règle de vocabulaire dans `CLAUDE.md` en conséquence (« participation aux scrutins », « ont voté », « n'ont pas voté » ; jamais « présence »).

## Travail

1. **Contrat** (`docs/CONTRAT.md` d'abord, puis `src/shared/contrat.ts` identique ; `contrat.spec.ts` le vérifie) :
   - `ScrutinResume.enMandat: number` : députés en mandat ce jour-là, soit les cases ≠ `-` de la matrice. Votants = `pour + contre + abstention` ; n'ont pas voté = `enMandat − votants` (il inclut les non-votants officiels `N`).
   - `DeputeDetail.scrutins: { enMandat: number; pour: number; contre: number; abstention: number; nonVote: number }` : ses scrutins en mandat, répartis ; `nonVote` = cases `N` + `X`. Les taux existants restent.
2. **Serveur** (`src/server/donnees.ts`, `agregation.ts`, specs) : `enMandat` par scrutin, calculé une fois au chargement par comptage des cases ≠ `-` (aucun changement du format de `data/`), exposé dans tout `ScrutinResume`, y compris celui des cartes d'accueil, des lectures et des scrutins d'une loi. Les compteurs de `DeputeDetail.scrutins` se calculent dans la boucle de `taux()` existante. Tests sur les fixtures : `enMandat ≥ pour + contre + abstention` pour chaque scrutin ; pour chaque député, `pour + contre + abstention + nonVote = enMandat` et `taux.participation = (pour + contre + abstention) / enMandat`.
3. **Interface** : la couleur ne porte jamais seule l'information ; tout est écrit.
   - `app-vote-bar` : la barre garde sa base (les votants, pour que l'écart pour/contre reste lisible). Sous la barre : pourcentages écrits (« 27 % pour · 64 % contre · 9 % abst. », formatés `fr-FR`, somme arrondie sans dépasser 100 de façon visible) et, quand l'entrée facultative `enMandat` est fournie, une ligne « **N n'ont pas voté sur M en mandat (x %)** ». `aria-label` complet. Les petites barres par groupe n'ont pas cette ligne.
   - `app-group-table` : les nombres gardent leur colonne, les pourcentages (sur les votants du groupe) s'ajoutent à côté. Ajoute une note « Groupes sans aucun votant sur ce scrutin : … » : groupes de `groupes.json` dont `debut`/`fin` couvre la date du scrutin et qui n'apparaissent pas dans ses groupes (c'est le cas de 82 des 235 votes finaux, qu'on masque aujourd'hui sans l'expliquer). Si cela demande plus que quelques lignes ou touche au contrat, laisse-le de côté et dis-le dans ton rapport.
   - `app-loi-card`, pages loi et scrutin : la barre avec `enMandat`.
   - **Fiche d'un député** : la tuile « Participation aux scrutins » montre le pourcentage et « a voté à *n* scrutins sur *m* en mandat, n'a pas voté à *k* » ; une nouvelle tuile « Ses votes » donne pour / contre / abstention en pourcentage de ses votes (petite barre + texte) ; abstention et loyauté restent. Garde la formulation neutre (« il ou elle »).
   - `/a-propos` : définitions de « ont voté » et « n'ont pas voté » et la raison du vocabulaire.
4. **Tests** : specs de chaque composant modifié (pourcentages, ligne « n'ont pas voté », `aria-label`, zéro votant sans division par zéro, arrondis), des pages concernées, de `agregation.ts` et des routes (types du contrat). Mets à jour les e2e touchés (`e2e/ssr.spec.ts` : le député affiche sa participation et ses votes sans JavaScript) ; axe sans violation en Jour et en Nuit.
5. **Docs** : `docs/DONNEES.md` (section « Calculs faits par le serveur »), `docs/PLAN.md`, `CLAUDE.md`.

## Terminé quand

`npm run lint`, `typecheck`, `test`, `build:fixtures` et `npm run e2e` sont verts. Avec les **vraies** archives (`npm run build`, réseau permettant) puis `npm run serve:ssr` : `/api/scrutins/8433` donne 351 / 179 / 7, adopté, avec un `enMandat` cohérent ; `/api/deputes/sebastien-chenu` vérifie `pour + contre + abstention + nonVote = enMandat`. Rapporte ces valeurs, les écarts par rapport au prompt, et tout ce que tu n'as pas pu faire. Commits en français, `git push -u origin lv/10-votants-absents`.
