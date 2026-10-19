// @vitest-environment node
import type { Position } from '@contrat';
import { CARACTERES_GROUPE, type Donnees } from '../../src/server/donnees.types';
import {
  ErreurDonnees,
  MAX_NONVOTANTS_CORRIGES,
  SEUILS_OFFICIELS,
  construire as construireReel,
  positionMajoritaire,
  slugifier,
} from './construire.mjs';

type Votants = Partial<Record<Position, string[]>>;
type Scrutin = ReturnType<typeof scrutin>;
interface Entree {
  scrutins: Scrutin[];
  acteurs: unknown[];
  organes: unknown[];
  sources: unknown;
  seuils: { scrutins: number; deputes: number };
  maintenant: Date;
}

/** `construire` typé par les fichiers de data/ (les entrées de ce test sont des objets simplifiés). */
const construire = (entree: Entree): { donnees: Donnees; fichiers: Record<string, string> } =>
  construireReel(entree as never) as never;

const SOURCES = {
  scrutins: { url: 'scrutins.zip', lastModified: null, etag: null },
  acteurs: { url: 'acteurs.zip', lastModified: null, etag: null },
};
const SEUILS_BAS = { scrutins: 1, deputes: 1 };

const organe = (
  id: string,
  abrege: string,
  preseance: number,
  debut: string,
  fin: string | null = null,
) => ({
  id,
  codeType: 'GP',
  legislature: '17',
  abrege,
  libelle: `Groupe ${abrege}`,
  couleur: '#123456',
  debut,
  fin,
  preseance,
});

const RN = organe('PO1', 'RN', 1, '2024-07-18');
const SOC = organe('PO2', 'SOC', 4, '2024-07-18');
const UDR_ANCIEN = organe('PO3', 'UDR', 11, '2024-09-12', '2025-09-04');
const UDR_NOUVEAU = organe('PO4', 'UDR', 11, '2025-09-05');
const NI = organe('PO5', 'NI', 99, '2024-07-01');
const ORGANES = [
  NI,
  UDR_NOUVEAU,
  SOC,
  RN,
  UDR_ANCIEN,
  { ...RN, id: 'PO9', codeType: 'COMPER', abrege: 'COM' },
];

const mandatGp = (organeRef: string, debut: string, fin: string | null = null) => ({
  uid: `PM-${organeRef}-${debut}`,
  type: 'GP',
  legislature: '17',
  debut,
  fin,
  organe: organeRef,
  lieu: null,
});
const NORD = { departement: 'Nord', numDepartement: '59', numCirco: '19' };
const mandatAn = (debut: string, fin: string | null = null, lieu: object | null = NORD) => ({
  uid: `PM-AN-${debut}`,
  type: 'ASSEMBLEE',
  legislature: '17',
  debut,
  fin,
  organe: 'PO838901',
  lieu,
});
const acteur = (pa: string, prenom: string, nom: string, mandats: unknown[]) => ({
  pa,
  prenom,
  nom,
  mandats,
});

const compter = (votants: Votants) => ({
  pour: votants.pour?.length ?? 0,
  contre: votants.contre?.length ?? 0,
  abstention: votants.abstention?.length ?? 0,
  nonvotant: votants.nonvotant?.length ?? 0,
});
const entree = (organeRef: string, votants: Votants) => ({
  organeRef,
  nombreMembres: 10,
  positionOfficielle: 'pour' as const,
  compte: compter(votants),
  votants: { pour: [], contre: [], abstention: [], nonvotant: [], ...votants },
});
const somme = (groupes: ReturnType<typeof entree>[]) => {
  const total = { pour: 0, contre: 0, abstention: 0, nonvotant: 0 };
  for (const g of groupes)
    for (const p of Object.keys(total) as Position[]) total[p] += g.compte[p];
  return total;
};
const scrutin = (
  numero: number,
  date: string,
  titre: string,
  groupes: ReturnType<typeof entree>[],
  plus: Record<string, unknown> = {},
) => ({
  numero,
  date,
  titre,
  codeTypeVote: 'SPO' as string | null,
  sortCode: 'adopté' as string | null,
  dossier: null as string | null,
  compte: somme(groupes),
  miseAuPoint: false,
  groupes,
  ...plus,
});

