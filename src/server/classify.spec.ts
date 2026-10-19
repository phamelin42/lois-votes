import type { TypeScrutin } from '@contrat';
import { classer, lecture, titreCourt } from './classify';

describe('classer', () => {
  const cas: [string, TypeScrutin][] = [
    // votes sur l'ensemble d'un texte
    ["l'ensemble du projet de loi de finances pour 2025 (nouvelle lecture)", 'final'],
    [
      "l'ensemble de la proposition de loi visant à renforcer la sécurité des élus locaux (première lecture)",
      'final',
    ],
    [
      "l'ensemble du projet de loi relatif à la simplification de la vie économique (lecture définitive)",
      'final',
    ],
    [
      "l'ensemble de la proposition de loi organique visant à garantir le pluralisme (première lecture)",
      'final',
    ],
    [
      "l'ensemble du projet de loi de financement de la sécurité sociale pour 2025 (nouvelle lecture)",
      'final',
    ],
    [
      "l'ensemble du projet de loi constitutionnelle portant sur la Nouvelle-Calédonie (première lecture)",
      'final',
    ],
    [
      "l'ensemble du projet de loi autorisant la ratification de l'accord entre la France et le Canada",
      'final',
    ],
    [
      'l’ensemble de la proposition de loi visant à protéger les abeilles (première lecture)',
      'final',
    ],
    ["L'ensemble du projet de loi relatif à la sobriété foncière (première lecture)", 'final'],
    // motions de censure
    [
      "la motion de censure déposée en application de l'article 49, alinéa 2, de la Constitution par Mme Mathilde Panot et plusieurs de ses collègues",
      'motion',
    ],
    [
      "la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par M. Éric Coquerel",
      'motion',
    ],
    // articles
    ["l'article 1er du projet de loi relatif à la sobriété foncière", 'article'],
    ["l'article 3 de la proposition de loi visant à protéger les abeilles", 'article'],
    ["l'article 12 bis du projet de loi de finances pour 2025", 'article'],
    ["l'article unique de la proposition de loi visant à rétablir la confiance", 'article'],
    ["l'article 2 du projet de loi, modifié par le Sénat", 'article'],
    // amendements (même quand le titre mentionne un article)
    [
      "l'amendement n° 1234 de M. Dupont à l'article 3 du projet de loi relatif à la sobriété foncière",
      'amendement',
    ],
    ["l'amendement n° 5 de suppression de l'article 2 de la proposition de loi", 'amendement'],
    ["l'amendement n° 7 de Mme Durand après l'article 4", 'amendement'],
    ["les amendements identiques n° 12 et 45 à l'article 6", 'amendement'],
    ["l'amendement n° 8 rectifié du Gouvernement", 'amendement'],
    ["le sous-amendement n° 33 de M. Martin à l'amendement n° 12 du Gouvernement", 'amendement'],
    ["les amendements n° 101, 102 et 103 après l'article 9", 'amendement'],
    // tout le reste
    ["l'ensemble des crédits de la mission « Défense »", 'autre'],
    ["l'ensemble des articles de la première partie du projet de loi de finances", 'autre'],
    ['la première partie du projet de loi de finances pour 2025', 'autre'],
    ['la déclaration de politique générale du Gouvernement', 'autre'],
    [
      'la motion de rejet préalable de la proposition de loi visant à protéger les abeilles',
      'autre',
    ],
    ['la motion référendaire déposée par M. Untel', 'autre'],
    [
      "l'exception d'irrecevabilité soulevée sur le projet de loi relatif à la sobriété foncière",
      'autre',
    ],
    ['la question préalable opposée au projet de loi de finances', 'autre'],
    ['le passage à la discussion des articles du projet de loi relatif aux jeux', 'autre'],
    ["la demande de constitution d'une commission d'enquête sur les moyens de l'État", 'autre'],
    ['', 'autre'],
  ];

  it.each(cas)('« %s » est %s', (titre, attendu) => {
    expect(classer(titre)).toBe(attendu);
  });

  it('couvre au moins 30 titres réalistes', () => {
    expect(cas.length).toBeGreaterThanOrEqual(30);
  });
});

describe('titreCourt et lecture', () => {
  const cas: [string, string, string | null][] = [
    [
      "l'ensemble du projet de loi relatif à la sobriété foncière (première lecture)",
      'Projet de loi relatif à la sobriété foncière',
      'première lecture',
    ],
    [
      "l'ensemble de la proposition de loi visant à protéger les abeilles (nouvelle lecture)",
      'Proposition de loi visant à protéger les abeilles',
      'nouvelle lecture',
    ],
    [
      "l'ensemble du projet de loi de finances pour 2025 (lecture définitive)",
      'Projet de loi de finances pour 2025',
      'lecture définitive',
    ],
    [
      "l'ensemble de la proposition de loi organique visant à garantir le pluralisme",
      'Proposition de loi organique visant à garantir le pluralisme',
      null,
    ],
    [
      "l'ensemble du projet de loi relatif aux jeux (JOP 2024) (première lecture)",
      'Projet de loi relatif aux jeux (JOP 2024)',
      'première lecture',
    ],
    [
      'l’ensemble de la proposition de loi visant à protéger les abeilles (première lecture)',
      'Proposition de loi visant à protéger les abeilles',
      'première lecture',
    ],
  ];

  it.each(cas)('« %s »', (titre, court, lect) => {
    expect(titreCourt(titre)).toBe(court);
    expect(lecture(titre)).toBe(lect);
  });

  it("met une majuscule à un titre qui n'est pas un vote sur l'ensemble", () => {
    expect(titreCourt("l'article 3 du projet de loi relatif à la sobriété foncière")).toBe(
      "L'article 3 du projet de loi relatif à la sobriété foncière",
    );
    expect(lecture("l'article 3 du projet de loi relatif à la sobriété foncière")).toBeNull();
  });
});
