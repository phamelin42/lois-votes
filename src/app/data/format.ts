import type { PositionGroupe } from '@contrat';

const FUSEAU = 'Europe/Paris';

const pourcentage = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
const dateCourteFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: FUSEAU,
});
const dateLongueFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: FUSEAU,
});

const LIBELLES: Record<PositionGroupe, string> = {
  pour: 'Pour',
  contre: 'Contre',
  abstention: 'Abstention',
  nonvotant: 'Non-votant',
  partage: 'Partagé',
};

/** Taux de 0 à 1 formaté en pourcentage entier (« 73 % »), ou un tiret si la valeur est inconnue. */
export function pourcent(valeur: number | null | undefined): string {
  return valeur === null || valeur === undefined ? '—' : pourcentage.format(valeur);
}

/** Date ISO affichée dans le fuseau de Paris (« 8 oct. 2024 »). */
export function dateCourte(iso: string): string {
  return dateCourteFormat.format(new Date(iso));
}

/** Date ISO affichée dans le fuseau de Paris, mois en toutes lettres (« 8 octobre 2024 »). */
export function dateLongue(iso: string): string {
  return dateLongueFormat.format(new Date(iso));
}

/** Texte prêt pour la recherche : minuscules, sans accents, espaces réduits. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Libellé français d'une position de vote. */
export function libellePosition(position: PositionGroupe): string {
  return LIBELLES[position];
}
