# Prompt 07 : relecture finale et vérification

Branche : `claude/bold-fermi-zihw5t`, une fois toutes les branches fusionnées. Tu ne crées pas de fonctionnalité : tu vérifies, tu corriges les défauts trouvés et tu rapportes.

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

## Vérifications

1. **Conformité au plan** : chaque exigence de `docs/PLAN.md` est-elle réalisée ? Tableau exigence → fichier(s) → OK / manquant. En particulier :
   - page député : photo, parti, votes sur les 10 dernières lois, taux d'abstention, participation ;
   - accueil : X dernières lois avec titre, résumé (titre officiel), pour/contre/abstention et partis ;
   - recherche qui ouvre le profil d'un député ;
   - SSR, `@defer`, pré-chargement du code et des données.
2. **Rien n'est stocké** : aucune écriture disque côté serveur, aucune base, aucun fichier de données servi en statique (hors fixtures de test, exclues du build : vérifie le contenu de `dist/`).
3. **Source** : tous les `rid` utilisés sont dans `src/server/source/ressources.ts` et documentés dans `docs/API.md` (jeu, lien, fréquence). Le navigateur n'appelle jamais data.gouv.fr directement, seulement `/api/*` (vérifie l'onglet réseau). Aucune clé ni secret n'est nécessaire ni présent.
4. **Exactitude** : avec le réseau data.gouv.fr si disponible, compare 3 votes finaux et 1 motion de censure avec leurs pages officielles (totaux, adopté ou rejeté, position de 3 groupes), et 2 députés (groupe, circonscription). Sans réseau, fais-le sur les fixtures et signale-le. Vérifie aussi 3 photos et la mention « groupe actuel » dans `/a-propos`.
5. **Formulations** : `grep -ri "loi adoptée\|présence" src/app` ; chaque occurrence est justifiée.
6. **Qualité** : passe le skill `/code-review` (niveau high) sur l'ensemble du diff depuis le premier commit, et corrige les défauts confirmés.
7. **Accessibilité et performance** : relance `npm run e2e` et `npm run perf`. Relis les captures en Jour et en Nuit, à 375 px et 1280 px.
8. **Documentation** : `README.md` et `CLAUDE.md` sont à jour et exacts (commandes réellement présentes dans `package.json`).

## Terminé quand

Toutes les commandes sont vertes, les corrections sont commitées et poussées, et le rapport contient : le tableau de conformité, les défauts corrigés, ceux laissés (avec leur raison), et les actions restantes pour l'utilisateur (Vercel, DNS).
