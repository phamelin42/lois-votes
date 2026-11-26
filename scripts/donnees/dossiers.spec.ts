// @vitest-environment node
import { DEBUT_LEGISLATURE, modeSansVote, rattacher, textesSansVote } from './dossiers.mjs';

interface Decision {
  date: string;
  lecture: string;
  statut: string;
  seance: string | null;
  scrutins: number[];
  textes: string[];
}

const decision = (plus: Partial<Decision> = {}): Decision => ({
  date: '2026-02-25',
  lecture: 'première lecture',
  statut: 'adopté',
  seance: 'S1',
  scrutins: [],
  textes: [],
  ...plus,
});

const dossier = (
  uid: string,
  decisions: Decision[],
  plus: { estLoi?: boolean; motions?: number[]; titre?: string | null } = {},
) => ({
  uid,
  titre: plus.titre === undefined ? `Titre du dossier ${uid}` : plus.titre,
  procedure: plus.estLoi === false ? 'Résolution' : 'Projet de loi ordinaire',
  estLoi: plus.estLoi ?? true,
  decisions,
  motions: plus.motions ?? [],
});

describe('rattacher', () => {
  it('garde le dossier indiqué par le scrutin, même si un autre dossier le cite', () => {
    const { dossierDe } = rattacher(
      [{ numero: 1, dossier: 'DLA' }],
      [dossier('DLB', [decision({ scrutins: [1] })])],
    );
    expect(dossierDe.get(1)).toBe('DLA');
  });

  it('rattache un scrutin sans dossier au seul dossier de loi qui le cite, décision ou motion de censure', () => {
    const r = rattacher(
      [
        { numero: 1, dossier: null },
        { numero: 2, dossier: null },
        { numero: 3, dossier: null },
      ],
      [dossier('DLA', [decision({ scrutins: [1] })], { motions: [2] })],
    );
    expect([...r.dossierDe]).toEqual([
      [1, 'DLA'],
      [2, 'DLA'],
      [3, null],
    ]);
    expect(r.rattaches).toBe(2);
  });

  it('laisse sans dossier un scrutin que citent deux dossiers de loi, et le compte', () => {
    const r = rattacher(
      [{ numero: 1, dossier: null }],
      [
        dossier('DLA', [decision({ scrutins: [1] })]),
        dossier('DLB', [decision({ scrutins: [1] })]),
      ],
    );
    expect(r.dossierDe.get(1)).toBeNull();
    expect(r.ambigus).toBe(1);
    expect(r.rattaches).toBe(0);
  });

  it("ignore les citations d'un dossier qui n'est pas une loi (engagement de responsabilité, résolution)", () => {
    const r = rattacher(
      [{ numero: 1, dossier: null }],
      [
        dossier('DLLOI', [], { motions: [1] }),
        dossier('DLENGAGEMENT', [], { motions: [1], estLoi: false }),
      ],
    );
    expect(r.dossierDe.get(1)).toBe('DLLOI');
    expect(r.ambigus).toBe(0);
  });
});

describe('modeSansVote', () => {
  // La séance S1 a un vote sur l'ensemble (n° 10) rattaché à un autre texte, et un amendement (n° 11).
  const scrutins = [
    { numero: 10, date: '2026-02-25', seance: 'S1', final: true },
    { numero: 11, date: '2026-02-25', seance: 'S1', final: false },
  ];
  const contexte = (dossierDe: Map<number, string | null>) => ({
    dossier: 'DLA',
    scrutins,
    dossierDe,
  });
  const autre = new Map<number, string | null>([
    [10, 'DLB'],
    [11, null],
  ]);

  it("dit « main levée » pour une adoption sans scrutin, quand la séance n'a de vote final que pour d'autres textes", () => {
    expect(modeSansVote(decision(), contexte(autre))).toBe('mainLevee');
  });

  it('dit « main levée » quand la séance ne compte aucun vote sur l’ensemble d’un texte', () => {
    expect(modeSansVote(decision({ seance: 'S2' }), contexte(autre))).toBe('mainLevee');
  });

  it('ne dit rien quand la décision cite un scrutin : il y a un vote nominatif', () => {
    expect(modeSansVote(decision({ scrutins: [10] }), contexte(autre))).toBeNull();
  });

  it('doute quand la séance a un vote final rattaché à aucun texte : ce peut être le sien', () => {
    expect(modeSansVote(decision(), contexte(new Map([[10, null]])))).toBeNull();
  });

  it('ne dit rien quand la séance a un vote final du même dossier', () => {
    expect(modeSansVote(decision(), contexte(new Map([[10, 'DLA']])))).toBeNull();
  });

  it("compare au jour quand la décision n'a pas de séance", () => {
    const sansSeance = decision({ seance: null });
    expect(modeSansVote(sansSeance, contexte(new Map([[10, null]])))).toBeNull();
    expect(modeSansVote(sansSeance, contexte(autre))).toBe('mainLevee');
    expect(
      modeSansVote({ ...sansSeance, date: '2026-03-01' }, contexte(new Map([[10, null]]))),
    ).toBe('mainLevee');
  });

  it("reconnaît l'adoption par l'article 49, alinéa 3", () => {
    const statut =
      "considéré comme adopté par l'Assemblée nationale en application de l'article 49, alinéa 3 de la Constitution";
    expect(modeSansVote(decision({ statut }), contexte(new Map([[10, null]])))).toBe('article49-3');
  });

  it("n'ajoute pas un texte considéré comme rejeté par le 49.3, ni un texte rejeté", () => {
    const statut =
      "considéré comme rejeté par l'Assemblée nationale en application de l'article 49, alinéa 3 de la Constitution";
    expect(modeSansVote(decision({ statut }), contexte(autre))).toBeNull();
    expect(modeSansVote(decision({ statut: 'rejeté' }), contexte(autre))).toBeNull();
    expect(modeSansVote(decision({ statut: 'rejetée' }), contexte(autre))).toBeNull();
    expect(modeSansVote(decision({ statut: '' }), contexte(autre))).toBeNull();
  });

  it("ne confond pas l'article 45, alinéa 3 (texte de CMP adopté) avec le 49.3", () => {
    for (const statut of [
      "adoptée, dans les conditions prévues à l'article 45, alinéa 3, de la Constitution",
      "adopté, dans les conditions prévues à l'article 45, alinéa 3, de la Constitution",
    ])
      expect(modeSansVote(decision({ statut }), contexte(autre))).toBe('mainLevee');
  });

  it('compte comme adoptés « adoptée sans modification », « modifiée », « modifié »', () => {
    for (const statut of [
      'adoptée sans modification',
      'adopté sans modification',
      'modifiée',
      'modifié',
    ])
      expect(modeSansVote(decision({ statut }), contexte(autre))).toBe('mainLevee');
  });
});

