# Prompt 01 : squelette Angular 22 SSR avec Fuda

Branche : `lv/01-squelette` (créée depuis `claude/bold-fermi-zihw5t`).

## Contexte commun

Tu travailles sur le dépôt `phamelin42/lois-votes`, le site « Qui a voté quoi ? » (`quiavotequoi.phamelin.fr`) : quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature).

Avant tout, lis :
- `docs/PLAN.md` : décisions, architecture, constats sur les données ;
- `docs/CONTRAT.md` : les types échangés entre le serveur (`/api/*`) et l'application ;
- `CLAUDE.md` à la racine s'il existe (créé par le prompt 01) ;
- les conventions de Fuda, `CLAUDE.md` du dépôt `phamelin42/design-system-fuda`.

Règles :
- Angular 22 : standalone, zoneless, signaux (`input()`, `computed()`, `httpResource()`…), `@if/@for/@defer`, `host: {}`, `inject()`, `templateUrl` + `styleUrl` séparés, `ViewEncapsulation.None` avec classes BEM préfixées `app-`, tokens Fuda uniquement (aucune couleur, durée ni espacement en dur).
- Français pour les libellés, la documentation et les messages de commit.
- Node ≥ 22.22.3. Si `node --version` est plus ancien, télécharge Node 24 depuis nodejs.org, vérifie-le avec `SHASUMS256.txt` et mets-le en tête du `PATH`.
- Ne modifie pas Fuda. **Aucune clé API** : toutes les sources sont publiques (API tabulaire de data.gouv.fr).
- Ne change pas le contrat sans mettre à jour `docs/CONTRAT.md` et `src/shared/contrat.ts` ensemble, et sans le signaler dans ton rapport.
- Terminé = `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` verts (sauf mention contraire du prompt). Ne déclare rien de vert sans l'avoir lancé.
- Commits en français, push sur ta branche (`git push -u origin <branche>`). Pas de pull request.
- Rapport final : ce qui est fait, ce qui ne l'est pas et pourquoi, sortie résumée des vérifications, écarts par rapport au plan.

## Objectif

Poser la base que tous les autres agents utiliseront : application Angular 22 en SSR, Fuda installée, outils (lint, typecheck, Vitest), contrat partagé, et un **BFF factice** pour que l'interface puisse avancer avant le vrai serveur.

## Travail

1. **Projet** à la racine du dépôt (pas de sous-dossier), nommé `lois-votes` : `ng new` avec SSR (`@angular/ssr`, `outputMode: 'server'`), SCSS, zoneless, sans tests Karma. Supprime le contenu de démonstration.
2. **Fuda** : `npm install github:phamelin42/design-system-fuda#<sha du dernier commit de main> @angular/cdk @fontsource/dela-gothic-one @fontsource/zen-maru-gothic`. Le script `prepare` de Fuda la construit à l'installation. Épingle le SHA, pas une branche.
3. **Styles** (`src/styles.scss`) : `fuda/styles/fuda.css`, puis **seulement** les polices latines (`@fontsource/dela-gothic-one/latin-400.css`, `@fontsource/zen-maru-gothic/latin-500.css` et `latin-700.css`), pas `fuda/styles/fonts.css` qui charge aussi le japonais. Ajoute dans `index.html` le preload de la police du texte (latin-500), `lang="fr"`, et le script en ligne qui pose `data-theme="dark"` avant le rendu si `localStorage['fuda-theme'] === 'dark'` (dans un try/catch).
4. **Outils** :
   - scripts `npm` : `start`, `build`, `test` (Vitest via `ng test`, jsdom), `lint` (angular-eslint, avec les règles de Fuda : `prefer-signals`, préfixe `app`, pas de `standalone: true`), `typecheck` (`tsc --noEmit` sur l'app, le serveur et les specs), `serve:ssr` ;
   - Prettier comme Fuda ;
   - budgets `angular.json` en erreur : initial ≤ 150 Ko, styles par composant ≤ 4 Ko.
5. **Contrat** : recopie le bloc TypeScript de `docs/CONTRAT.md` dans `src/shared/contrat.ts`, importable côté serveur et côté app (alias `@contrat`).
6. **BFF factice** :
   - `src/server/fixtures/bff/` contient une réponse **conforme au contrat** par route (`accueil.json`, `lois/<dossier>.json` ×2 (dont un texte à plusieurs lectures), `scrutins/<numero>.json` ×2, `deputes.json`, `deputes/<slug>.json` ×2). Écris-les à la main à partir des exports publics de NosParlementaires (`https://nosparlementaires.fr/opendata/`), avec des valeurs réelles et cohérentes : sommes des groupes égales au total, 12 groupes réels, `dossier` au format `DLR5L17N…`, `statut` et `urlDossier` à `null`. Les fixtures réelles de l'API tabulaire (prompt 00) arriveront à côté, dans `src/server/fixtures/source/`.
   - Dans `src/server.ts`, si `MOCK_BFF=1`, les routes `/api/*` servent ces fichiers avec un délai de 150 ms. C'est le mode par défaut de `npm start` tant que le prompt 02 n'a pas livré le vrai serveur.
   - Un test vérifie que chaque fixture BFF respecte les types (`satisfies` dans un fichier `.spec.ts`).
7. **Squelette de routes** (`app.routes.ts`, `loadComponent`) : `/`, `/lois/:dossier`, `/scrutins/:numero`, `/deputes`, `/deputes/:slug`, `/recherche`, `/a-propos`, `**` (404). Chaque page est un composant vide avec un `<h1>`. `app.routes.server.ts` : `RenderMode.Server` partout, sauf `/a-propos` en `Prerender`.
8. **`CLAUDE.md`** à la racine, en français : commandes, structure, conventions (reprendre celles de Fuda pour Angular, le style et l'accessibilité), règle « rien n'est stocké, aucune clé, toute donnée passe par `/api/*` qui interroge l'API tabulaire de data.gouv.fr », contrat, modes `MOCK_BFF`, définition de « terminé ». Mets aussi un `README.md` court.
9. `.gitignore`, `.editorconfig`, `.nvmrc` (24), `engines.node >= 22.22.3`.

## Terminé quand

`npm run lint`, `npm run typecheck`, `npm test` et `npm run build` sont verts. `MOCK_BFF=1 npm run serve:ssr` sert les 8 routes et `curl localhost:4000/api/accueil` renvoie la fixture. La page d'accueil rendue par le serveur contient un `<h1>` et charge les polices latines seulement.