// Quatre députés : Ana (RN), Bob (SOC puis RN), Cléo (UDR ancien puis nouveau, mandat fini), Dan (arrive en 2025).
const ACTEURS = [
  acteur('PA2', 'Bob', 'Durand', [
    mandatAn('2024-06-30'),
    mandatGp('PO2', '2024-07-19', '2025-01-31'),
    mandatGp('PO1', '2025-02-01'),
  ]),
  acteur('PA1', 'Ana', 'Martin', [mandatAn('2024-06-30'), mandatGp('PO1', '2024-07-19')]),
  acteur('PA3', 'Cléo', 'Œillet', [
    mandatAn('2024-06-30', '2026-01-10', {
      departement: 'Rhône',
      numDepartement: '69',
      numCirco: '7',
    }),
    mandatGp('PO3', '2024-09-12', '2025-09-04'),
    mandatGp('PO4', '2025-09-05', '2026-01-10'),
  ]),
  acteur('PA4', 'Dan', 'Petit', [mandatAn('2025-03-01'), mandatGp('PO5', '2025-03-01')]),
];

const S1 = scrutin(1, '2025-02-10', "l'ensemble du projet de loi relatif à X (première lecture).", [
  entree('PO1', { pour: ['PA1'], contre: ['PA2'] }),
  entree('PO3', { abstention: ['PA3'] }),
]);
const S2 = scrutin(
  2,
  '2025-09-20',
  "l'amendement n° 4 de M. Untel à l'article 2 du projet de loi relatif à X (première lecture).",
  [
    entree('PO1', { pour: ['PA1', 'PA2'] }),
    entree('PO4', { nonvotant: ['PA3'] }),
    entree('PO5', { contre: ['PA4'] }),
  ],
  { dossier: 'DLR5L17N1', sortCode: 'rejeté' },
);
const S3 = scrutin(
  3,
  '2025-10-02',
  'la motion de censure déposée par M. Untel.',
  [entree('PO1', { pour: ['PA1'] }), entree('PO5', { pour: ['PA4'] })],
  {
    codeTypeVote: 'MOC',
  },
);

const base = (): Entree => ({
  scrutins: [S1, S2, S3],
  acteurs: ACTEURS,
  organes: ORGANES,
  sources: SOURCES,
  seuils: SEUILS_BAS,
  maintenant: new Date('2026-10-19T05:41:02.123Z'),
});

describe('slugifier', () => {
  it('met en minuscules, retire les accents et remplace tout séparateur par un tiret', () => {
    expect(slugifier('Sébastien Chenu')).toBe('sebastien-chenu');
    expect(slugifier("Jean-Philippe Tanguy d'Orgeval")).toBe('jean-philippe-tanguy-d-orgeval');
    expect(slugifier('Émeline K/Bidi')).toBe('emeline-k-bidi');
    expect(slugifier('Alexandra Martin (Alpes-Maritimes)')).toBe(
      'alexandra-martin-alpes-maritimes',
    );
    expect(slugifier('Cléo Œillet')).toBe('cleo-oeillet');
    expect(slugifier('  --  ')).toBe('');
  });
});

