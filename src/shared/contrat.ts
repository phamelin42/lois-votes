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
  id: string;          // abrégé du groupe (« RN ») : les ressources n'ont pas d'autre identifiant commun
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
  dossier: string | null; // dossier_ref (« DLR5L17N54372 ») ; null si le scrutin n'est rattaché à aucun dossier
  titreCourt: string;     // dérivé du titre du scrutin final (« Projet de loi relatif à … »)
  titreOfficiel: string;  // titre du scrutin final (sert de résumé, tronqué à 2 lignes sur l'accueil)
  lecture: string | null; // « première lecture », « lecture définitive »… si le titre l'indique
  statut: null;           // aucune source sans clé ne le fournit ; gardé pour plus tard
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
  photo: string | null; // photo officielle de l'Assemblée (identifiant PA de Datan) ; null si la jointure échoue
  groupe: Groupe | null;
  circonscription: string | null;
  urlFiche: string;   // fiche officielle sur assemblee-nationale.fr si l'identifiant PA est connu, sinon fiche NosParlementaires
  taux: {
    participation: number | null; // 0..1, score de participation de Datan : « participation aux scrutins publics »
    abstention: number | null;    // 0..1, abstentions / (pour + contre + abstention) sur la législature, calculé par comptage (meta.total)
    loyaute: number | null;       // 0..1, score de loyauté de Datan
  };
  dernieresLois: VoteDepute[];    // ses votes sur les 10 derniers votes finaux
}
