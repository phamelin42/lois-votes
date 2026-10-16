# Prompt 06 : déploiement Vercel, Umami, CI, tests de bout en bout

Branche : `lv/06-deploiement`, créée depuis `claude/bold-fermi-zihw5t` **après la fusion de 05**.

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

Rendre le site déployable sur Vercel Hobby à `quiavotequi.phamelin.fr`, mesuré par Umami sans cookie, et protégé par une CI qui tourne **sans clé API** (faux serveur NosParlementaires).

## Travail

1. **Vercel** :
   - vérifie dans la documentation actuelle de Vercel comment déployer Angular 22 avec `@angular/ssr` (préréglage du framework). S'il ne convient pas, écris `api/index.mjs`, qui exporte le `reqHandler` d'Angular, et une réécriture de toutes les routes vers lui dans `vercel.json` ;
   - en-têtes : `Cache-Control: public, max-age=31536000, immutable` sur les fichiers hachés ; pages HTML `public, s-maxage=600, stale-while-revalidate=86400` posé par le serveur ; `/api/*` selon le BFF ; en-têtes de sécurité (CSP compatible avec Umami et le script de thème en ligne, de préférence avec une empreinte, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`) ;
   - `robots.txt` (autorise tout, `Sitemap:`) et `sitemap.xml` servi par une route serveur à partir des lois récentes et de l'index des députés, en cache 1 jour ;
   - documente dans le README les variables (`NOSPARLEMENTAIRES_API_KEY`, `UMAMI_WEBSITE_ID`, facultative `UMAMI_SRC`) et le domaine : CNAME `quiavotequi` → `cname.vercel-dns.com` chez le registraire de `phamelin.fr`, domaine ajouté au projet Vercel. **Ne crée pas le projet Vercel et ne touche pas au DNS** : c'est l'utilisateur qui le fait.
2. **Umami** : si `UMAMI_WEBSITE_ID` est défini à l'exécution, le serveur ajoute `<script defer src="${UMAMI_SRC ?? 'https://cloud.umami.is/script.js'}" data-website-id="…">` dans le `<head>`. Sinon, aucun script. Testé dans les deux cas.
3. **Faux serveur NosParlementaires** (`e2e/faux-np.mjs`, Node sans dépendance) : sert `src/server/fixtures/source/` aux chemins de l'API, vérifie la présence d'un en-tête `X-Api-Key` quelconque, et peut simuler 429 et 500 par paramètre d'environnement.
4. **Playwright** (`e2e/`) contre le build SSR (`NP_API_BASE` pointant sur le faux serveur, Chromium préinstallé ou celui qu'épingle `@playwright/test`) :
   - parcours : accueil → loi → liste nominative → député → recherche d'un député (ouvre son profil) ;
   - SSR : avec JS désactivé, le contenu de l'accueil, d'une loi et d'un député est présent ;
   - hydratation : aucune requête `/api/*` refaite après le chargement initial ;
   - pré-chargement : survoler une carte déclenche le chunk de la route et le `fetch` `/api/lois/...` ;
   - axe (`@axe-core/playwright`) sans aucune violation sur chaque page, en Jour **et** en Nuit ;
   - clavier : recherche (flèches, Entrée, Échap), bascule de thème, focus visible ;
   - mouvement réduit : pas de transition de vue ;
   - dégradation : faux serveur en 500 sans cache → page avec `fd-alert` et statut 503.
5. **Lighthouse** (`npm run perf`, avec `lighthouse` en dépendance de dev ou via `npx`) sur `/`, une loi et un député en profil mobile, contre le build local et le faux serveur. Le script échoue sous 95 en performance ou en accessibilité. Résultats dans le rapport.
6. **CI** `.github/workflows/ci.yml` (Node 24, cache npm) : `npm ci`, lint, typecheck, test, build, installation de Chromium, e2e ; artefacts Playwright en cas d'échec. Lighthouse dans un job séparé, non bloquant au début. Aucun secret n'est nécessaire.

## Terminé quand

Les 4 commandes, `npm run e2e` et `npm run perf` sont verts en local. La CI est écrite (impossible de la lancer ici : dis-le). Le README explique en 5 étapes la mise en ligne que l'utilisateur doit faire : demander la clé, créer le projet Vercel, ajouter les variables, ajouter le domaine, créer le CNAME.
