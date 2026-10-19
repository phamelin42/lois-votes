import type { Compte, Groupe, Position, PositionGroupe, TypeScrutin, VoteGroupe } from '@contrat';
import { GROUPE_NI } from './groupes';

// Le classement des scrutins par titre est partagé avec le script `scripts/donnees/`.
export { classer, classerTous, lecture, titreCourt } from '../shared/classer';

const SEUIL_MOTION = 289; // majorité absolue des 577 députés

/** Adoption : majorité des suffrages exprimés (pour > contre), sauf motion de censure (majorité absolue). */
export function estAdopte(type: TypeScrutin, compte: Compte): boolean {
  if (type === 'motion') return compte.pour >= SEUIL_MOTION;
  return compte.pour > compte.contre;
}

export interface VoteDeGroupe {
  slug: string;
  position: Position;
}

/**
 * Ventile les votes par groupe (groupe actuel du député, « NI » à défaut). La position d'un groupe est
 * sa position majoritaire, « partage » à égalité en tête. Trié par nombre de votes, puis par abrégé.
 */
export function ventilerParGroupe(
  votes: VoteDeGroupe[],
  groupeDe: (slug: string) => Groupe | undefined,
): VoteGroupe[] {
  const parGroupe = new Map<string, { groupe: Groupe; compte: Compte }>();
  for (const vote of votes) {
    const groupe = groupeDe(vote.slug) ?? GROUPE_NI;
    let entree = parGroupe.get(groupe.id);
    if (!entree) {
      entree = { groupe, compte: { pour: 0, contre: 0, abstention: 0, nonvotant: 0 } };
      parGroupe.set(groupe.id, entree);
    }
    entree.compte[vote.position]++;
  }

  const resultats = [...parGroupe.values()].map(({ groupe, compte }) => ({
    groupe,
    compte,
    position: positionMajoritaire(compte),
  }));
  const taille = (c: Compte) => c.pour + c.contre + c.abstention + c.nonvotant;
  return resultats.sort(
    (a, b) => taille(b.compte) - taille(a.compte) || (a.groupe.abrege < b.groupe.abrege ? -1 : 1),
  );
}

function positionMajoritaire(compte: Compte): PositionGroupe {
  const positions: Position[] = ['pour', 'contre', 'abstention', 'nonvotant'];
  const tries = [...positions].sort((a, b) => compte[b] - compte[a]);
  return compte[tries[0]] === compte[tries[1]] ? 'partage' : tries[0];
}

/** Part des abstentions dans les suffrages (pour + contre + abstention) ; null sans suffrage. */
export function tauxAbstention(abstentions: number, exprimesEtAbst: number): number | null {
  return exprimesEtAbst > 0 ? abstentions / exprimesEtAbst : null;
}