describe('positionMajoritaire', () => {
  const c = (pour: number, contre: number, abstention: number) => ({ pour, contre, abstention });

  it('prend la position en tête des suffrages exprimés', () => {
    expect(positionMajoritaire(c(7, 11, 4))).toBe('contre');
    expect(positionMajoritaire(c(14, 2, 3))).toBe('pour');
    expect(positionMajoritaire(c(0, 1, 5))).toBe('abstention');
  });

  it('renvoie « partage » à égalité en tête', () => {
    expect(positionMajoritaire(c(4, 4, 1))).toBe('partage');
    expect(positionMajoritaire(c(3, 3, 3))).toBe('partage');
    expect(positionMajoritaire(c(2, 0, 2))).toBe('partage');
  });

  it("renvoie « nonvotant » quand personne n'a exprimé de suffrage", () => {
    expect(positionMajoritaire(c(0, 0, 0))).toBe('nonvotant');
  });
});

describe('construire : groupes', () => {
  it("ne garde que les groupes (GP, 17ᵉ) présents dans un scrutin, dans l'ordre de préséance puis de date", () => {
    const { donnees } = construire(base());
    expect(donnees.groupes.map((g) => g.id)).toEqual(['PO1', 'PO3', 'PO4', 'PO5']);
    expect(donnees.groupes[0]).toEqual({
      id: 'PO1',
      abrege: 'RN',
      libelle: 'Groupe RN',
      couleur: '#123456',
      debut: '2024-07-18',
      fin: null,
    });
  });

  it('garde les deux organes qui portent le même abrégé « UDR », avec des index distincts', () => {
    const { donnees } = construire(base());
    expect(donnees.groupes.filter((g) => g.abrege === 'UDR').map((g) => g.id)).toEqual([
      'PO3',
      'PO4',
    ]);
  });

  it(`refuse plus de ${CARACTERES_GROUPE.length} groupes`, () => {
    const organes = Array.from({ length: 37 }, (_, i) =>
      organe(`PO${100 + i}`, `G${i}`, i, '2024-07-18'),
    );
    const s = scrutin(
      1,
      '2025-02-10',
      'x',
      organes.map((o) => entree(o.id, { pour: ['PA1'] })),
    );
    expect(() => construire({ ...base(), scrutins: [s], organes })).toThrow(/37 groupes/);
  });
});

