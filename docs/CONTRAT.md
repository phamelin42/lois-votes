# Contrat BFF ↔ application

Ce fichier est la **source unique** des formats échangés entre le serveur (`/api/*`) et l'application Angular. Il est recopié tel quel dans `src/shared/contrat.ts` par le prompt 01. Les deux côtés importent ces types, et aucun ne les modifie sans mettre à jour ce fichier.

Toutes les routes répondent en JSON, en `GET`, avec un `Cache-Control` (voir PLAN.md). En erreur, la réponse est `{ "erreur": string }` avec le code 404 (inconnu) ou 503 (source indisponible, plus `Retry-After`).

```ts
// src/shared/contrat.ts

export type Position = 'pour' | 'contre' | 'abstention' | 'nonvotant';
/** Position majoritaire d'un groupe ; « partage » quand deux positions sont à égalité. */
export type PositionGroupe = Position | 'partage';
export type TypeScrutin = 'final' | 'motion' | 'article' | 'amendement' | 'autre';

export interface Compte {
  pour: number;
  contre: number;
  abstention: number;
  nonvotant: number;
}

export interface Groupe {
  id: string;          // identifiant de la source
  abrege: string;      // « RN », « LFI-NFP »…
  libelle: string;     // « Rassemblement National »
  couleur: string | null; // couleur officielle, pour une pastille seulement (jamais pour du texte)
}

export interface VoteGroupe {
  groupe: Groupe;
  position: PositionGroupe;
  compte: Compte;
}

export interface ScrutinResume {
  numero: number;        // 8317 (identifiant source : VTANR5L17V8317)
  date: string;          // ISO 8601, jour du scrutin
  titre: string;         // titre officiel du scrutin
  type: TypeScrutin;
  adopte: boolean;       // calculé, voir PLAN.md « Constats » §1
  compte: Compte;
  urlOfficielle: string; // https://www.assemblee-nationale.fr/dyn/17/scrutins/<numero>
}

export interface LoiCarte {
  slug: string | null;   // null si le texte n'a pas de fiche « loi » dans la source
  titreCourt: string;    // short_title, sinon titre dérivé du scrutin
  titreOfficiel: string; // title (sert de résumé, tronqué à 2 lignes sur l'accueil)
  statut: string | null; // statut de la source, affiché tel quel
  voteFinal: ScrutinResume;
  groupes: VoteGroupe[]; // triés par nombre de sièges décroissant
}

/** GET /api/accueil?page=1 */
export interface Accueil {
  lois: LoiCarte[];      // 10 par page, du plus récent au plus ancien
  page: number;
  pageSuivante: boolean;
  miseAJour: string;     // ISO : date de génération des données de la source si elle est connue, sinon de la réponse
}

/** GET /api/lois/:slug */
export interface LoiDetail {
  slug: string;
  titreCourt: string;
  titreOfficiel: string;
  statut: string | null;
  urlDossier: string | null;
  voteFinal: (ScrutinResume & { groupes: VoteGroupe[] }) | null; // null : pas encore de vote sur l'ensemble
  scrutins: ScrutinResume[]; // tous les autres scrutins du texte, du plus récent au plus ancien
}

export interface DeputeMini {
  slug: string;
  nom: string; // nom complet
}

/** GET /api/scrutins/:numero */
export interface ScrutinDetail extends ScrutinResume {
  loi: { slug: string | null; titreCourt: string } | null;
  groupes: VoteGroupe[];
  nominatif: { groupeId: string; position: Position; deputes: DeputeMini[] }[];
}

export interface DeputeIndex {
  slug: string;
  nom: string;          // nom complet
  nomTri: string;       // nom de famille, pour le tri
  groupe: string | null; // abrégé
  departement: string | null; // code
  circonscription: string | null; // « Rhône (7) »
}

/** GET /api/deputes : index compact pour la liste et la recherche (députés actifs). */
export interface DeputeListe {
  deputes: DeputeIndex[];
  groupes: Groupe[];
  loisRecentes: { slug: string; titreCourt: string; date: string }[]; // pour la recherche de lois
}

export interface VoteDepute {
  loi: { slug: string | null; titreCourt: string };
  numero: number;
  date: string;
  position: Position | null;            // null : n'était pas député ou absent de la liste
  positionGroupe: PositionGroupe | null; // position majoritaire de son groupe sur ce scrutin
  adopte: boolean;
}

/** GET /api/deputes/:slug */
export interface DeputeDetail {
  slug: string;
  nom: string;
  photo: string | null;
  groupe: Groupe | null;
  circonscription: string | null;
  urlFiche: string;   // fiche sur la source
  taux: {
    participation: number | null; // 0..1, votes_participation_rate : « participation aux scrutins publics »
    abstention: number | null;    // 0..1, abstentions / (pour + contre + abstention) sur la législature
    loyaute: number | null;       // 0..1, group_loyalty_rate
  };
  dernieresLois: VoteDepute[];    // ses votes sur les 10 derniers votes finaux
}
```

## Règles

- Les montants sont des entiers et les taux des nombres entre 0 et 1 (l'application les formate en %, en `fr-FR`).
- Pour un même scrutin, la somme des `compte` de tous les groupes égale le `compte` du scrutin, à l'unité près. Tout écart (député sans groupe) est rangé dans un groupe `{ id: 'NI', abrege: 'NI', libelle: 'Non inscrits' }`. Un test le vérifie.
- Les textes affichés sont en français. Aucun champ ne contient de HTML.
