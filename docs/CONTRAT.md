# Contrat BFF ↔ application

Ce fichier est la **source unique** des formats échangés entre le serveur (`/api/*`) et l'application Angular. Il est recopié tel quel dans `src/shared/contrat.ts`. Les deux côtés importent ces types, et aucun ne les modifie sans mettre à jour ce fichier.

Toutes les routes répondent en JSON, en `GET`, avec un `Cache-Control` (voir PLAN.md). En erreur, la réponse est `{ "erreur": string }` avec le code 404 (inconnu) ou 503 (données non chargées, plus `Retry-After`).

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
  id: string;          // identifiant officiel de l'organe (« PO845401 ») ; deux organes peuvent porter le même abrégé (UDR a été recréé en 2025)
  abrege: string;      // abrégé officiel : « RN », « LFI-NFP », « EcoS »…
  libelle: string;     // « Rassemblement National »
  couleur: string | null; // couleurAssociee officielle, pour une pastille seulement (jamais pour du texte)
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
  adopte: boolean;       // résultat officiel : sort.code === 'adopté'
  compte: Compte;
  urlOfficielle: string; // https://www.assemblee-nationale.fr/dyn/17/scrutins/<numero>
}

export interface LoiCarte {
  dossier: string | null; // dossier_ref (« DLR5L17N54372 ») ; null si le scrutin n'est rattaché à aucun dossier
  titreCourt: string;     // dérivé du titre du scrutin final (« Projet de loi relatif à … »)
  titreOfficiel: string;  // titre du scrutin final (sert de résumé, tronqué à 2 lignes sur l'accueil)
  lecture: string | null; // « première lecture », « lecture définitive »… si le titre l'indique
  statut: null;           // l'archive des scrutins ne le fournit pas ; gardé pour plus tard
  voteFinal: ScrutinResume;
  groupes: VoteGroupe[]; // triés par nombre de sièges décroissant
}

/** GET /api/accueil?page=1 */
export interface Accueil {
  lois: LoiCarte[];      // 10 par page, du plus récent au plus ancien
  page: number;
  pageSuivante: boolean;
  miseAJour: string;     // ISO : date de génération de data/ (meta.json)
}

/** GET /api/lois/:dossier */
export interface LoiDetail {
  dossier: string;
  titreCourt: string;
  titreOfficiel: string;
  lecture: string | null;
  statut: null;              // voir LoiCarte
  urlDossier: null;          // idem
  voteFinal: (ScrutinResume & { groupes: VoteGroupe[] }) | null; // vote sur l'ensemble le plus récent ; null s'il n'y en a pas encore
  lectures: ScrutinResume[]; // autres votes sur l'ensemble du texte (lectures précédentes), du plus récent au plus ancien
  scrutins: ScrutinResume[]; // articles, amendements, motions et autres scrutins du texte, du plus récent au plus ancien
}

export interface DeputeMini {
  slug: string;
  nom: string; // nom complet
}

/** GET /api/scrutins/:numero */
export interface ScrutinDetail extends ScrutinResume {
  loi: { dossier: string | null; titreCourt: string } | null;
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
  loisRecentes: { dossier: string; titreCourt: string; date: string }[]; // textes ayant un vote sur l'ensemble, pour la recherche de lois
}

export interface VoteDepute {
  loi: { dossier: string | null; titreCourt: string };
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
  photo: string | null; // photo officielle : https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/<numéro du PA>.jpg
  groupe: Groupe | null;
  circonscription: string | null;
  urlFiche: string;   // fiche officielle : https://www.assemblee-nationale.fr/dyn/deputes/<PA>
  taux: {
    participation: number | null; // 0..1, calculé : votes exprimés / scrutins où le député était membre (« participation aux scrutins publics »)
    abstention: number | null;    // 0..1, calculé : abstentions / votes exprimés
    loyaute: number | null;       // 0..1, calculé : votes alignés sur la position majoritaire de son groupe / votes exprimés
  };
  dernieresLois: VoteDepute[];    // ses votes sur les 10 derniers votes finaux
}
```

## Règles

- Une loi est identifiée par son `dossier_ref` ; le site l'utilise dans l'URL (`/lois/DLR5L17N54372`).
- Les montants sont des entiers et les taux des nombres entre 0 et 1 (l'application les formate en %, en `fr-FR`).
- Pour un même scrutin, la somme des `compte` de tous les groupes égale le `compte` du scrutin. Un test le vérifie.
- Le groupe d'un député sur un scrutin est son groupe **au jour du vote** (ventilation officielle). `DeputeDetail.groupe` et `DeputeIndex.groupe` sont son groupe **actuel**.
- Les taux sont calculés par nous à partir des scrutins publics : l'interface le dit (« calculé d'après les scrutins publics »). Ce ne sont pas des chiffres de l'Assemblée.
- Les textes affichés sont en français. Aucun champ ne contient de HTML.
