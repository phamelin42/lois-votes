import { photoDe } from './photo';

describe('photoDe', () => {
  it("construit l'URL de la photo officielle avec le numéro sans préfixe", () => {
    expect(photoDe('720468')).toBe(
      'https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/720468.jpg',
    );
  });

  it('retire un préfixe « PA » reçu par erreur (avec lui, la photo répond 404)', () => {
    expect(photoDe('PA720468')).toBe(photoDe('720468'));
  });

  it('garde un numéro court tel quel', () => {
    expect(photoDe('1008')).toMatch(/\/carre\/1008\.jpg$/);
  });
});