describe('construire : députés', () => {
  it("liste les votants par numéro d'acteur, avec nom, groupe actuel, circonscription et statut", () => {
    const { donnees } = construire(base());
    expect(donnees.deputes).toEqual([
      {
        pa: 'PA1',
        slug: 'ana-martin',
        nom: 'Ana Martin',
        nomTri: 'Martin',
        groupe: 'PO1',
        departement: '59',
        circonscription: 'Nord (19)',
        actif: true,
      },
      {
        pa: 'PA2',
        slug: 'bob-durand',
        nom: 'Bob Durand',
        nomTri: 'Durand',
        groupe: 'PO1',
        departement: '59',
        circonscription: 'Nord (19)',
        actif: true,
      },
      {
        pa: 'PA3',
        slug: 'cleo-oeillet',
        nom: 'Cléo Œillet',
        nomTri: 'Œillet',
        groupe: 'PO4',
        departement: '69',
        circonscription: 'Rhône (7)',
        actif: false,
      },
      {
        pa: 'PA4',
        slug: 'dan-petit',
        nom: 'Dan Petit',
        nomTri: 'Petit',
        groupe: 'PO5',
        departement: '59',
        circonscription: 'Nord (19)',
        actif: true,
      },
    ]);
  });

  it("numérote les homonymes par ordre de numéro d'acteur, quel que soit l'ordre des votes", () => {
    const acteurs = ['PA10', 'PA11', 'PA12'].map((pa) =>
      acteur(pa, 'Jean', 'Dupont', [mandatAn('2024-06-30'), mandatGp('PO1', '2024-07-19')]),
    );
    const s = scrutin(1, '2025-02-10', 'x', [
      entree('PO1', { pour: ['PA12', 'PA10'], contre: ['PA11'] }),
    ]);
    const { donnees } = construire({ ...base(), scrutins: [s], acteurs });
    expect(donnees.deputes.map((d) => [d.pa, d.slug])).toEqual([
      ['PA10', 'jean-dupont'],
      ['PA11', 'jean-dupont-2'],
      ['PA12', 'jean-dupont-3'],
    ]);
  });

  it('garde la précision officielle des homonymes dans le nom, la retire du nom de tri et ne les confond pas', () => {
    const acteurs = [
      acteur('PA10', 'Alexandra', 'Martin (Alpes-Maritimes)', [
        mandatAn('2024-06-30'),
        mandatGp('PO1', '2024-07-19'),
      ]),
      acteur('PA11', 'Alexandra', 'Martin (Gironde)', [
        mandatAn('2024-06-30'),
        mandatGp('PO1', '2024-07-19'),
      ]),
    ];
    const s = scrutin(1, '2025-02-10', 'x', [entree('PO1', { pour: ['PA10', 'PA11'] })]);
    const { donnees } = construire({ ...base(), scrutins: [s], acteurs });
    expect(donnees.deputes.map((d) => [d.slug, d.nom, d.nomTri])).toEqual([
      ['alexandra-martin-alpes-maritimes', 'Alexandra Martin (Alpes-Maritimes)', 'Martin'],
      ['alexandra-martin-gironde', 'Alexandra Martin (Gironde)', 'Martin'],
    ]);
  });

  it('prend le mandat de député en cours, sinon le dernier, et le groupe en cours, sinon le dernier connu', () => {
    const paris = { departement: 'Paris', numDepartement: '75', numCirco: '4' };
    const acteurs = [
      acteur('PA1', 'Ana', 'Martin', [
        mandatAn('2024-06-30', '2024-10-21', NORD),
        mandatAn('2024-10-22', null, paris),
        mandatGp('PO2', '2024-07-19', '2025-01-01'),
        mandatGp('PO1', '2025-01-02'),
        mandatGp('PO5', '2025-03-01'), // deux groupes ouverts : le plus récent
      ]),
      acteur('PA2', 'Bob', 'Durand', [
        mandatAn('2024-06-30', '2025-04-01'),
        mandatGp('PO1', '2024-07-19', '2025-02-01'),
        mandatGp('PO2', '2025-02-02', '2025-04-01'),
      ]),
    ];
    const s = scrutin(1, '2025-02-10', 'x', [
      entree('PO1', { pour: ['PA1', 'PA2'] }),
      entree('PO2', {}),
      entree('PO5', {}),
    ]);
    const { donnees } = construire({ ...base(), scrutins: [s], acteurs });
    const [ana, bob] = donnees.deputes;
    expect(ana).toMatchObject({ groupe: 'PO5', actif: true, circonscription: 'Paris (4)' });
    expect(bob).toMatchObject({ groupe: 'PO2', actif: false });
  });

  it('laisse groupe et circonscription à null quand les mandats les ignorent', () => {
    const s = scrutin(1, '2025-02-10', 'x', [entree('PO1', { pour: ['PA1'] })]);
    const { donnees } = construire({
      ...base(),
      scrutins: [s],
      acteurs: [acteur('PA1', 'Ana', 'Martin', [])],
    });
    expect(donnees.deputes[0]).toMatchObject({
      groupe: null,
      departement: null,
      circonscription: null,
      actif: false,
    });
  });
});

