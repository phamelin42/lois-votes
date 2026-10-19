import type { TypeScrutin } from '@contrat';
import { classer, classerTous, lecture, normaliser, titreCourt } from './classer';

/**
 * Titres tirés de l'archive officielle des scrutins (17ᵉ législature), recopiés tels quels : point final,
 * apostrophes typographiques et fautes de frappe de l'Assemblée comprises. [numéro, titre, type attendu].
 */
const REELS: [number, string, TypeScrutin][] = [
  // votes sur l'ensemble d'un texte
  [
    8695,
    "l'ensemble de la proposition de loi relative à l'expérimentation d'une gouvernance territoriale unifiée pour le centre de ressources, d'expertise et de performance sportive (CREPS) de Vichy (première lecture).",
    'final',
  ],
  [
    8419,
    "l'ensemble de la proposition de loi visant à doter la France d'une stratégie nationale de lutte contre les maladies cardio-neuro-vasculaires (texte de la commission mixte paritaire).",
    'final',
  ],
  [
    7905,
    "l'ensemble du projet de loi actualisant la programmation militaire pour les années 2024 à 2030 et portant diverses dispositions intéressant la défense (texte de la commission mixte paritaire).",
    'final',
  ],
  [
    7401,
    "l'ensemble du projet de loi portant habilitation de l'assemblée de Martinique à fixer des règles applicables sur son territoire en application de l'article 73 de la Constitution en matière d'énergie, d'eau et d'assainissement (première lecture).",
    'final',
  ],
  [
    7270,
    "l'ensemble de la proposition de loi visant à améliorer la protection et l'accompagnement des parents d'enfants atteints d'un cancer, d'une maladie grave ou d'un handicap (deuxième lecture).",
    'final',
  ],
  [
    6753,
    "l'ensemble de la proposition de loi organique portant régularisation des natifs dans le corps électoral pour les élections au congrès et aux assemblées de province de Nouvelle-Calédonie (première lecture).",
    'final',
  ],
  [
    3018,
    "l’ensemble de la proposition de loi relative au mode d'élection des membres du Conseil de Paris et des conseils municipaux de Lyon et de Marseille (lecture définitive).",
    'final',
  ],
  [
    2875,
    'l’ensemble du projet de loi organique relatif au Département-Région de Mayotte (première lecture).',
    'final',
  ],
  [
    7454,
    "l'ensemble du projet de loi constitutionnelle pour une Corse autonome au sein de la République (première lecture).",
    'final',
  ],
  [
    5222,
    "l'ensemble de la proposition de loi visant à exercer l’accès à l’emploi, à pérenniser et à étendre progressivement l’expérimentation « territoires zéro chômeur de longue durée » comme solution de retour à l’emploi pour les personnes privées durablement d’emploi (première lecture).",
    'final',
  ],
  [
    3936,
    "l'ensemble du projet de loi de finances de fin de gestion pour 2025 (première lecture).",
    'final',
  ],
  [
    4696,
    "l'ensemble du projet de loi de financement de la sécurité sociale pour 2026 (nouvelle lecture).",
    'final',
  ],
  [
    4758,
    "l'ensemble du projet de loi de financement de la sécurité sociale pour 2026 (lecture définitive).",
    'final',
  ],
  [
    918,
    "l'ensemble de de la proposition de loi instaurant des réponses adaptées et proportionnées pour prévenir notamment le développement des vignes non cultivées (première lecture).",
    'final',
  ],
  [
    6284,
    "le projet de loi autorisant l'approbation de l'accord entre le Gouvernement de la République française et la Communauté des Caraïbes relatif à l'adhésion au protocole sur les privilèges et immunités de la Communauté des Caraïbes du 14 janvier 1985 (première lecture).",
    'final',
  ],
  [
    8705,
    'la proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants (première lecture).',
    'final',
  ],
  [
    8706,
    "la proposition de loi organique visant à adapter l'autorité judiciaire à la lutte contre les violences sexuelles et intrafamiliales (première lecture).",
    'final',
  ],
  // motions de censure
  [
    1,
    "la motion de censure déposée en application de l'article 49, alinéa 2, de la Constitution par M. Boris Vallaud, Mme Mathilde Panot, Mme Cyrielle Chatelain, M. André Chassaigne et 188 de leurs collègues.",
    'motion',
  ],
  [
    2222,
    "la motion de censure, déposée en application de l'article 49, alinéa 2, de la Constitution, par Mme Aurélie Trouvé et 57 députés.",
    'motion',
  ],
  // articles
  [8876, "l'article 5 du projet de loi de finances pour 2027 (première lecture).", 'article'],
  [
    7267,
    "l'article 6 de la proposition de loi visant à améliorer la protection et l'accompagnement des parents d'enfants atteints d'un cancer, d'une maladie grave ou d'un handicap (deuxième lecture).",
    'article',
  ],
  [
    5792,
    "l'article 22 (examen prioritaire) du projet de loi relatif à la lutte contre les fraudes sociales et fiscales (première lecture).",
    'article',
  ],
  [
    2887,
    "l'article 2 bis de la proposition de loi visant à faciliter le maintien en rétention des personnes condamnées pour des faits d'une particulière gravité et présentant de forts risques de récidive (première lecture).",
    'article',
  ],
  [
    741,
    "l'article unique de la proposition de loi visant à permettre l'élection du maire d'une commune nouvelle en cas de conseil municipal incomplet (première lecture).",
    'article',
  ],
  [
    742,
    "l'ensemble de la proposition de loi visant à permettre l'élection du maire d'une commune nouvelle en cas de conseil municipal incomplet (première lecture).",
    'final',
  ],
  // amendements et sous-amendements
  [
    8877,
    "l'amendement n° 3865 de Mme Olivia Grégoire après l'article 5 du projet de loi de finances pour 2027 (première lecture).",
    'amendement',
  ],
  [
    6157,
    "l'amendement n° 36 de M. Gumbs à l'article premier du projet de loi relatif à la restitution de biens culturels provenant d’États qui, du fait d’une appropriation illicite, en ont été privés (première lecture).",
    'amendement',
  ],
  [
    2201,
    "l'amendement n° 1737 rectifié de M. Fournier à l’article 17 (examen prioritaire) du projet de loi de simplification de la vie économique (première lecture).",
    'amendement',
  ],
  [
    489,
    "l'amendement de suppression n° 1 de Mme Batho et l'amendement identique suivant à l'article premier de la proposition de loi visant à améliorer le traitement des maladies affectant les cultures végétales à l'aide d'aéronefs télépilotés (première lecture).",
    'amendement',
  ],
  [
    8748,
    "le sous-amendement n° 3984 de M. Juvin à l'amendement n° 3185 de M. Bruneau après l'article 3 du projet de loi de finances pour 2027 (première lecture).",
    'amendement',
  ],
  [
    2910,
    "le sous-amendement n° 143 de M. Turquois à l'amendement n° 76 de M. Viry à l'article premier du projet de loi portant transposition des accords nationaux interprofessionnels en faveur de l'emploi des salariés expérimentés et relatif à l'évolution du dialogue social (première lecture).",
    'amendement',
  ],
  // tout le reste
  [
    8707,
    'la motion de rejet préalable, déposée par M. Boris Vallaud, du projet de loi de finances pour 2027 (première lecture).',
    'autre',
  ],
  [
    7580,
    "la demande de suspension de séance formulée par M. Boyard en application de l'article 58 du Règlement de l'Assemblée nationale (proposition de loi visant à renforcer les prérogatives des officiers de l'état civil et du ministère public pour lutter contre les mariages simulés ou arrangés) (première lecture).",
    'autre',
  ],
  [
    8612,
    "la proposition de résolution invitant le Gouvernement à engager les démarches en vue de soutenir l'entrée au Panthéon d'Olympe de Gouges, de l'abbé Charles-Michel de l'Epée et de Zéna M'Déré (article 34-1 de la Constitution).",
    'autre',
  ],
  [
    1018,
    "l'ensemble de la proposition de résolution tendant à la création d'une commission d'enquête sur les effets psychologiques de TikTok sur les mineurs.",
    'autre',
  ],
  [4241, 'la première partie du projet de loi de finances pour 2026 (première lecture).', 'autre'],
  [
    4595,
    'la deuxième partie projet de loi de financement de la sécurité sociale pour 2026 (nouvelle lecture).',
    'autre',
  ],
  [
    242,
    "l'ensemble de la deuxième partie du projet de loi de financement de la sécurité sociale pour 2025 (première lecture).",
    'autre',
  ],
  [
    3054,
    "la déclaration de politique générale du Gouvernement de M. François Bayrou (application de l'article 49, alinéa premier, de la Constitution).",
    'autre',
  ],
  [
    3272,
    "la demande de seconde délibération, présentée par M. Salmon, des articles 1 et 2 de la proposition de loi visant à rendre systématique l'information du consommateur sur l'origine des denrées alimentaires par le moyen de l'étiquetage (première lecture).",
    'autre',
  ],
  [
    1302,
    'la proposition du Gouvernement de prolonger la séance en cours au-delà de vingt heures (proposition de loi organique visant à harmoniser le mode de scrutin aux élections municipales afin de garantir la vitalité démocratique, la cohésion municipale et la parité) (première lecture).',
    'autre',
  ],
];

