import type { Compte, Position } from '@contrat';
import type { Ligne } from './tabulaire';

/**
 * Seul endroit qui connaît les noms de colonnes et les valeurs de la source, et qui convertit une ligne
 * brute en type interne. NosParlementaires : confirmé par les exports publics (PLAN.md, « Constats »).
 * Datan : PROVISOIRE, à confirmer avec l'API tabulaire (prompt 00).
 */

export const COLONNES_SCRUTINS = {
  id: 'id',
  date: 'date',
  titre: 'title',
  dossier: 'dossier_ref',
  pour: 'pour',
  contre: 'contre',
  abstention: 'abstention',
  nonvotant: 'nonvotant',
} as const;

export const COLONNES_VOTES = {
  scrutin: 'scrutin_id',
  depute: 'deputy_slug',
  position: 'position',
} as const;

export const COLONNES_DEPUTES = {
  slug: 'slug',
  prenom: 'first_name',
  nom: 'last_name',
  groupe: 'group_short',
  groupeLibelle: 'group_label',
  circonscription: 'constituency_label',
  departement: 'department_code',
  actif: 'active',
} as const;

export const COLONNES_DATAN = {
  id: 'id', // identifiant « PA… »
  prenom: 'prenom',
  nom: 'nom',
  departement: 'departement_code',
  participation: 'participation_score', // 0..1
  loyaute: 'loyaute_score', // 0..1
} as const;

const PREFIXE_ID_SCRUTIN = 'VTANR5L17V';

/** `VTANR5L17V110` pour le scrutin 110. */
export const identifiantScrutin = (numero: number): string => `${PREFIXE_ID_SCRUTIN}${numero}`;

/** Position telle qu'écrite dans la colonne `position` de la source. */
export const POSITION_SOURCE: Record<Position, string> = {
  pour: 'POUR',
  contre: 'CONTRE',
  abstention: 'ABSTENTION',
  nonvotant: 'NONVOTANT',
};

const POSITION_DEPUIS_SOURCE = Object.fromEntries(
  Object.entries(POSITION_SOURCE).map(([position, source]) => [source, position]),
) as Record<string, Position>;

export interface ScrutinSource {
  id: string;
  numero: number;
  date: string; // ISO 8601
  titre: string;
  dossier: string | null;
  compte: Compte;
}

export interface VoteSource {
  scrutinId: string;
  slug: string;
  position: Position;
}

export interface DeputeSource {
  slug: string;
  prenom: string;
  nom: string;
  groupeAbrege: string | null;
  groupeLibelle: string | null;
  departement: string | null;
  circonscription: string | null;
}

export interface DatanDepute {
  pa: string; // « PA1004 »
  prenom: string;
  nom: string;
  departement: string | null;
  participation: number | null; // 0..1
  loyaute: number | null; // 0..1
}

const texte = (valeur: unknown): string => (typeof valeur === 'string' ? valeur.trim() : '');

const nombre = (valeur: unknown): number => {
  const n = typeof valeur === 'string' && valeur === '' ? NaN : Number(valeur);
  return Number.isFinite(n) ? n : 0;
};

const nombreOuNull = (valeur: unknown): number | null => {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
};

const texteOuNull = (valeur: unknown): string | null => texte(valeur) || null;

export function versScrutin(ligne: Ligne): ScrutinSource | null {
  const id = texte(ligne[COLONNES_SCRUTINS.id]);
  const numero = Number(/(\d+)$/.exec(id)?.[1]);
  const date = new Date(texte(ligne[COLONNES_SCRUTINS.date]));
  if (!Number.isInteger(numero) || Number.isNaN(date.getTime())) return null;
  return {
    id,
    numero,
    date: date.toISOString(),
    titre: texte(ligne[COLONNES_SCRUTINS.titre]),
    dossier: texteOuNull(ligne[COLONNES_SCRUTINS.dossier]),
    compte: {
      pour: nombre(ligne[COLONNES_SCRUTINS.pour]),
      contre: nombre(ligne[COLONNES_SCRUTINS.contre]),
      abstention: nombre(ligne[COLONNES_SCRUTINS.abstention]),
      nonvotant: nombre(ligne[COLONNES_SCRUTINS.nonvotant]),
    },
  };
}

export function versVote(ligne: Ligne): VoteSource | null {
  const position = POSITION_DEPUIS_SOURCE[texte(ligne[COLONNES_VOTES.position])];
  const slug = texte(ligne[COLONNES_VOTES.depute]);
  const scrutinId = texte(ligne[COLONNES_VOTES.scrutin]);
  if (!position || !slug || !scrutinId) return null;
  return { scrutinId, slug, position };
}

export function versDepute(ligne: Ligne): DeputeSource | null {
  const slug = texte(ligne[COLONNES_DEPUTES.slug]);
  if (!slug) return null;
  const prenom = texte(ligne[COLONNES_DEPUTES.prenom]);
  const nom = texte(ligne[COLONNES_DEPUTES.nom]);
  return {
    slug,
    prenom,
    nom,
    groupeAbrege: texteOuNull(ligne[COLONNES_DEPUTES.groupe]),
    groupeLibelle: texteOuNull(ligne[COLONNES_DEPUTES.groupeLibelle]),
    departement: texteOuNull(ligne[COLONNES_DEPUTES.departement]),
    circonscription: texteOuNull(ligne[COLONNES_DEPUTES.circonscription]),
  };
}

export function versDatan(ligne: Ligne): DatanDepute | null {
  const pa = texte(ligne[COLONNES_DATAN.id]);
  if (!pa) return null;
  return {
    pa,
    prenom: texte(ligne[COLONNES_DATAN.prenom]),
    nom: texte(ligne[COLONNES_DATAN.nom]),
    departement: texteOuNull(ligne[COLONNES_DATAN.departement]),
    participation: nombreOuNull(ligne[COLONNES_DATAN.participation]),
    loyaute: nombreOuNull(ligne[COLONNES_DATAN.loyaute]),
  };
}