describe('construire : matrices', () => {
  const { donnees, fichiers } = construire(base());
  // Colonnes : PA1 Ana, PA2 Bob, PA3 Cléo, PA4 Dan. Lignes : scrutins 3, 2, 1 (le plus récent d'abord).

  it('trie les scrutins par numéro décroissant', () => {
    expect(donnees.scrutins.map((s) => s.n)).toEqual([3, 2, 1]);
  });

  it('écrit P, C, A, N pour les votants, X pour un député en mandat absent de toutes les listes, - sinon', () => {
    expect(donnees.votes).toEqual([
      'PXXP', // 3 : Ana et Dan pour ; Bob et Cléo en mandat mais absents
      'PPNC', // 2 : Ana, Bob pour ; Cléo non-votante ; Dan contre
      'PCA-', // 1 : Ana pour, Bob contre, Cléo abstention ; Dan n'est pas encore député
    ]);
  });

  it("code le groupe du jour du vote ; pour un absent, le groupe de ses mandats s'il figure dans le scrutin", () => {
    // groupes.json : 0 PO1 (RN), 1 PO3 (UDR ancien), 2 PO4 (UDR nouveau), 3 PO5 (NI)
    expect(donnees.groupesVotes).toEqual([
      '00-3', // 3 : Bob absent, RN ; Cléo absente, groupe UDR nouveau, mais il n'est pas dans ce scrutin
      '0023', // 2
      '001-', // 1 : Cléo dans l'ancien UDR (index 1)
    ]);
  });

  it('fait correspondre les lignes aux scrutins et la longueur aux députés', () => {
    expect(fichiers['votes.txt'].split('\n')).toHaveLength(3);
    for (const ligne of [...donnees.votes, ...donnees.groupesVotes]) expect(ligne).toHaveLength(4);
  });

  it('écrit les matrices sans saut de ligne final', () => {
    expect(fichiers['votes.txt']).toBe(donnees.votes.join('\n'));
    expect(fichiers['groupes-votes.txt'].endsWith('\n')).toBe(false);
  });
});

describe('construire : scrutins', () => {
  const { donnees } = construire(base());
  const par = (n: number) => donnees.scrutins.find((s) => s.n === n)!;

  it('reprend date, titre, dossier, résultat officiel et décompte', () => {
    expect(par(2)).toMatchObject({
      n: 2,
      date: '2025-09-20',
      dossier: 'DLR5L17N1',
      adopte: false,
      compte: { pour: 2, contre: 1, abstention: 0, nonvotant: 1 },
    });
    expect(par(1)).toMatchObject({ dossier: null, adopte: true });
  });

  it("classe le type d'après le titre et le type de vote", () => {
    expect([par(1).type, par(2).type, par(3).type]).toEqual(['final', 'amendement', 'motion']);
  });

  it('range les groupes par index, avec leur décompte et leur position majoritaire calculée', () => {
    expect(par(1).groupes).toEqual([
      { g: 0, position: 'partage', compte: { pour: 1, contre: 1, abstention: 0, nonvotant: 0 } },
      { g: 1, position: 'abstention', compte: { pour: 0, contre: 0, abstention: 1, nonvotant: 0 } },
    ]);
    expect(par(2).groupes.map((g) => [g.g, g.position])).toEqual([
      [0, 'pour'],
      [2, 'nonvotant'],
      [3, 'contre'],
    ]);
  });

  it('la somme des groupes égale le décompte du scrutin', () => {
    for (const s of donnees.scrutins) {
      const total = { pour: 0, contre: 0, abstention: 0, nonvotant: 0 };
      for (const g of s.groupes)
        for (const p of Object.keys(total) as Position[]) total[p] += g.compte[p];
      expect(total).toEqual(s.compte);
    }
  });

  it("compte « l'article unique » d'un texte sans autre vote comme un vote final", () => {
    const unique = scrutin(
      4,
      '2025-10-03',
      "l'article unique de la proposition de loi visant à Y (première lecture).",
      [entree('PO1', { pour: ['PA1'] })],
    );
    const { donnees: avec } = construire({ ...base(), scrutins: [S1, unique] });
    expect(avec.scrutins.find((s) => s.n === 4)!.type).toBe('final');
  });
});

