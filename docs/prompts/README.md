# Prompts des sous-agents

Chaque fichier est un prompt autonome à donner tel quel à un sous-agent (session Claude Code sur le dépôt `phamelin42/lois-votes`). Tous renvoient à [../PLAN.md](../PLAN.md) et [../CONTRAT.md](../CONTRAT.md), poussés avant eux sur la branche `claude/bold-fermi-zihw5t`.

| # | Prompt | Dépend de | Clé API |
|---|---|---|---|
| 00 | [Exploration de l'API et fixtures](00-exploration-api.md) | rien | **oui** (sinon fixtures provisoires) |
| 01 | [Squelette Angular SSR + Fuda](01-squelette.md) | rien | non |
| 02 | [Serveur BFF](02-serveur-bff.md) | 00, 01 | non (fixtures) |
| 03 | [Couche données et chargement intelligent](03-donnees-chargement.md) | 01 | non |
| 04 | [Composants, shell et accueil](04-ui-shell-accueil.md) | 01 | non |
| 05 | [Pages loi, scrutin, députés, recherche, à propos](05-pages.md) | 03, 04 | non |
| 06 | [Déploiement, Umami, CI, e2e](06-deploiement-ci-e2e.md) | 02, 05 | non |
| 07 | [Relecture finale et vérification](07-relecture-finale.md) | tout | facultative |

## Ordre conseillé (vagues)

```
Vague 1 :  00  ∥  01
Vague 2 :  02  ∥  03  ∥  04      (après 01 ; 02 attend aussi 00)
Vague 3 :  05
Vague 4 :  06
Vague 5 :  07
```

## Branches

Les agents d'une même vague travaillent en parallèle : chacun sur **sa propre branche**, créée depuis `claude/bold-fermi-zihw5t` à jour (`lv/00-api`, `lv/01-squelette`, `lv/02-bff`…). On fusionne ensuite dans `claude/bold-fermi-zihw5t` avant de lancer la vague suivante. Chaque prompt rappelle sa branche.

## Règles communes (déjà incluses dans chaque prompt)

- Lire `docs/PLAN.md`, `docs/CONTRAT.md`, puis `CLAUDE.md` à la racine (créé par 01), qui reprend les conventions de Fuda.
- Français pour les libellés, la documentation et les commits.
- Node ≥ 22.22.3, exigé par Angular 22.
- Ne jamais versionner la clé API.
- Ne pas modifier Fuda, ni changer le contrat sans mettre à jour `docs/CONTRAT.md`.
- Une tâche est terminée quand `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` sont verts.
