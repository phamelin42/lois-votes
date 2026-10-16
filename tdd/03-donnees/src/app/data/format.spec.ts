import { dateCourte, dateLongue, libellePosition, normaliser, pourcent } from './format';

const espaces = (texte: string) => texte.replace(/\s/g, ' ');

describe('pourcent', () => {
  it('formate un taux de 0 à 1 en pourcentage entier, à la française', () => {
    expect(espaces(pourcent(0.734))).toBe('73 %');
    expect(espaces(pourcent(0))).toBe('0 %');
    expect(espaces(pourcent(1))).toBe('100 %');
    expect(espaces(pourcent(0.996))).toBe('100 %');
  });

  it('affiche un tiret quand la valeur est inconnue', () => {
    expect(pourcent(null)).toBe('—');
    expect(pourcent(undefined)).toBe('—');
  });
});

describe('dates', () => {
  it('formate dans le fuseau Europe/Paris : 22 h UTC en hiver tombe le lendemain', () => {
    expect(dateCourte('2024-10-07T22:00:00+00:00')).toBe('8 oct. 2024');
    expect(dateLongue('2024-10-07T22:00:00+00:00')).toBe('8 octobre 2024');
  });

  it('garde le même jour quand l\'heure UTC reste dans la journée à Paris', () => {
    expect(dateCourte('2024-10-07T10:00:00+00:00')).toBe('7 oct. 2024');
    expect(dateLongue('2025-01-15T09:00:00+00:00')).toBe('15 janvier 2025');
  });

  it('accepte une date sans heure', () => {
    expect(dateLongue('2025-03-04')).toBe('4 mars 2025');
  });
});

describe('normaliser', () => {
  it('passe en minuscules et retire les accents', () => {
    expect(normaliser('Élodie ÇA')).toBe('elodie ca');
    expect(normaliser('Gaëlle Saint-Étienne')).toBe('gaelle saint-etienne');
  });

  it('retire les espaces en trop', () => {
    expect(normaliser('  Alice   Durand ')).toBe('alice durand');
  });

  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(normaliser('')).toBe('');
  });
});

describe('libellePosition', () => {
  it('traduit chaque position', () => {
    expect(libellePosition('pour')).toBe('Pour');
    expect(libellePosition('contre')).toBe('Contre');
    expect(libellePosition('abstention')).toBe('Abstention');
    expect(libellePosition('nonvotant')).toBe('Non-votant');
    expect(libellePosition('partage')).toBe('Partagé');
  });
});
