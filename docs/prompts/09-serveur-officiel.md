# Prompt 09 : serveur sur les données officielles, déploiement et mise à jour nocturne

Branche : `lv/09-serveur-officiel`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion de 08**. Ce prompt **remplace** le prompt 02 (BFF sur l'API tabulaire).

## Contexte commun

Dépôt `phamelin42/lois-votes`, site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`), 17ᵉ législature. Le prompt 08 a livré `scripts/donnees/` qui produit `data/` (format : `docs/DONNEES.md`, types : `src/server/donnees.types.ts`, mode `DONNEES_DEPUIS=fixtures`). Tu branches le serveur dessus et tu retires tout ce qui touchait à data.gouv.fr, NosParlementaires et Datan.

Avant tout, lis `docs/PLAN.md` (dont « Décisions validées »), `docs/DONNEES.md` (vérifié sur les vraies archives par le prompt 08, écarts constatés compris), `docs/CONTRAT.md` et `CLAUDE.md` (encore rédigé pour l'ancienne source : tu le réécris).

Règles :
- Angular 22 : standalone, zoneless, signaux, `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl`, tokens Fuda uniquement, textes en français. Français pour la documentation et les messages de commit.
- Node ≥ 22.22.3 : Node 24.22.0 est dans `/root/.local/node/node-v24.22.0-linux-x64/bin` ; mets-le en tête du `PATH` à chaque commande.
- Aucune clé, aucune base, aucune requête externe à l'exécution. Ne modifie pas Fuda. Ne modifie pas `scripts/donnees/` sans le signaler : le prompt 08 en a validé le format ; si tu y trouves un défaut, corrige-le avec son test et dis-le dans ton rapport.
- Le contrat (`docs/CONTRAT.md` et `src/shared/contrat.ts`) a déjà été mis à jour dans `docs/` : recopie ces changements dans `src/shared/contrat.ts` et vérifie qu'ils sont identiques (le test `contrat.spec.ts` le contrôle). Tu ne changes pas le contrat au-delà ; si un besoin l'impose, mets à jour les deux fichiers ensemble et signale-le.
- Commits en français, `git push -u origin lv/09-serveur-officiel`. Pas de pull request. Ne pousse sur aucune autre branche.
- Terminé = `npm run lint`, `typecheck`, `test`, `build` verts, puis `npm run e2e` et `npm run perf`.

## Décisions déjà prises (ne pas les rouvrir)

- **Position d'un groupe** : celle de `scrutins.json` (calculée sur les décomptes). N'utilise jamais la `positionMajoritaire` de l'archive.
- **`X` dans `votes.txt`** = député en mandat mais absent. Participation = (P+C+A) / (P+C+A+N+X) sur les cases ≠ `-` ; une case `X` donne `position: null` dans `VoteDepute` ; `-` = pas en mandat (aucun vote affiché).
- **Photo** : `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/<numéro SANS le préfixe PA>.jpg` (avec `PA`, 404). **Fiche** : `https://www.assemblee-nationale.fr/dyn/deputes/<PA avec préfixe>`.
- **`nom`** d'un député peut contenir une précision d'homonyme (« Alexandra Martin (Gironde) ») : garde-la pour l'affichage et le slug, retire-la pour le tri (`nomTri` est déjà fourni).
- **`lecture`** peut valoir « texte de la commission mixte paritaire » : affiche-la telle quelle. Les `titre` officiels finissent par un point, retiré dans les titres courts.
- **66 % des scrutins n'ont pas de dossier** (dont 154 des 235 votes finaux) : l'accueil et la fiche d'un député les lient vers `/scrutins/:numero`, jamais vers une page de loi vide.
- `classify.ts` réexporte `src/shared/classer.ts` : utilise-le pour le titre court et la lecture.

## Objectif

Le serveur lit `data/` au démarrage et répond à toutes les routes `/api/*` depuis la mémoire, sans réseau. `npm run build` prépare `data/` puis construit l'application ; un workflow GitHub redéploie chaque nuit.

## Travail

1. **`src/server/donnees.ts`** : charge `data/` (dossier `DONNEES_DIR` ou `data/` à côté de `server.mjs`, soit `dist/lois-votes/data/`), valide les tailles (lignes des matrices = nombre de scrutins, longueur = nombre de députés), expose des accès typés. Si `data/` manque ou est invalide : erreur claire, routes `/api/*` en 503 `no-store` (jamais un faux contenu). Mesure et journalise le temps de chargement et la mémoire.
2. **`src/server/agregation.ts`** (réécrit) : produit les types du contrat à partir de `data/`, selon le calcul décrit dans `docs/DONNEES.md` : accueil (votes finaux, par date puis numéro décroissants, `pageSuivante`, `miseAJour` = `meta.genereLe`), loi (regroupement par `dossier`, vote final = le plus récent, `lectures`, `scrutins`, titres courts et lecture dérivés par `classify.ts`), scrutin (groupes officiels, `nominatif` par groupe et position), députés (index des actifs, groupe actuel), député (photo, `urlFiche`, taux calculés, 10 derniers votes finaux avec `positionGroupe`). `scrutins.json` pèse 12,4 Mo : garde en mémoire une forme compacte (index par numéro et par dossier, groupes lus à la demande) et **mesure la mémoire du serveur** après chargement (objectif : bien sous la limite d'une fonction Vercel Hobby ; rapporte le chiffre). Mémoïse les calculs coûteux (liste des votes finaux, regroupement par dossier).
3. **`index-deputes.ts`, `bff.ts`, `routes.ts`, `server.ts`, `seo.ts`** : adapte-les ; `appelerBffActif` n'a plus de limiteur ni de compteur de requêtes sources ; le mode `MOCK_BFF` et `fixtures/bff/` disparaissent au profit du mode `fixtures` du prompt 08. Conserve les routes, `Cache-Control`, validations de paramètres, journal (`[bff] url statut durée`). Le sitemap utilise `data/`.
4. **Supprime** : `src/server/source/` (tabulaire, limiteur, ressources, colonnes), `src/server/groupes.ts` (les couleurs viennent des organes), `src/server/mock-bff.ts`, `src/server/testing/`, `src/server/fixtures/bff/`, `e2e/faux-tabulaire.mjs`, les variables `TABULAR_API_BASE`, `RID_*`, `MOCK_BFF`, et toute mention de data.gouv.fr, Datan et NosParlementaires dans le code, les tests et la documentation de référence (`CLAUDE.md`, `README.md`). Vérifie avec `git grep -i -E "datan|nosparlementaires|data\.gouv|tabulaire|RID_|MOCK_BFF"`.
5. **Application** : adapte `src/app/` au contrat modifié (groupe identifié par son `id` officiel et affiché par `abrege` ; les filtres `?groupe=` des députés continuent de fonctionner, en filtrant sur l'abrégé pour que les deux organes « UDR » soient confondus ; `taux` calculés). Textes : retire « d'après Datan » ; les trois chiffres du profil sont libellés comme calculés « d'après les scrutins publics » avec une phrase qui explique le calcul ; pied de page « Données : Assemblée nationale (data.assemblee-nationale.fr), Licence Ouverte 2.0 » et date de mise à jour ; `/a-propos` : source officielle, mise à jour nocturne, définitions des taux, limites (groupe actuel pour la fiche d'un député, groupe du jour du vote pour les scrutins ; mises au point non appliquées ; la participation n'est pas la présence en séance). Met à jour les specs concernées.
6. **Build et déploiement** : `package.json` : `build` = `node scripts/donnees/index.mjs && ng build` et une copie de `data/` vers `dist/lois-votes/data/` (étape dans le script ou dans `angular.json`) ; ajoute `build:fixtures` (même chose avec `DONNEES_DEPUIS=fixtures`) ; `start` utilise le mode fixtures. `vercel.json` : la fonction embarque `dist/lois-votes/**` (inclut `data/`) ; vérifie dans la documentation actuelle de Vercel que `buildCommand: npm run build` s'exécute avec accès réseau et que la taille de la fonction reste sous la limite.
7. **Mise à jour nocturne** : `.github/workflows/actualiser.yml` : `schedule` quotidien (`30 5 * * *`, UTC) et `workflow_dispatch` ; une étape appelle le Deploy Hook (`curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL"`), échoue clairement si le secret est absent. Rien d'autre (pas de checkout). Documente dans `README.md` les deux gestes de l'utilisateur : créer le Deploy Hook dans Vercel (branche `main`) et ajouter le secret GitHub `VERCEL_DEPLOY_HOOK_URL`.
8. **Tests et CI** : specs de `donnees.ts` (valide, invalide, manquant), de `agregation.ts` sur le jeu fixtures (sommes des groupes = décompte du scrutin ; 10 derniers votes ; lectures ; taux sur un député connu ; `positionGroupe`), des routes (types du contrat, `Cache-Control`). `playwright.config.ts` : un seul serveur SSR construit sur le jeu fixtures (et un second sans `data/` pour la dégradation 503) ; adapte `e2e/` (les parcours, SSR sans JS, hydratation sans requête `/api`, pré-chargement, axe Jour et Nuit, clavier, Umami, dégradation). `ci.yml` : `build:fixtures`, aucune dépendance réseau externe.
9. **Documentation** : `CLAUDE.md` et `README.md` mis à jour (commandes, structure, règle « données officielles préparées au build »). `docs/prompts/README.md` marque 00 et 02 comme remplacés.

## Vérification (rapporte les résultats)

- `lint`, `typecheck`, `test`, `build` (avec les **vraies** archives si le réseau le permet, sinon `build:fixtures`, et dis-le), `e2e`, `perf`.
- `npm run serve:ssr` avec les vraies données : chaque route répond ; temps de réponse à chaud ; temps de chargement et mémoire de `donnees.ts` ; coupe l'accès réseau (ou vérifie dans le journal) : aucune connexion sortante.
- Compare avec les pages officielles : 2 votes finaux (totaux, adopté ou rejeté, position de 2 groupes) et 2 profils (groupe actuel, circonscription, photo).
- Taille de `dist/lois-votes/` et de la fonction.
