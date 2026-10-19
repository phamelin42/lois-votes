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
  id: string; // identifiant officiel de l'organe (« PO845401 ») ; deux organes peuvent porter le même abrégé (UDR a été recréé en 2025)
  abrege: string; // abrégé officiel : « RN », « LFI-NFP », « EcoS »…
  libelle: string; // « Rassemblement National »
  couleur: string | null; // couleurAssociee officielle, pour une pastille seulement (jamais pour du texte)
}

export interface VoteGroupe {
  groupe: Groupe;
  position: PositionGroupe; // calculée sur les décomptes du groupe (la plus votée), jamais la positionMajoritaire de l'archive
  compte: Compte;
}

export interface ScrutinResume {
  numero: number; // 8317 (identifiant source : VTANR5L17V8317)
  date: string; // ISO 8601, jour du scrutin
  titre: string; // titre officiel du scrutin
  type: TypeScrutin;
  adopte: boolean; // résultat officiel : sort.code === 'adopté'
  compte: Compte;
  /**
   * Députés en mandat le jour du scrutin (cases ≠ « - » de la matrice des votes). Ont voté = pour + contre + abstention ;
   * n'ont pas voté = enMandat − (pour + contre + abstention) : les non-votants officiels et les absents.
   */
  enMandat: number;
  urlOfficielle: string; // https://www.assemblee-nationale.fr/dyn/17/scrutins/<numero>
}

export interface LoiCarte {
  dossier: string | null; // dossier_ref (« DLR5L17N54372 ») ; null si le scrutin n'est rattaché à aucun dossier
  titreCourt: string; // dérivé du titre du scrutin final (« Projet de loi relatif à … »)
  titreOfficiel: string; // titre du scrutin final (sert de résumé, tronqué à 2 lignes sur l'accueil)
  lecture: string | null; // « première lecture », « lecture définitive »… ; peut valoir « texte de la commission mixte paritaire »
  statut: null; // l'archive des scrutins ne le fournit pas ; gardé pour plus tard
  voteFinal: ScrutinResume;
  groupes: VoteGroupe[]; // triés par nombre de sièges décroissant
}

/** GET /api/accueil?page=1 */
export interface Accueil {
  lois: LoiCarte[]; // 10 par page, du plus récent au plus ancien
  page: number;
  pageSuivante: boolean;
  miseAJour: string; // ISO : date de génération de data/ (meta.json)
}

/** GET /api/lois/:dossier */
export interface LoiDetail {
  dossier: string;
  titreCourt: string;
  titreOfficiel: string;
  lecture: string | null;
  statut: null; // voir LoiCarte
  urlDossier: null; // idem
  voteFinal: (ScrutinResume & { groupes: VoteGroupe[]; groupesSansVotant: Groupe[] }) | null; // vote sur l'ensemble le plus récent ; null s'il n'y en a pas encore
  lectures: ScrutinResume[]; // autres votes sur l'ensemble du texte (lectures précédentes), du plus récent au plus ancien
  scrutins: ScrutinResume[]; // articles, amendements, motions et autres scrutins du texte, du plus récent au plus ancien
}

export interface DeputeMini {
  slug: string;
  nom: string; // nom complet ; peut porter une précision d'homonyme entre parenthèses (« Alexandra Martin (Gironde) »)
}

/** GET /api/scrutins/:numero */
export interface ScrutinDetail extends ScrutinResume {
  loi: { dossier: string | null; titreCourt: string } | null;
  groupes: VoteGroupe[];
  /** Groupes existant le jour du scrutin dont aucun député n'est listé (ni pour, ni contre, ni abstention, ni non-votant) : absents de `groupes`, signalés pour ne pas les masquer sans explication. */
  groupesSansVotant: Groupe[];
  nominatif: { groupeId: string; position: Position; deputes: DeputeMini[] }[];
}

export interface DeputeIndex {
  slug: string;
  pa: string; // numéro de l'acteur SANS le préfixe « PA » (7 caractères au plus) : photoDe(pa) donne l'URL de sa photo. Pas de champ photo : l'index reste petit
  nom: string; // nom complet
  nomTri: string; // nom de famille, pour le tri
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
  position: Position | null; // null : absent (case X : en mandat mais dans aucune liste) ou pas en mandat
  positionGroupe: PositionGroupe | null; // position majoritaire de son groupe sur ce scrutin
  adopte: boolean;
}

/** Liens externes d'un député : un lien absent est null, jamais une adresse devinée. */
export interface LiensDepute {
  assemblee: string; // fiche officielle : https://www.assemblee-nationale.fr/dyn/deputes/<PA>
  hatvp: string | null; // déclarations : page nominative de la HATVP (https://www.hatvp.fr/pages_nominatives/…), donnée officielle ; null pour les anciens députés
  wikipedia: string | null; // article en français (https://fr.wikipedia.org/wiki/…), via Wikidata : source communautaire, non officielle
  siteWeb: string | null; // site personnel déclaré à l'Assemblée, seulement s'il est écrit en https:// valide
  x: string | null; // https://x.com/<compte>, seulement si le compte déclaré est un identifiant valide
  facebook: string | null; // https://www.facebook.com/<page>, seulement si la page déclarée est un identifiant valide
}

/** GET /api/deputes/:slug */
export interface DeputeDetail {
  slug: string;
  nom: string;
  photo: string | null; // photo officielle : photoDe(pa) = https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/<numéro SANS le préfixe PA>.jpg (avec PA : 404)
  groupe: Groupe | null; // groupe actuel (le dernier connu pour un ancien député)
  circonscription: string | null;
  naissance: { date: string; age: number; lieu: string | null } | null; // date ISO ; age calculé à la requête (date du jour à Paris), à son décès si deces n'est pas null ; lieu : « Beauvais », « Alger (Algérie) »
  deces: string | null; // date ISO du décès
  profession: string | null; // libellé déclaré à l'Assemblée, sans le préfixe de code INSEE
  /** Mandat de député (17ᵉ législature) en cours, sinon le dernier : fin est null tant qu'il est en cours. legislatures : toutes celles où il ou elle a été député, de la plus ancienne à la plus récente. */
  mandat: { depuis: string; fin: string | null; legislatures: number[] } | null;
  /** Ses groupes dans la 17ᵉ législature, du plus ancien au plus récent (fin null : groupe actuel). Les périodes contiguës d'un même groupe sont fusionnées. */
  groupes: { groupe: Groupe; debut: string; fin: string | null }[];
  /** Fonctions en cours à l'Assemblée (bureau, commission permanente), pour un député en mandat : { organe: « Commission des affaires étrangères », qualite: « Membre », depuis }. */
  fonctions: { organe: string; qualite: string; depuis: string }[];
  partiRattachement: string | null; // parti de rattachement en cours (financement des partis), tel que déclaré à l'Assemblée
  liens: LiensDepute;
  taux: {
    participation: number | null; // 0..1, calculé : votes exprimés / scrutins où le député était membre (« participation aux scrutins publics »)
    abstention: number | null; // 0..1, calculé : abstentions / votes exprimés
    loyaute: number | null; // 0..1, calculé : votes alignés sur la position majoritaire de son groupe / votes exprimés
  };
  /** Ses scrutins en mandat, répartis : pour + contre + abstention + nonVote = enMandat ; nonVote = cases N (non-votant) + X (absent). */
  scrutins: { enMandat: number; pour: number; contre: number; abstention: number; nonVote: number };
  dernieresLois: VoteDepute[]; // ses votes sur les 10 derniers votes finaux
}
