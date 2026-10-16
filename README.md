# Qui a voté quoi ?

Site qui montre quel parti a voté quoi pour chaque loi à l'Assemblée nationale (17ᵉ législature) : les dernières lois votées, une page par loi, par scrutin et par député, et une recherche.

Application Angular 22 rendue côté serveur, construite avec [Fuda](https://github.com/phamelin42/design-system-fuda). Les données viennent de l'API tabulaire publique de data.gouv.fr, appelée à la demande : rien n'est stocké, aucune clé n'est nécessaire.

## Démarrage

```bash
nvm use            # Node 24 (.nvmrc), au moins 22.22.3
npm install
npm start          # build puis serveur sur http://localhost:4000 avec les données factices
```

Les commandes et conventions sont décrites dans [CLAUDE.md](CLAUDE.md). Le plan et le contrat entre le serveur et l'application sont dans [docs/PLAN.md](docs/PLAN.md) et [docs/CONTRAT.md](docs/CONTRAT.md).

## Licence

Code sous licence MIT. Données : Licence Ouverte 2.0 (Etalab), issues de l'open data de l'Assemblée nationale via NosParlementaires et Datan.
