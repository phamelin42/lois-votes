# Qui a voté quoi ?

Site qui montre quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature) : les dernières lois votées, une page par loi, par scrutin et par député, et une recherche.

Application Angular 22 rendue côté serveur, construite avec [Fuda](https://github.com/phamelin42/design-system-fuda). Les données sont celles de l'open data officiel de l'Assemblée nationale ([data.assemblee-nationale.fr](https://data.assemblee-nationale.fr), Licence Ouverte 2.0). **Données officielles préparées au build** : `npm run build` télécharge les archives du jour, les réduit dans `data/` et les embarque dans le serveur, qui répond depuis la mémoire. Aucune base, aucune clé, aucune requête externe à l'exécution. Seule donnée non officielle : le lien vers la page Wikipédia d'un député, lu dans Wikidata (communautaire) pendant la préparation des données ; si Wikidata ne répond pas, le site est construit sans ces liens.

## Démarrage

```bash
nvm use            # Node 24 (.nvmrc), au moins 22.22.3
npm install
npm start          # build sur le jeu de test (fixtures), puis serveur sur http://localhost:4000
```

Pour travailler sur les vraies données : `npm run build` (télécharge ~41 Mo plus une requête à Wikidata, ~10 s), puis `npm run serve:ssr`. Les archives sont gardées dans `.cache/officiel/` (ignoré par git) ; le format de `data/` est décrit dans [docs/DONNEES.md](docs/DONNEES.md).

Les commandes et conventions sont décrites dans [CLAUDE.md](CLAUDE.md). Le plan et le contrat entre le serveur et l'application sont dans [docs/PLAN.md](docs/PLAN.md) et [docs/CONTRAT.md](docs/CONTRAT.md).

## Variables d'environnement

Toutes sont facultatives. Sans elles, le site fonctionne avec les valeurs par défaut.

| Variable           | Rôle                                                                                                                    | Défaut                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `DONNEES_DEPUIS`   | À la préparation des données (`npm run donnees`, `npm run build`) : `fixtures` lit le jeu de test au lieu des archives. | archives officielles                      |
| `DONNEES_DIR`      | Au démarrage du serveur : dossier des données préparées.                                                                | `data/` du build (`dist/lois-votes/data`) |
| `UMAMI_WEBSITE_ID` | Identifiant du site Umami. Sans lui, aucun script de mesure n'est ajouté.                                               | aucun                                     |
| `UMAMI_SRC`        | Adresse du script Umami (en https), pour une instance auto-hébergée.                                                    | `https://cloud.umami.is/script.js`        |

Si `data/` manque ou est invalide, le serveur démarre quand même : les routes `/api/*` et les pages de données répondent **503** (jamais un faux contenu) et `/a-propos` reste servie.

## Tests et mesures

| Commande                 | Rôle                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`               | Tests unitaires (Vitest, jsdom), dont le pipeline des données et le serveur.                                                                                                         |
| `npm run build:fixtures` | Comme `npm run build`, sur le jeu de test : aucun réseau.                                                                                                                            |
| `npm run e2e`            | `build:fixtures`, puis Playwright contre trois instances SSR (normale, sans données, avec Umami). Navigateur de Playwright, ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/chrome`. |
| `npm run icones`         | Régénère les icônes de `public/` à partir de `public/favicon.svg` (Chromium de Playwright). Les fichiers sont versionnés ; voir [docs/ICONE.md](docs/ICONE.md).                      |
| `npm run perf`           | `build:fixtures`, puis Lighthouse (profil mobile) sur l'accueil, une loi et un député. Échoue sous 95 en performance ou en accessibilité.                                            |

## Mise en ligne (Vercel Hobby)

Le site se déploie sur Vercel avec `vercel.json` (fonction `api/index.mjs` qui sert le serveur SSR et embarque `dist/lois-votes/**`, donc les données ; build par `npm run build`). Quatre étapes, à faire une fois :

1. **Créer le projet Vercel** relié au dépôt Git (aucune configuration de framework : `vercel.json` la fixe).
2. **Ajouter les variables facultatives** dans les réglages du projet, si la mesure d'audience est voulue : `UMAMI_WEBSITE_ID` (et `UMAMI_SRC` si Umami n'est pas hébergé chez Umami Cloud).
3. **Ajouter le domaine** `quiavotequoi.phamelin.fr` au projet dans les réglages « Domains ».
4. **Créer le CNAME** chez le registraire de `phamelin.fr` : `quiavotequoi` → `cname.vercel-dns.com`.

Le préréglage « Angular » de Vercel n'a pas été vérifié : le projet passe par la fonction explicite de `api/index.mjs`. Si le téléchargement des archives échoue pendant le build, le build échoue et l'ancien déploiement reste en ligne.

## Icône du site dans Google

Le site déclare son icône (`favicon.ico`, `favicon.svg`, PNG, manifeste) dans l'en-tête de la page d'accueil ; les fichiers sont dans `public/` (détail et exigences de Google dans [docs/ICONE.md](docs/ICONE.md)). Un geste, **après le premier déploiement** (et après tout changement d'icône) :

1. Ouvrir la [Search Console](https://search.google.com/search-console) pour `quiavotequoi.phamelin.fr`, outil « Inspection d'URL », saisir `https://quiavotequoi.phamelin.fr/`, puis « Demander une indexation ».
2. Patienter : Google annonce un délai de quelques jours à plusieurs semaines, et ne garantit pas qu'un favicon s'affiche dans les résultats.

Contrôle à faire une fois en ligne : `curl -sI https://quiavotequoi.phamelin.fr/favicon.ico` doit répondre 200, `Cache-Control: public, max-age=86400` et un type `image/…` (Vercel sert les fichiers de `public/` lui-même, voir docs/ICONE.md).

## Mise à jour nocturne

L'Assemblée régénère ses archives chaque nuit (~04:25 GMT). Le workflow [`.github/workflows/actualiser.yml`](.github/workflows/actualiser.yml) appelle chaque jour à 05:30 UTC (et à la demande, onglet « Actions » → « Actualiser les données » → « Run workflow ») un _Deploy Hook_ de Vercel, qui relance le build avec les archives du jour. Deux gestes, à faire une fois :

1. **Créer le Deploy Hook dans Vercel** : projet → _Settings_ → _Git_ → _Deploy Hooks_, un nom (par exemple « actualisation nocturne »), la branche **`main`**, puis copier l'URL générée.
2. **Ajouter le secret GitHub** `VERCEL_DEPLOY_HOOK_URL` avec cette URL : dépôt → _Settings_ → _Secrets and variables_ → _Actions_ → _New repository secret_.

Sans ce secret, le workflow échoue avec un message clair et le site ne se met à jour qu'aux fusions sur `main`. Vercel autorise 60 déclenchements de Deploy Hook par heure et par projet : une exécution par nuit est largement en dessous.

## Licence

Code sous licence MIT. Données : Licence Ouverte 2.0 (Etalab), issues de l'open data de l'Assemblée nationale.