const titreDe = (numero: number): string => REELS.find(([n]) => n === numero)![1];

describe("classer, sur de vrais titres de l'archive", () => {
  it('couvre au moins 40 titres réels', () => {
    expect(REELS.length).toBeGreaterThanOrEqual(40);
  });

  it.each(REELS)('scrutin %i : %s', (_numero, titre, attendu) => {
    expect(classer(titre)).toBe(attendu);
  });

  it('une motion de censure est reconnue par le type de vote MOC, même sans « motion » dans le titre', () => {
    expect(classer('le scrutin sur la défiance envers le Gouvernement', 'MOC')).toBe('motion');
    expect(classer(titreDe(1), 'MOC')).toBe('motion');
  });

  it('les autres types de vote ne changent pas le classement par le titre', () => {
    expect(classer(titreDe(8695), 'SPO')).toBe('final');
    expect(classer(titreDe(8419), 'SPS')).toBe('final');
    expect(classer(titreDe(8695), null)).toBe('final');
  });

  it("traite l'apostrophe typographique comme l'apostrophe droite", () => {
    expect(classer('l’ensemble du projet de loi relatif à X')).toBe('final');
    expect(classer('l’amendement n° 3 de M. Dupont')).toBe('amendement');
    expect(classer('l’article 4 de la proposition de loi relative à X')).toBe('article');
  });

  it('classe les sous-amendements avec les amendements', () => {
    expect(classer('les sous-amendements identiques n° 4 et 5 à l’amendement n° 2')).toBe(
      'amendement',
    );
  });

  it('un titre vide est « autre »', () => {
    expect(classer('')).toBe('autre');
  });
});

