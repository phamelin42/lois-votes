# Qui a voté quoi ?

Site qui montre quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature) : les dernières lois votées, une page par loi, par scrutin et par député, et une recherche.

Application Angular 22 rendue côté serveur, construite avec [Fuda](https://github.com/phamelin42/design-system-fuda). Les données viennent de l'API tabulaire publique de data.gouv.fr, appelée à la demande : rien n'est stocké, aucune clé n'est nécessaire.

## Démarrage

```bash
nvm use            # Node 24 (.nvmrc), au moins 22.22.3
npm install
npm start          # build puis serveur sur http://localhost:4000 avec les données factices
```

Le BFF réel (sans `MOCK_BFF=1`) interroge l'API tabulaire. Ses identifiants de ressources (`RID_*`) et les colonnes de Datan sont à confirmer : voir la section « Identifiants de ressources à confirmer » de [CLAUDE.md](CLAUDE.md).

Les commandes et conventions sont décrites dans [CLAUDE.md](CLAUDE.md). Le plan et le contrat entre le serveur et l'application sont dans [docs/PLAN.md](docs/PLAN.md) et [docs/CONTRAT.md](docs/CONTRAT.md).

## Variables d'environnement

Toutes sont facultatives. Sans elles, le site fonctionne avec les valeurs par défaut.

| Variable                                                                             | Rôle                                                                      | Défaut                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------- |
| `UMAMI_WEBSITE_ID`                                                                   | Identifiant du site Umami. Sans lui, aucun script de mesure n'est ajouté. | aucun                                  |
| `UMAMI_SRC`                                                                          | Adresse du script Umami (en https), pour une instance auto-hébergée.      | `https://cloud.umami.is/script.js`     |
| `TABULAR_API_BASE`                                                                   | Base de l'API tabulaire (le faux serveur de test s'y branche).            | `https://tabular-api.data.gouv.fr/api` |
| `RID_SCRUTINS`, `RID_VOTES`, `RID_DEPUTES`, `RID_DATAN_DEPUTES`, `RID_DATAN_GROUPES` | Identifiants (`rid`) des ressources data.gouv.fr.                         | valeurs provisoires, voir CLAUDE.md    |

**Avertissement** : tant que les `RID_*` réels n'ont pas été relevés sur data.gouv.fr (prompt 00, jamais exécuté faute d'accès au réseau), les valeurs par défaut ne correspondent à aucune ressource : le site répond **503** sur ses pages de données. Il faut renseigner les `RID_*` avant la mise en ligne.

## Tests et mesures

| Commande       | Rôle                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`     | Tests unitaires (Vitest, jsdom).                                                                                                                                                                                       |
| `npm run e2e`  | Build, puis Playwright contre trois instances SSR et deux faux serveurs de l'API tabulaire (`e2e/faux-tabulaire.mjs`). Le navigateur est celui de Playwright, ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/chrome`. |
| `npm run perf` | Build, puis Lighthouse (profil mobile) sur l'accueil, une loi et un député. Échoue sous 95 en performance ou en accessibilité.                                                                                         |

## Mise en ligne (Vercel Hobby)

Le site se déploie sur Vercel avec `vercel.json` (fonction `api/index.mjs` qui sert le serveur SSR, et le build de `npm run build`). Quatre étapes, à faire une fois :

1. **Créer le projet Vercel** relié au dépôt Git (aucune configuration de framework : `vercel.json` la fixe).
2. **Ajouter les variables facultatives** dans les réglages du projet, si la mesure d'audience est voulue : `UMAMI_WEBSITE_ID` (et `UMAMI_SRC` si Umami n'est pas hébergé chez Umami Cloud). Ajouter les `RID_*` une fois confirmés.
3. **Ajouter le domaine** `quiavotequi.phamelin.fr` au projet dans les réglages « Domains ».
4. **Créer le CNAME** chez le registraire de `phamelin.fr` : `quiavotequi` → `cname.vercel-dns.com`.

Le préréglage « Angular » de Vercel n'a pas pu être vérifié dans sa documentation depuis l'environnement de développement : le projet passe donc par la fonction explicite de `api/index.mjs`.

## Licence

Code sous licence MIT. Données : Licence Ouverte 2.0 (Etalab), issues de l'open data de l'Assemblée nationale via NosParlementaires et Datan.