describe('textesSansVote', () => {
  const scrutins = [{ numero: 10, date: '2026-02-25', seance: 'S1', final: true }];
  const dossierDe = new Map<number, string | null>([[10, 'DLB']]);
  const titres = new Map<string, string | null>([
    ['TXT2', 'projet de loi autorisant l’approbation de l’accord X'],
    ['TXTVIDE', null],
  ]);
  const appel = (dossiers: ReturnType<typeof dossier>[]) =>
    textesSansVote({ dossiers, titres, scrutins, dossierDe });

  it('garde les dossiers de loi qui ont une décision sans vote nominatif, avec le titre du texte adopté', () => {
    expect(
      appel([
        dossier('DLA', [
          decision({ date: '2025-06-01', seance: 'S0', textes: ['TXT1'] }),
          decision({
            date: '2026-02-25',
            lecture: 'texte de la commission mixte paritaire',
            textes: ['TXTVIDE', 'TXT2'],
          }),
        ]),
      ]),
    ).toEqual([
      {
        id: 'DLA',
        titre: 'projet de loi autorisant l’approbation de l’accord X',
        decisions: [
          {
            date: '2026-02-25',
            lecture: 'texte de la commission mixte paritaire',
            mode: 'mainLevee',
          },
          { date: '2025-06-01', lecture: 'première lecture', mode: 'mainLevee' },
        ],
      },
    ]);
  });

  it('préfère le titre du dossier quand il nomme déjà le texte de loi (le titre du texte adopté peut avoir une coquille)', () => {
    const avecCoquille = new Map([['TXT', 'projet de loi de finances de finances pour 2026']]);
    const [t] = textesSansVote({
      dossiers: [
        dossier('DLA', [decision({ textes: ['TXT'] })], {
          titre: 'Projet de loi de finances pour 2026',
        }),
      ],
      titres: avecCoquille,
      scrutins,
      dossierDe,
    });
    expect(t.titre).toBe('Projet de loi de finances pour 2026');
  });

  it("prend le titre du dossier quand aucun texte associé n'a de titre", () => {
    expect(appel([dossier('DLA', [decision({ textes: ['TXTVIDE', 'INCONNU'] })])])[0].titre).toBe(
      'Titre du dossier DLA',
    );
  });

  it("écarte un texte qui n'a aucun titre, ni de dossier ni de texte adopté", () => {
    expect(appel([dossier('DLA', [decision({ textes: ['TXTVIDE'] })], { titre: null })])).toEqual(
      [],
    );
  });

  it("écarte une décision d'avant la 17ᵉ législature, une résolution et un texte voté par scrutin", () => {
    expect(DEBUT_LEGISLATURE).toBe('2024-07-18');
    expect(
      appel([
        dossier('DL16', [decision({ date: '2024-07-17', seance: 'S9' })]),
        dossier('DLRES', [decision({ seance: 'S9' })], { estLoi: false }),
        dossier('DLVOTE', [decision({ scrutins: [10] })]),
      ]),
    ).toEqual([]);
  });

  it('range les textes du plus récent au plus ancien, selon leur dernière décision sans vote', () => {
    const ids = appel([
      dossier('DLANCIEN', [decision({ date: '2025-01-10', seance: 'S7' })]),
      dossier('DLRECENT', [decision({ date: '2026-10-05', seance: 'S8' })]),
    ]).map((t) => t.id);
    expect(ids).toEqual(['DLRECENT', 'DLANCIEN']);
  });
});
