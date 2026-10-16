import type { Groupe } from '@contrat';

/**
 * Les 12 groupes de la 17ᵉ législature. C'est de la configuration, pas de la donnée : l'identifiant est
 * l'abrégé utilisé par la source (`group_short`). Les couleurs sont indicatives, pour une pastille seulement :
 * à vérifier sur le site de l'Assemblée avant mise en ligne.
 */
/** Groupe des députés sans groupe connu. */
export const GROUPE_NI: Groupe = { id: 'NI', abrege: 'NI', libelle: 'Non inscrits', couleur: null };

export const GROUPES_OFFICIELS: Groupe[] = [
  { id: 'RN', abrege: 'RN', libelle: 'Rassemblement National', couleur: '#0d378a' },
  { id: 'EPR', abrege: 'EPR', libelle: 'Ensemble pour la République', couleur: '#fdb913' },
  {
    id: 'LFI-NFP',
    abrege: 'LFI-NFP',
    libelle: 'La France insoumise - Nouveau Front Populaire',
    couleur: '#cc2443',
  },
  { id: 'SOC', abrege: 'SOC', libelle: 'Socialistes et apparentés', couleur: '#ff8080' },
  { id: 'DR', abrege: 'DR', libelle: 'Droite républicaine', couleur: '#1c3f94' },
  { id: 'ECOS', abrege: 'ECOS', libelle: 'Écologiste et social', couleur: '#5fb236' },
  { id: 'DEM', abrege: 'DEM', libelle: 'Les Démocrates', couleur: '#f5a623' },
  { id: 'HOR', abrege: 'HOR', libelle: 'Horizons et indépendants', couleur: '#5b9bd5' },
  {
    id: 'LIOT',
    abrege: 'LIOT',
    libelle: 'Libertés, indépendants, outre-mer et territoires',
    couleur: '#8fb8de',
  },
  {
    id: 'UDDPLR',
    abrege: 'UDDPLR',
    libelle: 'Union des droites pour la République',
    couleur: '#3a5fa8',
  },
  { id: 'GDR', abrege: 'GDR', libelle: 'Gauche démocrate et républicaine', couleur: '#b3001b' },
  GROUPE_NI,
];

export function groupeParAbrege(abrege: string): Groupe | undefined {
  return GROUPES_OFFICIELS.find((groupe) => groupe.abrege === abrege);
}
