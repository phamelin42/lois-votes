import type { PositionGroupe, TypeScrutin } from '@contrat';

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

/**
 * Répartit 100 entre des parts par la méthode du plus fort reste : des entiers dont la somme vaut exactement 100,
 * pour qu'une série de pourcentages arrondis ne dépasse jamais 100 de façon visible. Sans aucune part (total nul),
 * tout vaut 0 : jamais de division par zéro.
 */
export function repartir(parts: readonly number[]): number[] {
  const total = parts.reduce((somme, p) => somme + p, 0);
  if (total <= 0) return parts.map(() => 0);
  const exactes = parts.map((p) => (p * 100) / total);
  const entiers = exactes.map(Math.floor);
  const reste = 100 - entiers.reduce((somme, n) => somme + n, 0);
  const ordre = exactes
    .map((exacte, i) => ({ i, fraction: exacte - entiers[i], poids: parts[i] }))
    .sort((a, b) => b.fraction - a.fraction || b.poids - a.poids || a.i - b.i);
  for (let k = 0; k < reste; k++) entiers[ordre[k].i]++;
  return entiers;
}

/** Pourcentage entier déjà arrondi (`27` donne « 27 % »), à la française. */
export function pourcentEntier(valeur: number): string {
  return pourcentage.format(valeur / 100);
}

/**
 * Part de `n` dans `total` en pourcentage entier, sans jamais écrire 0 % ni 100 % quand ce n'est pas exact :
 * « moins de 1 % » et « 99 % » disent qu'il reste quelqu'un d'un côté ou de l'autre.
 */
export function pourcentPartiel(n: number, total: number): string {
  if (total <= 0) return pourcentEntier(0);
  const arrondi = Math.round((n * 100) / total);
  if (n > 0 && arrondi < 1) return `moins de ${pourcentEntier(1)}`;
  if (n < total && arrondi > 99) return pourcentEntier(99);
  return pourcentEntier(arrondi);
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

const TYPES: Record<TypeScrutin, string> = {
  final: 'Vote final',
  motion: 'Motion de censure',
  article: 'Vote sur un article',
  amendement: 'Amendement',
  autre: 'Autre scrutin',
};

/** Libellé français du type d'un scrutin (« Vote final », « Amendement »…). */
export function libelleType(type: TypeScrutin): string {
  return TYPES[type];
}

/** Résultat d'un vote, écrit en toutes lettres : jamais « loi adoptée » (voir CLAUDE.md). */
export function libelleAdoption(adopte: boolean): string {
  return adopte ? "Adopté par l'Assemblée" : "Rejeté par l'Assemblée";
}
