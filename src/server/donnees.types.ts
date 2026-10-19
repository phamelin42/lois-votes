import type { Compte, PositionGroupe, TypeScrutin } from '@contrat';

/*
 * Types des fichiers de `data/`, produits par `scripts/donnees/` et lus par le serveur (voir docs/DONNEES.md).
 * Un test (`scripts/donnees/donnees.spec.ts`) vérifie que la sortie du mode `fixtures` y est conforme.
 */

/** Origine d'une archive officielle. En mode `fixtures`, `url` est le dossier des fixtures et le reste est `null`. */
export interface SourceArchive {
  url: string;
  lastModified: string | null;
  etag: string | null;
}

/** `meta.json`. */
export interface DonneesMeta {
  /** ISO 8601 UTC, sans millisecondes. */
  genereLe: string;
  scrutins: number;
  deputes: number;
  groupes: number;
  sources: { scrutins: SourceArchive; acteurs: SourceArchive };
  /** Mesures faites pendant la réduction, pour le journal de build et la page « à propos ». */
  statistiques: {
    adoptes: number;
    rejetes: number;
    sansDossier: number;
    /** Scrutins dont la section `miseAuPoint` de l'archive n'est pas vide (non appliquée). */
    misesAuPoint: number;
    /** Entrées de groupe dont l'`organeRef` officiel était `PO0` (ou inconnu) et qu'on a rattachées au vrai groupe. */
    groupesRattaches: number;
    /** Scrutins dont le nombre de non-votants officiel ne valait pas la somme des groupes (remplacé par la somme). */
    nonVotantsCorriges: number[];
  };
}

/** Un élément de `groupes.json` : organe de type `GP` de la 17ᵉ législature présent dans au moins un scrutin. */
export interface GroupeFichier {
  /** Identifiant officiel (« PO845401 »). */
  id: string;
  /** Abrégé officiel avec sa casse (« RN », « EcoS »). Pas unique : les deux organes UDR le partagent. */
  abrege: string;
  libelle: string;
  /** `couleurAssociee`, pour une pastille seulement. */
  couleur: string | null;
  debut: string | null;
  fin: string | null;
}

/** Un élément de `deputes.json` (la position dans le tableau est la colonne des matrices). */
export interface DeputeFichier {
  pa: string;
  slug: string;
  /** « Prénom Nom », avec la précision officielle des homonymes (« Alexandra Martin (Gironde) »). */
  nom: string;
  /** Nom de famille sans précision, pour le tri. */
  nomTri: string;
  /** `id` du groupe actuel, ou `null`. */
  groupe: string | null;
  departement: string | null;
  circonscription: string | null;
  actif: boolean;
}

export interface ScrutinGroupeFichier {
  /** Index dans `groupes.json`. */
  g: number;
  /** Position majoritaire du groupe, calculée sur ses suffrages exprimés (voir docs/DONNEES.md). */
  position: PositionGroupe;
  compte: Compte;
}

/** Un élément de `scrutins.json`, trié par `n` décroissant. */
export interface ScrutinFichier {
  n: number;
  date: string;
  titre: string;
  type: TypeScrutin;
  adopte: boolean;
  dossier: string | null;
  compte: Compte;
  groupes: ScrutinGroupeFichier[];
}

/**
 * Caractères des matrices `votes.txt` (un par député et par scrutin).
 * `groupes-votes.txt` utilise `0`-`9` puis `a`-`z` (index du groupe dans `groupes.json`) ou `-`.
 */
export type CaractereVote =
  | /** pour */ 'P'
    /** contre */
  | 'C'
  /** abstention */
  | 'A'
  /** non-votant (listé parmi les non-votants : président de séance, membre du gouvernement…) */
  | 'N'
  /** en mandat ce jour-là, mais dans aucune liste du scrutin : absent */
  | 'X'
  /** pas en mandat ce jour-là */
  | '-';

/** Les six fichiers de `data/`, une fois lus. */
export interface Donnees {
  meta: DonneesMeta;
  groupes: GroupeFichier[];
  deputes: DeputeFichier[];
  scrutins: ScrutinFichier[];
  /** Une ligne par scrutin (ordre de `scrutins`), un caractère par député (ordre de `deputes`). */
  votes: string[];
  /** Même forme : index du groupe au jour du vote. */
  groupesVotes: string[];
}

/** Noms des fichiers de `data/`. */
export const FICHIERS_DONNEES = [
  'meta.json',
  'groupes.json',
  'deputes.json',
  'scrutins.json',
  'votes.txt',
  'groupes-votes.txt',
] as const;

/** Caractère d'un index de groupe dans `groupes-votes.txt` (0-9 puis a-z) ; `-` pour aucun. */
export const CARACTERES_GROUPE = '0123456789abcdefghijklmnopqrstuvwxyz';
