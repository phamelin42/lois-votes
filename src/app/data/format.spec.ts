import {
  dateCourte,
  dateLongue,
  libellePosition,
  normaliser,
  pourcent,
  pourcentEntier,
  pourcentPartiel,
  repartir,
} from './format';

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

describe('repartir', () => {
  it('répartit 100 par la méthode du plus fort reste, somme exacte', () => {
    expect(repartir([351, 179, 7])).toEqual([66, 33, 1]);
    expect(repartir([1, 1, 1])).toEqual([34, 33, 33]);
    expect(repartir([1, 1])).toEqual([50, 50]);
    expect(repartir([0, 0, 5])).toEqual([0, 0, 100]);
  });

  it('ne divise pas par zéro : tout vaut 0 sans aucune part', () => {
    expect(repartir([0, 0, 0])).toEqual([0, 0, 0]);
    expect(repartir([])).toEqual([]);
  });

  it("somme toujours 100 dès qu'il y a une part", () => {
    for (let a = 0; a < 15; a++)
      for (let b = 0; b < 15; b++)
        for (let c = 0; c < 15; c++) {
          if (a + b + c === 0) continue;
          expect(repartir([a, b, c]).reduce((x, y) => x + y, 0)).toBe(100);
        }
  });
});

describe('pourcentEntier et pourcentPartiel', () => {
  it('écrit un entier en pourcentage à la française', () => {
    expect(espaces(pourcentEntier(27))).toBe('27 %');
  });

  it("écrit « moins de 1 % » et « 99 % » plutôt qu'un 0 % ou un 100 % faux", () => {
    expect(espaces(pourcentPartiel(1, 1001))).toBe('moins de 1 %');
    expect(espaces(pourcentPartiel(999, 1000))).toBe('99 %');
  });

  it('garde 0 % et 100 % quand ils sont exacts, et ne divise pas par zéro', () => {
    expect(espaces(pourcentPartiel(0, 10))).toBe('0 %');
    expect(espaces(pourcentPartiel(10, 10))).toBe('100 %');
    expect(espaces(pourcentPartiel(0, 0))).toBe('0 %');
    expect(espaces(pourcentPartiel(40, 577))).toBe('7 %');
  });
});

describe('dates', () => {
  it('formate dans le fuseau Europe/Paris : 22 h UTC en hiver tombe le lendemain', () => {
    expect(dateCourte('2024-10-07T22:00:00+00:00')).toBe('8 oct. 2024');
    expect(dateLongue('2024-10-07T22:00:00+00:00')).toBe('8 octobre 2024');
  });

  it("garde le même jour quand l'heure UTC reste dans la journée à Paris", () => {
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
