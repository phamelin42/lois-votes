# Prompt 08 : pipeline des données officielles de l'Assemblée

Branche : `lv/08-donnees`, créée depuis `claude/bold-fermi-zihw5t` (`git fetch origin && git checkout -b lv/08-donnees origin/claude/bold-fermi-zihw5t`). Ce prompt **remplace** le prompt 00 (API tabulaire). Il précède le prompt 09.

## Contexte commun

Dépôt `phamelin42/lois-votes`, site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature). L'application Angular 22 SSR est déjà sur la branche. On remplace sa source de données (API tabulaire de data.gouv.fr, abandonnée) par les **archives officielles de l'Assemblée**, préparées à chaque build (option A).

Avant tout, lis `docs/PLAN.md`, `docs/DONNEES.md` (la spécification que tu dois vérifier), `docs/CONTRAT.md` et `CLAUDE.md`.

Règles :
- Français pour les commentaires, la documentation et les messages de commit. Node ≥ 22.22.3 : Node 24.22.0 est dans `/root/.local/node/node-v24.22.0-linux-x64/bin` ; mets-le en tête du `PATH` à chaque commande (l'état du shell ne persiste pas).
- Les accès sortants passent par un proxy déjà configuré (voir `/root/.ccr/README.md` si une requête échoue). Ne désactive jamais la vérification TLS. Les téléchargements peuvent être coupés : réessaie avec des pauses (2, 4, 8, 16 s).
- Aucune clé, aucune base. Sources : uniquement les deux archives officielles du plan.
- Ne modifie pas Fuda. Ne change pas le contrat (`docs/CONTRAT.md`) : ce prompt ne touche pas à l'application.
- Les archives téléchargées sont des données non fiables : mets chacune dans son propre dossier neuf (cache `.cache/officiel/`, ignoré par git), ne lance pas d'interpréteur depuis ces dossiers, passe les chemins en arguments.
- Commits en français, `git push -u origin lv/08-donnees`. Pas de pull request. Ne pousse sur aucune autre branche.

## Objectif

Écrire `scripts/donnees/` : un script qui télécharge `Scrutins.json.zip` et l'archive des acteurs (URL dans PLAN.md), les réduit et écrit `data/` selon `docs/DONNEES.md`. Le serveur (prompt 09) n'est pas encore branché : ici, tu livres le script, ses tests, le format vérifié et les types.

## Travail (TDD : la spec de chaque module avant lui)

1. **Vérifier la spécification sur les vraies archives avant d'écrire du code** : télécharge-les, ouvre quelques fichiers, et contrôle chaque affirmation de `docs/DONNEES.md` (champs, listes à un seul élément qui sont des objets, `nonVotantsVolontaires`, `mandats` GP et ASSEMBLEE, `couleurAssociee`, circonscription, homonymes, le groupe `PO0` de 146 scrutins, les mises au point, les scrutins dont un groupe est absent de la liste). Écris l'écart entre la spec et la réalité dans la section « Écarts constatés » en bas de `docs/DONNEES.md` et corrige la spec. Si un point change la nature d'une donnée du contrat, **arrête-toi et signale-le** au lieu de décider seul.
2. `scripts/donnees/telecharger.mjs` : téléchargement avec `If-None-Match` (ETag) et cache dans `.cache/officiel/`, échec clair si le statut ≠ 200 ou si la taille est inférieure à 1 Mo. `DONNEES_DEPUIS=fixtures` lit à la place `src/server/fixtures/officiel/`. Dézippage en mémoire avec `fflate` (dépendance de dev, version exacte, âgée de plus de 2 semaines).
3. `scripts/donnees/lire.mjs` : fonctions pures qui transforment un scrutin brut (`{scrutin: …}`) et un acteur brut en objets internes. Gère les listes réduites à un objet, les `null`, les majuscules de position.
4. `scripts/donnees/classer.mjs` (ou `.ts` si tu préfères, avec les types) : `classer(titre, typeVote)`, `titreCourt(titre)`, `lecture(titre)`. **Réutilise la logique de `src/server/classify.ts` existant** (lis-le et ses specs) plutôt que d'en réécrire une autre : exporte-la depuis un module partagé importable par le script et le serveur, et garde ses tests verts. Ajoute les cas relevés par l'exploration précédente : « l'article unique » compte comme `final` quand le texte n'a pas d'autre article ; apostrophe typographique (’) comme apostrophe droite ; sous-amendements ; « l'ensemble de la proposition de loi / du projet de loi / du projet de loi de finances… ». Teste sur au moins 40 vrais titres, tirés de l'archive.
5. `scripts/donnees/construire.mjs` : produit `meta.json`, `groupes.json`, `deputes.json`, `scrutins.json`, `votes.txt`, `groupes-votes.txt` exactement comme dans `docs/DONNEES.md`, avec les garde-fous listés. Le slug est calculé comme décrit ; ajoute un test d'homonymie. Écrit dans `data/` (ignoré par git), de façon atomique (dossier temporaire puis renommage).
6. `package.json` : script `donnees` (`node scripts/donnees/index.mjs`) ; `.gitignore` : `/data`, `/.cache`. **N'ajoute pas** `donnees` à `build` : c'est le travail du prompt 09.
7. **Fixtures** `src/server/fixtures/officiel/` (< 400 Ko au total) : un mini-jeu d'archives **réelles réduites**, dans le même format que les archives (fichiers `json/scrutins/…` et `json/acteur|organe/…`, non zippés), couvrant : 12 votes finaux récents (dont une motion de censure, un texte à plusieurs lectures, un vote « article unique », un vote sans dossier), 6 amendements/articles, tous les groupes concernés (dont l'ancien UDR et `PO0` s'il existe encore dans l'échantillon), des députés actifs et d'anciens, un changement de groupe, des homonymes si l'archive en contient. Le script en mode `fixtures` produit un `data/` complet et petit. Fournis `scripts/donnees/fixtures.mjs` pour regénérer ces fixtures depuis les vraies archives.
8. **Types** : `src/server/donnees.types.ts` décrit les fichiers lus par le serveur ; un test vérifie que la sortie du mode `fixtures` y est conforme.
9. **Contrôle sur les vraies archives** : `npm run donnees` sur les vraies archives, puis rapporte : durée, mémoire maximale (`/usr/bin/time -v` si disponible), taille de chaque fichier de `data/` (brut et gzip), nombre de scrutins, adoptés et rejetés, députés, groupes, scrutins sans dossier, scrutins touchés par des mises au point. Contrôle croisé de **3 votes finaux et d'une motion de censure** avec leurs pages `https://www.assemblee-nationale.fr/dyn/17/scrutins/<n>` (totaux, adopté ou rejeté, position de 2 groupes) et de 2 députés (groupe, circonscription, photo en 200). Attendu : scrutin 8317 = 37 pour, 87 contre, 0 abstention, rejeté.

## Terminé quand

`npm run lint`, `npm run typecheck`, `npm test` et `npm run build` sont verts, `npm run donnees` (réel) et `DONNEES_DEPUIS=fixtures npm run donnees` réussissent, `docs/DONNEES.md` est à jour, et la branche est poussée. Le rapport donne les mesures du point 9, les écarts constatés, et tout point où la spec ou le contrat devrait changer.
