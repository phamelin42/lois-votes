# Prompt 04 : composants d'interface, shell et vue de l'accueil

Branche : `lv/04-ui`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion de 01**. Elle tourne en parallèle de 02 et 03.

## Contexte commun

Tu travailles sur le dépôt `phamelin42/lois-votes`, le site « Qui a voté quoi ? » (`quiavotequi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature).

Avant tout, lis :
- `docs/PLAN.md` : décisions, architecture, constats sur les données ;
- `docs/CONTRAT.md` : les types échangés entre le serveur (`/api/*`) et l'application ;
- `CLAUDE.md` à la racine s'il existe (créé par le prompt 01) ;
- les conventions de Fuda, `CLAUDE.md` du dépôt `phamelin42/design-system-fuda`.

Règles :
- Angular 22 : standalone, zoneless, signaux (`input()`, `computed()`, `httpResource()`…), `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl` séparés, `ViewEncapsulation.None` avec classes BEM préfixées `app-`, tokens Fuda uniquement (aucune couleur, durée ni espacement en dur).
- Français pour les libellés, la documentation et les messages de commit.
- Node ≥ 22.22.3. Si `node --version` est plus ancien, télécharge Node 24 depuis nodejs.org, vérifie-le avec `SHASUMS256.txt` et mets-le en tête du `PATH`.
- Ne modifie pas Fuda. Ne versionne jamais la clé API (`NOSPARLEMENTAIRES_API_KEY` vient de l'environnement).
- Ne change pas le contrat sans mettre à jour `docs/CONTRAT.md` et `src/shared/contrat.ts` ensemble, et sans le signaler dans ton rapport.
- Terminé = `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` verts (sauf mention contraire du prompt). Ne déclare rien de vert sans l'avoir lancé.
- Commits en français, push sur ta branche (`git push -u origin <branche>`). Pas de pull request.
- Rapport final : ce qui est fait, ce qui ne l'est pas et pourquoi, sortie résumée des vérifications, écarts par rapport au plan.

## Objectif

Construire les briques visuelles du site avec Fuda : composants **de présentation purs** (entrées signal, aucune requête), le shell (en-tête, pied, thème), la recherche, et la vue de l'accueil. Le branchement aux données (`httpResource`) est fait par le prompt 05 : ne crée aucun service de données, prends les types de `@contrat` en entrée.

Avant de commencer, lis dans Fuda la `README.md` et la story de chaque composant utilisé (`projects/fuda/stories/`), et les tokens (`projects/fuda/src/styles/tokens.css`).

## Composants (`src/app/ui/<nom>/`, un `.ts`, `.html`, `.scss` et `.spec.ts` chacun)

1. **`app-vote-bar`** (`compte: Compte`, `taille: 'sm' | 'md'`) : barre empilée horizontale. Pour `--tokiwa`, contre `--enji`, abstention `--yamabuki`, non-votants `--surface-sunken` cerné de `--line-strong`. Les largeurs se font en `flex-grow` proportionnel, sans JS de mise en page. **Chiffres écrits** sous la barre (« 312 pour · 201 contre · 18 abst. »), car la couleur ne porte jamais seule l'information. `role="img"` et `aria-label` complet (« 312 pour, 201 contre, 18 abstentions, 46 non-votants »). Pas d'animation, ou un `transform: scaleX` dans les durées des tokens, coupé en mouvement réduit.
2. **`app-position`** (`position: PositionGroupe | null`) : petit badge `fd-badge` avec libellé et ton (pour : succès, contre : danger, abstention : avertissement, non-votant et partagé : neutre). Libellé toujours écrit.
3. **`app-group-pill`** (`groupe: Groupe`) : pastille ronde de `couleur` (repli `--line-strong`), décorative (`aria-hidden`), suivie de l'abrégé, avec le libellé complet en `title` et en texte masqué pour les lecteurs d'écran.
4. **`app-group-table`** (`groupes: VoteGroupe[]`) : `<table>` sémantique avec `<caption>` masquée (« Vote par groupe »), `<th scope>`, colonnes Groupe / Position / Pour / Contre / Abst. / Non-votants, chiffres en `font-variant-numeric: tabular-nums`. Défilement horizontal dans un conteneur `tabindex="0"` avec libellé sur mobile. Mini `app-vote-bar` de taille `sm` par ligne.
5. **`app-group-pills`** (`groupes: VoteGroupe[]`, `max = 6`) : ligne compacte « RN Pour · LFI-NFP Contre · … », plus « +n » s'il y a plus de groupes.
6. **`app-loi-card`** (`loi: LoiCarte`) : `a[fdCard]` vers `/lois/:slug`, ou vers `/scrutins/:numero` si `slug` est null. Titre court en titre, titre officiel limité à **2 lignes** (`line-clamp`), date, badge « Adopté par l'Assemblée » / « Rejeté par l'Assemblée », `app-vote-bar`, `app-group-pills`. Expose la classe et l'attribut sur lesquels le prompt 05 posera `appPrefetch`.
7. **`app-deputy-photo`** (`src: string | null`, `nom`, `taille: 64 | 160`) : `NgOptimizedImage` avec `width`/`height`, `priority` en entrée, repli `fd-avatar` (initiales) si `src` est nul **ou** si l'image échoue (`(error)`). `alt` = nom.
8. **`app-search`** (`index: DeputeListe | undefined`, sortie `besoinIndex` au premier focus) : combobox ARIA 1.2 sur `fd-text-field`, contenue dans un `<form action="/recherche" method="get">` avec `name="q"` pour fonctionner sans JS. Le filtrage passe par `normaliser()` (accents, casse), au plus 5 députés et 5 lois, en groupes « Députés » et « Lois ». Flèches, Entrée, Échap. Choisir un député navigue vers `/deputes/:slug`, une loi vers `/lois/:slug`. Entrée sans sélection soumet vers `/recherche?q=`. Le message « n résultats » passe par une région `aria-live="polite"`. Si `normaliser()` du prompt 03 n'est pas encore fusionné, écris une version locale et signale-le.

## Shell (`src/app/shell/`)

- En-tête : nom du site « Qui a voté quoi ? » (lien d'accueil, `--font-display`), `app-search` (son entrée `index` sera branchée par 05), liens « Lois » (accueil) et « Députés », bouton `button[fdIconButton]` de bascule Jour/Nuit (`FdThemeService`, `aria-pressed`, libellé « Thème sombre »). Lien d'évitement « Aller au contenu ».
- Pied : « Données : NosParlementaires.fr, d'après l'open data de l'Assemblée nationale (Licence Ouverte 2.0) », lien « À propos ». La date de mise à jour arrive en entrée.
- Mise en page : `<main id="contenu">`, largeur max lisible, marges de 16 px sur mobile, sans défilement horizontal. Tout en tokens.

## Vue de l'accueil

`src/app/pages/accueil/accueil-vue.ts` (`donnees: Accueil | undefined`, `chargement: boolean`, sortie `pageSuivante`) : titre « Les dernières lois votées à l'Assemblée », phrase d'explication courte, liste des `app-loi-card`, bouton « Voir plus » (`button[fdButton] variant="secondary"`, `fd-spinner` pendant le chargement). Squelettes de hauteur fixe pendant le chargement (pas de saut de mise en page). `fd-empty-state` si la liste est vide, `fd-alert` en cas d'erreur. La page `accueil.ts` qui charge les données est écrite par 05 ; pour tester, utilise la fixture `src/server/fixtures/bff/accueil.json`.

## Tests et vérification

- Une spec par composant : rendu, ARIA (libellés, rôles, `aria-expanded`/`aria-activedescendant` de la combobox), clavier de la recherche, repli de la photo, troncature et liens de la carte.
- Contraste : n'utilise que des paires de tokens documentées par Fuda (texte `--ink`/`--ink-muted` sur surfaces, `on-*` sur pleins).
- Vérifie visuellement en Jour et en Nuit, à 375 px et 1280 px. Fais une page de démonstration temporaire si besoin, **supprimée avant le commit**. Joins des captures (hors dépôt) au rapport.

## Terminé quand

Les 4 commandes sont vertes, aucune valeur de style n'est en dur (`grep -rE "#[0-9a-fA-F]{3,6}|[0-9]+px" src/app --include=*.scss` ne trouve que des exceptions justifiées en commentaire), et les captures sont décrites dans le rapport.