describe('normaliser', () => {
  it('uniformise apostrophes, espaces et point final', () => {
    expect(normaliser('  l’ensemble du  projet de loi X (première lecture).  ')).toBe(
      "l'ensemble du projet de loi X (première lecture)",
    );
  });

  it("corrige « de de » après « l'ensemble »", () => {
    expect(normaliser("l'ensemble de de la proposition de loi X")).toBe(
      "l'ensemble de la proposition de loi X",
    );
  });
});

describe('titreCourt et lecture, sur de vrais titres', () => {
  const cas: [number, string, string, string | null][] = [
    [
      8695,
      titreDe(8695),
      "Proposition de loi relative à l'expérimentation d'une gouvernance territoriale unifiée pour le centre de ressources, d'expertise et de performance sportive (CREPS) de Vichy",
      'première lecture',
    ],
    [
      8419,
      titreDe(8419),
      "Proposition de loi visant à doter la France d'une stratégie nationale de lutte contre les maladies cardio-neuro-vasculaires",
      'texte de la commission mixte paritaire',
    ],
    [
      7401,
      titreDe(7401),
      "Projet de loi portant habilitation de l'assemblée de Martinique à fixer des règles applicables sur son territoire en application de l'article 73 de la Constitution en matière d'énergie, d'eau et d'assainissement",
      'première lecture',
    ],
    [
      3018,
      titreDe(3018),
      "Proposition de loi relative au mode d'élection des membres du Conseil de Paris et des conseils municipaux de Lyon et de Marseille",
      'lecture définitive',
    ],
    [
      4696,
      titreDe(4696),
      'Projet de loi de financement de la sécurité sociale pour 2026',
      'nouvelle lecture',
    ],
    [
      918,
      titreDe(918),
      'Proposition de loi instaurant des réponses adaptées et proportionnées pour prévenir notamment le développement des vignes non cultivées',
      'première lecture',
    ],
    [
      6284,
      titreDe(6284),
      "Projet de loi autorisant l'approbation de l'accord entre le Gouvernement de la République française et la Communauté des Caraïbes relatif à l'adhésion au protocole sur les privilèges et immunités de la Communauté des Caraïbes du 14 janvier 1985",
      'première lecture',
    ],
    [
      8706,
      titreDe(8706),
      "Proposition de loi organique visant à adapter l'autorité judiciaire à la lutte contre les violences sexuelles et intrafamiliales",
      'première lecture',
    ],
    [
      741,
      titreDe(741),
      "Proposition de loi visant à permettre l'élection du maire d'une commune nouvelle en cas de conseil municipal incomplet",
      'première lecture',
    ],
    [8876, titreDe(8876), "L'article 5 du projet de loi de finances pour 2027", 'première lecture'],
  ];

  it.each(cas)('scrutin %i', (_numero, titre, court, lect) => {
    expect(titreCourt(titre)).toBe(court);
    expect(lecture(titre)).toBe(lect);
  });

  it('retire plusieurs parenthèses procédurales, mais pas celles qui font partie du nom du texte', () => {
    const titre =
      "l'ensemble du projet de loi relatif aux jeux (JOP 2024) (nouvelle lecture) (article 49, alinéa 3, de la Constitution)";
    expect(titreCourt(titre)).toBe('Projet de loi relatif aux jeux (JOP 2024)');
    expect(lecture(titre)).toBe('nouvelle lecture');
  });

  it("n'a pas de lecture quand le titre n'en indique pas", () => {
    expect(lecture(titreDe(1))).toBeNull();
    expect(lecture(titreDe(1018))).toBeNull();
  });
});

