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
  /** Groupes de la 17ᵉ législature qu'aucun scrutin ne liste (« AD ») : sans index dans les matrices, ils ne servent qu'à l'historique des députés. */
  autresGroupes: GroupeFichier[];
  /** Sources facultatives manquantes à la préparation : `wikipedia` quand Wikidata n'a pas répondu (le site vit sans ces liens). */
  avertissements: string[];
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
    /** Part des députés qui ont chaque information, pour les députés en mandat et pour tous. */
    couverture: { actifs: Couverture; tous: Couverture };
  };
}

export interface Couverture {
  deputes: number;
  wikipedia: number;
  hatvp: number;
  profession: number;
  naissance: number;
  siteWeb: number;
  x: number;
  facebook: number;
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
  /** Date `AAAA-MM-JJ` et lieu (« Beauvais », « Alger (Algérie) ») ; `null` sans date. L'âge n'est pas stocké : il se calcule à la requête. */
  naissance: { date: string; lieu: string | null } | null;
  /** Date du décès. */
  deces: string | null;
  /** Profession déclarée, sans le préfixe de code INSEE. */
  profession: string | null;
  /** Mandat de député de la 17ᵉ législature en cours, sinon le dernier ; `legislatures` : toutes celles où il ou elle a été député. `null` sans mandat. */
  mandat: { depuis: string; fin: string | null; legislatures: number[] } | null;
  /** Groupes de la 17ᵉ législature, du plus ancien au plus récent : `id` est dans `groupes.json` ou dans `meta.autresGroupes`. */
  groupes: { id: string; debut: string; fin: string | null }[];
  /** Fonctions en cours (bureau de l'Assemblée, commission permanente) d'un député en mandat. */
  fonctions: { organe: string; qualite: string; depuis: string }[];
  /** Parti de rattachement en cours (libellé de l'organe), pour un député en mandat. */
  parti: string | null;
  /** Adresses externes, seulement quand elles sont fiables : https, sur le site attendu. */
  liens: {
    hatvp: string | null;
    wikipedia: string | null;
    siteWeb: string | null;
    x: string | null;
    facebook: string | null;
  };
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