describe('construire : entrées de groupe « PO0 » ou inconnues', () => {
  const inconnu = (votants: Votants) => entree('PO0', votants);

  it('rattache une entrée « PO0 » au groupe de ses membres ce jour-là', () => {
    const s = scrutin(5, '2025-02-10', 'x', [
      inconnu({ pour: ['PA1'], contre: ['PA2'] }),
      entree('PO3', { abstention: ['PA3'] }),
    ]);
    const { donnees } = construire({ ...base(), scrutins: [s] });
    // Ana (RN) et Bob (RN depuis le 1er février 2025) : l'entrée est le groupe RN, index 0.
    expect(donnees.scrutins[0].groupes.map((g) => g.g)).toEqual([0, 1]);
    expect(donnees.meta.statistiques.groupesRattaches).toBe(1);
    expect(donnees.votes[0]).toBe('PCA');
    expect(donnees.groupesVotes[0]).toBe('001');
  });

  it("rattache à la majorité des membres quand l'un d'eux est dans un autre groupe", () => {
    // Ana et Bob sont RN le 10 février 2025, Cléo est UDR : 2 sur 3.
    const s = scrutin(5, '2025-02-10', 'x', [
      inconnu({ pour: ['PA1'], contre: ['PA2'], abstention: ['PA3'] }),
    ]);
    const { donnees } = construire({ ...base(), scrutins: [s] });
    expect(donnees.scrutins[0].groupes.map((g) => g.g)).toEqual([0]);
  });

  it('échoue quand les membres ne désignent pas un groupe sans ambiguïté', () => {
    // Le 15 janvier 2025, Ana est RN et Bob SOC : 1 sur 2, pas de majorité.
    const egalite = scrutin(5, '2025-01-15', 'x', [inconnu({ pour: ['PA1', 'PA2'] })]);
    expect(() => construire({ ...base(), scrutins: [egalite] })).toThrow(ErreurDonnees);
    expect(() => construire({ ...base(), scrutins: [egalite] })).toThrow(
      /impossible de rattacher l'entrée « PO0 » \(2 votants\)/,
    );
  });

  it('écarte une entrée « PO0 » sans aucun vote', () => {
    const s = scrutin(5, '2025-02-10', 'x', [entree('PO1', { pour: ['PA1'] }), inconnu({})]);
    const { donnees } = construire({ ...base(), scrutins: [s] });
    expect(donnees.scrutins[0].groupes).toHaveLength(1);
    expect(donnees.meta.statistiques.groupesRattaches).toBe(0);
  });

  it('refuse deux entrées qui désignent le même groupe', () => {
    const s = scrutin(5, '2025-02-10', 'x', [
      entree('PO1', { pour: ['PA1'] }),
      inconnu({ contre: ['PA2'] }),
    ]);
    expect(() => construire({ ...base(), scrutins: [s] })).toThrow(
      /deux entrées pour le groupe PO1/,
    );
  });
});