describe("classerTous : « l'article unique » d'un texte de loi", () => {
  const unique =
    "l'article unique de la proposition de loi appelant à élever Alfred Dreyfus au grade de général de brigade (première lecture).";
  const uniqueNouvelle =
    "l'article unique de la proposition de loi appelant à élever Alfred Dreyfus au grade de général de brigade (nouvelle lecture).";
  const ensemble =
    "l'ensemble de la proposition de loi appelant à élever Alfred Dreyfus au grade de général de brigade (première lecture).";
  const autreArticle =
    "l'article 2 de la proposition de loi appelant à élever Alfred Dreyfus au grade de général de brigade (première lecture).";
  const amendement =
    "l'amendement n° 4 de M. Untel à l'article unique de la proposition de loi appelant à élever Alfred Dreyfus au grade de général de brigade (première lecture).";
  const resolution =
    "l'article unique de la proposition de résolution européenne visant à condamner la dérive illibérale et autoritaire du gouvernement géorgien.";

  it("compte comme vote final quand le texte n'a pas d'autre vote sur l'ensemble ni sur un autre article", () => {
    expect(classerTous([{ titre: unique }])).toEqual(['final']);
    expect(classerTous([{ titre: amendement }, { titre: unique }])).toEqual([
      'amendement',
      'final',
    ]);
  });

  it("reste un article quand le texte a aussi un vote sur l'ensemble", () => {
    expect(classerTous([{ titre: unique }, { titre: ensemble }])).toEqual(['article', 'final']);
  });

  it('reste un article quand le texte a un autre article', () => {
    expect(classerTous([{ titre: unique }, { titre: autreArticle }])).toEqual([
      'article',
      'article',
    ]);
  });

  it('ne regarde que la même lecture du même texte', () => {
    expect(
      classerTous([
        { titre: unique },
        { titre: uniqueNouvelle },
        { titre: ensemble.replace('première', 'deuxième') },
      ]),
    ).toEqual(['final', 'final', 'final']);
  });

  it("ne promeut pas l'article unique d'une proposition de résolution (ce n'est pas une loi)", () => {
    expect(classerTous([{ titre: resolution }])).toEqual(['article']);
  });

  it('applique le type de vote MOC', () => {
    expect(classerTous([{ titre: 'x', typeVote: 'MOC' }, { titre: titreDe(8695) }])).toEqual([
      'motion',
      'final',
    ]);
  });

  it("titreCourt d'un article unique promu donne le nom du texte", () => {
    expect(titreCourt(unique)).toBe(
      'Proposition de loi appelant à élever Alfred Dreyfus au grade de général de brigade',
    );
  });
});
