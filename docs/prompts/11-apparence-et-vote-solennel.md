# Prompt 11 : corrections visuelles et badge « vote solennel / vote ordinaire »

Branche : `lv/11-apparence`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion du prompt 10** (`git fetch origin && git checkout -b lv/11-apparence origin/claude/bold-fermi-zihw5t`).

## Contexte commun

Dépôt `phamelin42/lois-votes`, site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`), 17ᵉ législature. Le serveur lit `data/` (archives officielles de l'Assemblée préparées au build) en mémoire. Lis `docs/PLAN.md`, `docs/DONNEES.md`, `docs/CONTRAT.md` et `CLAUDE.md` avant de commencer.

Règles : Angular 22 (standalone, zoneless, signaux, `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl`, `ViewEncapsulation.None` avec classes BEM `app-*`), tokens Fuda uniquement (aucune couleur, longueur, durée ou courbe en dur dans un `.scss` : `conventions.spec.ts` le vérifie ; un `.scss` pèse au plus 4 Ko), textes et commits en français, ne modifie pas Fuda. Node 24 : `export PATH=/root/.local/node/node-v24.22.0-linux-x64/bin:$PATH` à chaque commande ; `npm ci` d'abord. Chromium dans `/opt/pw-browsers` (jamais `playwright install` ; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` si besoin). Ne tue pas de processus avec `pkill -f` : récupère le PID avec `ps`. Pas de pull request ; ne pousse que ta branche.

## Demandes de l'utilisateur

1. **Champ de recherche** : retirer le libellé « Rechercher » affiché au-dessus du champ et le mettre dans le `placeholder`, pour que le champ soit aligné avec le reste de l'en-tête. **Garde un nom accessible** (libellé visuellement masqué ou `aria-label`) : sans lui, axe échoue et les lecteurs d'écran perdent le nom du champ. Si le composant `fd-text-field` n'offre pas de libellé masqué, masque son libellé par une règle de ton composant (classe utilitaire « visuellement masqué » à partir de tokens ; pas de modification de Fuda).
2. **Cartes de loi** (`app-loi-card`) : **hauteur fixe, toujours la même**, quelle que soit la longueur du titre ou du résumé. Titre et titre officiel tronqués (`line-clamp`), pastilles de groupes sur une ligne, barre de vote en bas. Test e2e : sur l'accueil, toutes les cartes ont la même hauteur (mesure des `boundingBox`) à 375 px et à 1280 px, avec des titres courts et longs.
3. **Bouton « Voir plus »** : il est collé en bas de la page. Ajoute du `padding` haut et bas autour de la liste des lois, et de l'espace autour du bouton (tokens `--space-*`).
4. **`.app-group-pills`** : ajoute `justify-content: center`.

## Badge « vote solennel / vote ordinaire »

Le nombre de votants varie énormément : un **scrutin public solennel** (`typeVote.codeTypeVote === 'SPS'`) convoque tous les députés (364 à 574 votants sur les votes sur l'ensemble d'un texte, 531 en médiane) ; un **scrutin public ordinaire** (`SPO`) se tient en séance, avec seulement les députés présents dans l'hémicycle (23 à 476 votants, 144 en médiane, 160 des 225 votes sur l'ensemble d'un texte). Rien ne l'explique aujourd'hui à l'écran.

- **Pipeline** (`scripts/donnees/`, minimal) : ajoute `solennel: boolean` à chaque élément de `scrutins.json` (`typeVote.codeTypeVote === 'SPS'`) ; mets à jour `src/server/donnees.types.ts`, `docs/DONNEES.md`, les fixtures si nécessaire et leurs specs. Ne change rien d'autre au format.
- **Contrat** (`docs/CONTRAT.md` puis `src/shared/contrat.ts`, `contrat.spec.ts`) : `ScrutinResume.solennel: boolean`.
- **Serveur** : `agregation.ts` l'expose partout où `ScrutinResume` est produit.
- **Interface** : un `fd-badge` « Vote solennel » ou « Vote ordinaire » sur les cartes, les pages loi et scrutin ; sur les pages loi et scrutin, une phrase : « Vote solennel : tous les députés sont convoqués. » / « Vote ordinaire : en séance, seuls les députés présents dans l'hémicycle votent. » `/a-propos` : explique la différence et pourquoi la participation d'un député paraît basse. Le badge ne porte pas seul l'information par la couleur (texte écrit).

## Terminé quand

`npm run lint`, `typecheck`, `test`, `build:fixtures` et `npm run e2e` sont verts ; axe sans violation en Jour et en Nuit ; tests e2e de hauteur des cartes verts ; vérification visuelle à 375 px et 1280 px en Jour et en Nuit (décris-la, joins des captures hors dépôt). Avec les vraies archives (`npm run build`, réseau permettant) : `/api/scrutins/4696` (solennel, 574 votants) donne `solennel: true` et `/api/scrutins/1018` (23 votants) `solennel: false`. Rapport : ce qui est fait, valeurs contrôlées, écarts, ce qui n'a pas pu être fait. Commits en français, `git push -u origin lv/11-apparence`.