describe('construire : garde-fous', () => {
  const echoue = (modif: (entree: Entree) => Partial<Entree>, motif: RegExp) => {
    const entree = base();
    expect(() => construire({ ...entree, ...modif(entree) })).toThrow(motif);
  };

  it('échoue sous les seuils du plan (8 000 scrutins, 570 députés)', () => {
    expect(SEUILS_OFFICIELS).toEqual({ scrutins: 8000, deputes: 570 });
    echoue(() => ({ seuils: SEUILS_OFFICIELS }), /3 scrutins lus, au moins 8000 attendus/);
    const nombreux = Array.from({ length: 8000 }, (_, i) => ({ ...S3, numero: i + 1 }));
    echoue(
      () => ({ seuils: SEUILS_OFFICIELS, scrutins: nombreux }),
      /2 députés, au moins 570 attendus/,
    );
  });

  it("échoue quand un votant n'a pas de fiche", () => {
    const s = scrutin(9, '2025-02-10', 'x', [entree('PO1', { pour: ['PA404'] })]);
    echoue(() => ({ scrutins: [s] }), /le votant PA404 n'a pas de fiche/);
  });

  it('échoue sur un sort autre que « adopté » ou « rejeté »', () => {
    echoue(
      () => ({ scrutins: [{ ...S1, sortCode: 'ajourné' }] }),
      /scrutin 1 : sort.code « ajourné »/,
    );
    echoue(() => ({ scrutins: [{ ...S1, sortCode: null }] }), /sort.code « null »/);
  });

  it('échoue quand la somme des groupes ne donne pas le décompte du scrutin (pour, contre, abstention)', () => {
    echoue(
      () => ({ scrutins: [{ ...S1, compte: { ...S1.compte, pour: 2 } }] }),
      /somme des groupes donne 1 « pour », le scrutin en annonce 2/,
    );
    echoue(
      () => ({ scrutins: [{ ...S1, compte: { ...S1.compte, abstention: 0 } }] }),
      /« abstention »/,
    );
  });

  it('échoue quand une liste nominative ne correspond pas à son décompte', () => {
    const faux = entree('PO1', { pour: ['PA1'] });
    faux.compte = { ...faux.compte, pour: 2 };
    const s = scrutin(9, '2025-02-10', 'x', [faux]);
    echoue(() => ({ scrutins: [s] }), /1 « pour » nommés pour un décompte de 2/);
  });

  it("corrige le nombre de non-votants d'un scrutin quand il diffère de la somme des groupes, et le signale", () => {
    const { donnees } = construire({
      ...base(),
      scrutins: [{ ...S1, compte: { ...S1.compte, nonvotant: 10 } }, S2],
    });
    expect(donnees.scrutins.find((s) => s.n === 1)!.compte.nonvotant).toBe(0);
    expect(donnees.meta.statistiques.nonVotantsCorriges).toEqual([1]);
  });

  it(`échoue quand plus de ${MAX_NONVOTANTS_CORRIGES} scrutins ont des non-votants incohérents`, () => {
    const faux = Array.from({ length: MAX_NONVOTANTS_CORRIGES + 1 }, (_, i) => ({
      ...S1,
      numero: i + 10,
      compte: { ...S1.compte, nonvotant: 99 },
    }));
    echoue(() => ({ scrutins: faux }), /plus de 5 scrutins dont les non-votants/);
  });

  it('échoue sur un scrutin ou un acteur en double', () => {
    echoue(() => ({ scrutins: [S1, S1] }), /scrutin 1 présent deux fois/);
    echoue(() => ({ acteurs: [...ACTEURS, ACTEURS[0]] }), /acteur PA2 présent deux fois/);
  });

  it("préfixe les messages pour qu'on les repère dans le journal de build", () => {
    expect(() => construire({ ...base(), scrutins: [] })).toThrow(/^garde-fou : /);
  });
});

describe('construire : meta et fichiers', () => {
  it('écrit les six fichiers, en JSON compact', () => {
    const { fichiers } = construire(base());
    expect(Object.keys(fichiers)).toEqual([
      'meta.json',
      'groupes.json',
      'deputes.json',
      'scrutins.json',
      'votes.txt',
      'groupes-votes.txt',
    ]);
    expect(fichiers['groupes.json']).not.toMatch(/\n/);
    expect(JSON.parse(fichiers['scrutins.json'])).toHaveLength(3);
  });

  it('décrit la génération : date sans millisecondes, effectifs, sources et statistiques', () => {
    const { donnees } = construire(base());
    expect(donnees.meta).toEqual({
      genereLe: '2026-10-19T05:41:02Z',
      scrutins: 3,
      deputes: 4,
      groupes: 4,
      sources: SOURCES,
      statistiques: {
        adoptes: 2,
        rejetes: 1,
        sansDossier: 2,
        misesAuPoint: 0,
        groupesRattaches: 0,
        nonVotantsCorriges: [],
      },
    });
  });

  it('compte les scrutins touchés par une mise au point', () => {
    const { donnees } = construire({ ...base(), scrutins: [{ ...S1, miseAuPoint: true }, S2] });
    expect(donnees.meta.statistiques.misesAuPoint).toBe(1);
  });
});
