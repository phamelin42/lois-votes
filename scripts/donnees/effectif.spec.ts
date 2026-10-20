// @vitest-environment node
import type { Position } from '@contrat';
import type { Donnees } from '../../src/server/donnees.types';
import {
  ErreurDonnees,
  SEUILS_EFFECTIF,
  SEUILS_OFFICIELS,
  construire as construireReel,
  controlerEffectif,
  debutAffiche,
  debutEffectif,
} from './construire.mjs';
import { lireActeur } from './lire.mjs';

/*
 * Effectif en mandat (DONNEES.md, « Effectif en mandat »). Les mandats de député ci-dessous sont de VRAIS fragments de
 * l'archive des acteurs du 20/10/2026 : un remplaçant y a pour `dateDebut` l'élection générale (2024-07-07) et pour
 * `mandature.datePriseFonction` le jour de son arrivée. Lus par `lireActeur`, puis réduits par `construire`.
 */

type Votants = Partial<Record<Position, string[]>>;

const construire = (entree: object): { donnees: Donnees; fichiers: Record<string, string> } =>
  construireReel(entree as never) as never;

const SOURCES = {
  scrutins: { url: 'scrutins.zip', lastModified: null, etag: null },
  acteurs: { url: 'acteurs.zip', lastModified: null, etag: null },
};
const SEUILS_BAS = { scrutins: 1, deputes: 1 };

const MOSELLE = { departement: 'Moselle', numDepartement: '57', numCirco: '4' };

/** Un mandat `ASSEMBLEE` tel que l'archive le donne (seuls les champs utiles sont gardés, avec leurs vraies valeurs). */
const mandatBrut = (
  uid: string,
  pa: string,
  dateDebut: string,
  dateFin: string | null,
  datePriseFonction: string,
  plus: { causeMandat?: string; causeFin?: string | null; mandatRemplaceRef?: string | null } = {},
) => ({
  uid,
  acteurRef: pa,
  legislature: '17',
  typeOrgane: 'ASSEMBLEE',
  dateDebut,
  dateFin,
  organes: { organeRef: 'PO838901' },
  election: {
    lieu: MOSELLE,
    causeMandat: plus.causeMandat ?? 'élections générales',
  },
  mandature: {
    datePriseFonction,
    causeFin: plus.causeFin ?? null,
    mandatRemplaceRef: plus.mandatRemplaceRef ?? null,
  },
});

const mandatGpBrut = (organe: string, dateDebut: string, dateFin: string | null = null) => ({
  uid: `PM-GP-${organe}-${dateDebut}`,
  legislature: '17',
  typeOrgane: 'GP',
  dateDebut,
  dateFin,
  organes: { organeRef: organe },
});

const acteurBrut = (pa: string, prenom: string, nom: string, mandats: unknown[]) =>
  lireActeur({
    acteur: {
      uid: { '@xsi:type': 'IdActeur_type', '#text': pa },
      etatCivil: { ident: { prenom, nom } },
      mandats: { mandat: mandats },
    },
  });

const INCOMPATIBILITE =
  'Démission pour cause d’incompatibilité prévue aux articles LO 137, LO 137-1, LO 141 ou LO 141-1 du code électoral';

// Cas 1, la démission d'un titulaire : Fabien Di Filippo (Moselle 4) démissionne le 2026-04-20 ; son remplaçant,
// Jérôme End, entre en fonction le 2026-04-21 (sa `dateDebut` reste celle de l'élection de 2024).
const DI_FILIPPO = acteurBrut('PA720386', 'Fabien', 'Di Filippo', [
  mandatBrut('PM843020', 'PA720386', '2024-07-07', '2026-04-20', '2024-07-08', {
    causeFin: INCOMPATIBILITE,
  }),
  mandatGpBrut('PO1', '2024-07-19'),
]);
const END = acteurBrut('PA720390', 'Jérôme', 'End', [
  mandatBrut('PM881119', 'PA720390', '2024-07-07', null, '2026-04-21', {
    causeMandat: `remplacement d'un député ayant démissionné pour cause d’incompatibilité prévue aux articles LO 137, LO 137-1, LO 141 ou LO 141-1 du code électoral`,
  }),
  mandatGpBrut('PO1', '2026-04-21'),
]);

// Cas 2, deux suspensions du même titulaire par le même remplaçant : Paul Christophe (ministre du 2024-10-22 au
// 2025-01-23, puis démission le 2026-04-06), Pierre Marle le remplace (2024-10-22 → 2025-01-23, puis dès le 2026-04-07).
// Chaque retour de Christophe est un nouveau mandat dont `mandatRemplaceRef` désigne l'ancien.
const CHRISTOPHE = acteurBrut('PA642868', 'Paul', 'Christophe', [
  mandatBrut('PM843122', 'PA642868', '2024-07-07', '2024-10-21', '2024-07-08', {
    causeFin: 'Nomination comme membre du Gouvernement',
  }),
  mandatBrut('PM858305', 'PA642868', '2024-07-07', '2026-04-06', '2025-01-24', {
    causeMandat: "reprise de l'exercice du mandat d'un ancien membre du Gouvernement",
    causeFin: INCOMPATIBILITE,
    mandatRemplaceRef: 'PM843122',
  }),
  mandatGpBrut('PO1', '2024-07-19'),
]);
const MARLE = acteurBrut('PA794518', 'Pierre', 'Marle', [
  mandatBrut('PM849133', 'PA794518', '2024-07-07', '2025-01-23', '2024-10-22', {
    causeMandat: "remplacement d'un député nommé au Gouvernement",
    causeFin: "Reprise de l'exercice du mandat d'un ancien membre du Gouvernement",
  }),
  mandatBrut('PM880221', 'PA794518', '2024-07-07', null, '2026-04-07', {
    causeMandat: `remplacement d'un député ayant démissionné pour cause d’incompatibilité prévue aux articles LO 137, LO 137-1, LO 141 ou LO 141-1 du code électoral`,
    mandatRemplaceRef: 'PM849133',
  }),
  mandatGpBrut('PO1', '2024-10-23'),
]);

// Cas 3, un décès : Béatrice Bellamy (Vendée 2) meurt le 2026-05-24 ; Dominique Paillat siège dès le 2026-05-25.
const BELLAMY = acteurBrut('PA795278', 'Béatrice', 'Bellamy', [
  mandatBrut('PM843539', 'PA795278', '2024-07-07', '2026-05-24', '2024-07-08', {
    causeFin: 'Décès',
  }),
  mandatGpBrut('PO1', '2024-07-19', '2026-05-23'),
]);
const PAILLAT = acteurBrut('PA841993', 'Dominique', 'Paillat', [
  mandatBrut('PM882351', 'PA841993', '2024-07-07', null, '2026-05-25', {
    causeMandat: "remplacement d'un député décédé",
  }),
  mandatGpBrut('PO1', '2026-05-26'),
]);

// Un député sans suppléant ni interruption : élu le 2024-06-30, en fonction le lendemain.
const ANA = acteurBrut('PA1', 'Ana', 'Martin', [
  mandatBrut('PM1', 'PA1', '2024-06-30', null, '2024-07-01'),
  mandatGpBrut('PO1', '2024-07-19'),
]);

const ORGANES = [
  {
    id: 'PO1',
    codeType: 'GP',
    legislature: '17',
    abrege: 'RN',
    libelle: 'Rassemblement National',
    couleur: '#313567',
    debut: '2024-07-18',
    fin: null,
    preseance: 1,
  },
];

const compter = (v: Votants) => ({
  pour: v.pour?.length ?? 0,
  contre: v.contre?.length ?? 0,
  abstention: v.abstention?.length ?? 0,
  nonvotant: v.nonvotant?.length ?? 0,
});

/** Un scrutin du groupe RN daté du jour voulu, avec `nombreMembres` (l'effectif officiel annoncé). */
const scrutin = (numero: number, date: string, votants: Votants, nombreMembres = 10) => {
  const compte = compter(votants);
  return {
    numero,
    date,
    titre: `l'amendement n° ${numero} de M. Untel à l'article premier du projet de loi relatif à X (première lecture).`,
    codeTypeVote: 'SPO',
    sortCode: 'adopté',
    dossier: null,
    compte,
    miseAuPoint: false,
    groupes: [
      {
        organeRef: 'PO1',
        nombreMembres,
        positionOfficielle: 'pour',
        compte,
        votants: { pour: [], contre: [], abstention: [], nonvotant: [], ...votants },
      },
    ],
  };
};

const entree = (acteurs: unknown[], scrutins: unknown[], seuils: object = SEUILS_BAS) => ({
  scrutins,
  acteurs,
  organes: ORGANES,
  sources: SOURCES,
  seuils,
  maintenant: new Date('2026-10-20T05:41:02.123Z'),
});

/** La case de la matrice `votes.txt` d'un député pour un scrutin (`P`, `C`, `A`, `N`, `X` ou `-`). */
const cellule = (donnees: Donnees, pa: string, numero: number) => {
  const ligne = donnees.scrutins.findIndex((s) => s.n === numero);
  const colonne = donnees.deputes.findIndex((d) => d.pa === pa);
  expect(ligne, `scrutin ${numero}`).toBeGreaterThanOrEqual(0);
  expect(colonne, `député ${pa}`).toBeGreaterThanOrEqual(0);
  return donnees.votes[ligne][colonne];
};

describe('debutEffectif et debutAffiche', () => {
  it("prend la prise de fonction d'un remplaçant, et la date de début d'un élu", () => {
    const elu = { debut: '2024-06-30', priseFonction: '2024-07-01' };
    const remplacant = { debut: '2024-07-07', priseFonction: '2026-04-21' };
    expect(debutEffectif(elu)).toBe('2024-07-01');
    expect(debutEffectif(remplacant)).toBe('2026-04-21');
    // Sur la fiche, l'élu garde la date de son élection ; le remplaçant montre son arrivée.
    expect(debutAffiche(elu)).toBe('2024-06-30');
    expect(debutAffiche(remplacant)).toBe('2026-04-21');
  });

  it("retombe sur la date de début quand l'archive ne donne pas la prise de fonction, ou qu'elle la précède", () => {
    expect(debutEffectif({ debut: '2024-07-07', priseFonction: null })).toBe('2024-07-07');
    expect(debutEffectif({ debut: '2024-07-07' })).toBe('2024-07-07');
    expect(debutEffectif({ debut: '2024-07-07', priseFonction: '2024-07-01' })).toBe('2024-07-07');
    expect(debutAffiche({ debut: '2024-07-07', priseFonction: null })).toBe('2024-07-07');
    // Le lendemain exact de l'élection (un élu) n'est pas une arrivée tardive.
    expect(debutAffiche({ debut: '2024-07-07', priseFonction: '2024-07-08' })).toBe('2024-07-07');
    expect(debutAffiche({ debut: '2024-07-07', priseFonction: '2024-07-09' })).toBe('2024-07-09');
  });
});

describe('lireActeur : prise de fonction', () => {
  it('lit `mandature.datePriseFonction` de chaque mandat de député', () => {
    expect(END.mandats.find((m) => m.type === 'ASSEMBLEE')).toMatchObject({
      uid: 'PM881119',
      debut: '2024-07-07',
      fin: null,
      priseFonction: '2026-04-21',
    });
    expect(
      CHRISTOPHE.mandats.filter((m) => m.type === 'ASSEMBLEE').map((m) => m.priseFonction),
    ).toEqual(['2024-07-08', '2025-01-24']);
  });
});

describe('construire : effectif en mandat des remplaçants', () => {
  it("un remplaçant n'est pas en mandat avant sa prise de fonction (Di Filippo et End)", () => {
    const { donnees } = construire(
      entree(
        [ANA, DI_FILIPPO, END],
        [
          scrutin(1, '2026-04-16', { pour: ['PA1', 'PA720386'] }),
          scrutin(2, '2026-04-21', { pour: ['PA1', 'PA720390'] }),
          scrutin(3, '2026-07-06', { pour: ['PA1'] }),
        ],
      ),
    );
    // Avant : le titulaire siège, son remplaçant n'est pas en mandat (avant la correction : `X`, et sa participation s'écroulait).
    expect(cellule(donnees, 'PA720386', 1)).toBe('P');
    expect(cellule(donnees, 'PA720390', 1)).toBe('-');
    // Le jour même de l'arrivée du remplaçant, le titulaire n'est plus en mandat.
    expect(cellule(donnees, 'PA720386', 2)).toBe('-');
    expect(cellule(donnees, 'PA720390', 2)).toBe('P');
    // Après : le remplaçant est en mandat, absent du scrutin (`X`), le titulaire a quitté l'Assemblée.
    expect(cellule(donnees, 'PA720386', 3)).toBe('-');
    expect(cellule(donnees, 'PA720390', 3)).toBe('X');
  });

  it("le jour du remplacement : bornes incluses, un seul des deux en mandat quand l'archive les enchaîne", () => {
    // Di Filippo : dernier jour 2026-04-20 (inclus) ; End : premier jour 2026-04-21 (inclus). Aucun chevauchement.
    const { donnees } = construire(
      entree(
        [ANA, DI_FILIPPO, END],
        [
          scrutin(1, '2026-04-20', { pour: ['PA1'] }),
          scrutin(2, '2026-04-21', { pour: ['PA1'] }),
          // Pour que les deux soient des députés du jeu (ils figurent dans au moins une liste).
          scrutin(3, '2026-04-16', { pour: ['PA720386'] }),
          scrutin(4, '2026-07-06', { pour: ['PA720390'] }),
        ],
      ),
    );
    expect([cellule(donnees, 'PA720386', 1), cellule(donnees, 'PA720390', 1)]).toEqual(['X', '-']);
    expect([cellule(donnees, 'PA720386', 2), cellule(donnees, 'PA720390', 2)]).toEqual(['-', 'X']);
  });

  it('si titulaire et remplaçant se chevauchaient un jour, les deux seraient en mandat : chaque mandat est jugé seul', () => {
    const titulaire = acteurBrut('PA10', 'Tit', 'Ulaire', [
      mandatBrut('PM10', 'PA10', '2024-07-07', '2026-04-21', '2024-07-08'),
      mandatGpBrut('PO1', '2024-07-19'),
    ]);
    const remplacant = acteurBrut('PA11', 'Rem', 'Plaçant', [
      mandatBrut('PM11', 'PA11', '2024-07-07', null, '2026-04-21'),
      mandatGpBrut('PO1', '2024-07-19'),
    ]);
    const { donnees } = construire(
      entree(
        [ANA, titulaire, remplacant],
        [
          scrutin(1, '2026-04-21', { pour: ['PA1'] }),
          scrutin(2, '2026-04-01', { pour: ['PA10'] }),
          scrutin(3, '2026-05-01', { pour: ['PA11'] }),
        ],
      ),
    );
    expect([cellule(donnees, 'PA10', 1), cellule(donnees, 'PA11', 1)]).toEqual(['X', 'X']);
  });

  it('plusieurs suspensions du même titulaire par le même remplaçant (Christophe et Marle)', () => {
    const jours: [number, string, string, string][] = [
      // [scrutin, date, case de Christophe, case de Marle]
      [1, '2024-10-21', 'X', '-'], // dernier jour de Christophe avant sa nomination au gouvernement
      [2, '2024-10-22', '-', 'X'], // Marle le remplace
      [3, '2025-01-23', '-', 'X'], // dernier jour de Marle
      [4, '2025-01-24', 'X', '-'], // Christophe reprend son mandat
      [5, '2026-04-06', 'X', '-'], // dernier jour de Christophe (démission)
      [6, '2026-04-07', '-', 'X'], // Marle revient, et reste
      [7, '2026-10-19', '-', 'X'],
    ];
    const { donnees } = construire(
      entree(
        [ANA, CHRISTOPHE, MARLE],
        [
          ...jours.map(([n, date]) => scrutin(n, date, { pour: ['PA1'] })),
          // Pour que les deux soient des députés du jeu (ils figurent dans au moins une liste).
          scrutin(101, '2024-10-21', { pour: ['PA642868'] }),
          scrutin(102, '2025-01-23', { pour: ['PA794518'] }),
        ],
      ),
    );
    for (const [n, , christophe, marle] of jours) {
      expect(
        [cellule(donnees, 'PA642868', n), cellule(donnees, 'PA794518', n)],
        `scrutin ${n}`,
      ).toEqual([christophe, marle]);
    }
  });

  it('un seul des deux est en mandat chaque jour, donc `enMandat` ne double pas le siège', () => {
    const { donnees } = construire(
      entree(
        [ANA, CHRISTOPHE, MARLE],
        [
          scrutin(1, '2024-12-02', { pour: ['PA1'] }),
          scrutin(2, '2025-06-02', { pour: ['PA1'] }),
          scrutin(3, '2026-06-02', { pour: ['PA1'] }),
          scrutin(101, '2024-10-21', { pour: ['PA642868'] }),
          scrutin(102, '2025-01-23', { pour: ['PA794518'] }),
        ],
      ),
    );
    for (const numero of [1, 2, 3]) {
      const ligne = donnees.votes[donnees.scrutins.findIndex((s) => s.n === numero)];
      // Ana + exactement un des deux occupants du siège.
      expect(
        [...ligne].filter((c) => c !== '-'),
        `scrutin ${numero}`,
      ).toHaveLength(2);
    }
  });

  it('un décès : le remplaçant siège le lendemain (Bellamy et Paillat)', () => {
    const { donnees } = construire(
      entree(
        [ANA, BELLAMY, PAILLAT],
        [
          scrutin(1, '2026-05-24', { pour: ['PA1', 'PA795278'] }),
          scrutin(2, '2026-05-26', { pour: ['PA1', 'PA841993'] }),
        ],
      ),
    );
    expect([cellule(donnees, 'PA795278', 1), cellule(donnees, 'PA841993', 1)]).toEqual(['P', '-']);
    expect([cellule(donnees, 'PA795278', 2), cellule(donnees, 'PA841993', 2)]).toEqual(['-', 'P']);
  });

  it("un mandat sans suppléant ni interruption compte dès la prise de fonction, et jusqu'à la fin", () => {
    const { donnees } = construire(
      entree([ANA], [scrutin(1, '2024-10-08', { pour: ['PA1'] }), scrutin(2, '2026-10-19', {})]),
    );
    expect(cellule(donnees, 'PA1', 1)).toBe('P');
    expect(cellule(donnees, 'PA1', 2)).toBe('X');
  });

  it('garde un vote listé même hors de la période calculée (jamais effacé)', () => {
    // Marle n'est pas « en mandat » le 2025-06-02 (Christophe siège), mais s'il figurait dans une liste, son vote reste.
    const { donnees } = construire(
      entree([ANA, CHRISTOPHE, MARLE], [scrutin(1, '2025-06-02', { pour: ['PA1', 'PA794518'] })]),
    );
    expect(cellule(donnees, 'PA794518', 1)).toBe('P');
  });

  it("sans `datePriseFonction` dans l'archive, retombe sur `dateDebut` (c'est ce que le garde-fou de l'effectif détecte)", () => {
    const sansPrise = acteurBrut('PA720390', 'Jérôme', 'End', [
      { ...mandatBrut('PM881119', 'PA720390', '2024-07-07', null, '2026-04-21'), mandature: null },
      mandatGpBrut('PO1', '2026-04-21'),
    ]);
    const { donnees } = construire(
      entree(
        [ANA, sansPrise],
        [
          scrutin(1, '2026-04-16', { pour: ['PA1'] }),
          scrutin(2, '2026-07-06', { pour: ['PA720390'] }),
        ],
      ),
    );
    expect(cellule(donnees, 'PA720390', 1)).toBe('X');
  });
});

describe("construire : fiche d'un remplaçant", () => {
  it("`mandat.depuis` est la prise de fonction du remplaçant, et la date d'élection d'un élu", () => {
    const { donnees } = construire(
      entree(
        [ANA, END, MARLE, CHRISTOPHE],
        [scrutin(1, '2026-10-19', { pour: ['PA1', 'PA720390', 'PA794518', 'PA642868'] })],
      ),
    );
    const mandat = (pa: string) => donnees.deputes.find((d) => d.pa === pa)?.mandat;
    expect(mandat('PA1')).toMatchObject({ depuis: '2024-06-30', fin: null });
    expect(mandat('PA720390')).toMatchObject({ depuis: '2026-04-21', fin: null });
    // Le mandat en cours est le plus récent : le second de Marle, ouvert depuis le 2026-04-07.
    expect(mandat('PA794518')).toMatchObject({ depuis: '2026-04-07', fin: null });
    // Christophe a démissionné : son dernier mandat, celui d'après son retour, se termine le 2026-04-06.
    expect(mandat('PA642868')).toMatchObject({ depuis: '2025-01-24', fin: '2026-04-06' });
  });
});

describe('controlerEffectif', () => {
  const s = (numero: number, enMandat: number, officiel: number) => ({
    numero,
    enMandat,
    officiel,
  });

  it("mesure l'écart de chaque scrutin et ne signale rien quand il reste dans la tolérance", () => {
    const resultat = controlerEffectif(
      [s(1, 577, 577), s(2, 577, 576), s(3, 575, 576), s(4, 574, 577)],
      SEUILS_EFFECTIF,
    );
    expect(resultat).toEqual({
      ecartMax: 3,
      repartition: { '-3': 1, '-1': 1, '0': 1, '1': 1 },
      horsTolerance: [],
    });
  });

  it('liste les scrutins hors tolérance sans échouer : un écart modéré est un avertissement', () => {
    const resultat = controlerEffectif(
      [s(10, 580, 577), s(11, 581, 577), s(12, 590, 577), s(13, 577, 577), s(14, 570, 577)],
      SEUILS_EFFECTIF,
    );
    expect(resultat.horsTolerance).toEqual([11, 12, 14]);
    expect(resultat.ecartMax).toBe(13);
  });

  it("échoue quand plus de 1 % des scrutins ont plus de 20 députés d'écart", () => {
    const scrutins = Array.from({ length: 200 }, (_, i) => s(i + 1, i < 3 ? 610 : 577, 577));
    expect(() => controlerEffectif(scrutins, SEUILS_EFFECTIF)).toThrow(ErreurDonnees);
    expect(() => controlerEffectif(scrutins, SEUILS_EFFECTIF)).toThrow(
      /3 scrutins sur 200 ont plus de 20 députés d'écart.*scrutin 1, 610 en mandat pour 577 officiels/,
    );
  });

  it("n'échoue pas pour quelques scrutins grossiers isolés (1 % au plus) : la mise à jour nocturne continue", () => {
    const scrutins = Array.from({ length: 200 }, (_, i) => s(i + 1, i < 2 ? 610 : 577, 577));
    const resultat = controlerEffectif(scrutins, SEUILS_EFFECTIF);
    expect(resultat.horsTolerance).toEqual([1, 2]);
  });

  it("reproduit le défaut corrigé : des dates de début lues telles quelles donnent 30 à 65 de trop partout, et l'échec", () => {
    // Écarts réels de l'archive du 20/10/2026 avant la correction (extraits : 34, 52, 53, 62, 63, 65).
    const ecarts = [34, 34, 34, 52, 53, 53, 62, 63, 65, 35, 10, 11, 9, 24, 48];
    const scrutins = ecarts.map((e, i) => s(i + 1, 577 + e, 577));
    expect(() => controlerEffectif(scrutins, SEUILS_EFFECTIF)).toThrow(/dates de mandat/);
  });

  it('accepte une liste vide', () => {
    expect(controlerEffectif([], SEUILS_EFFECTIF)).toEqual({
      ecartMax: 0,
      repartition: {},
      horsTolerance: [],
    });
  });
});

describe("construire : garde-fou de l'effectif", () => {
  const seuils = { ...SEUILS_BAS, effectif: SEUILS_EFFECTIF };

  it('mesure `enMandat` contre la somme des `nombreMembres`, et le range dans meta.statistiques', () => {
    // Ana et Di Filippo en mandat le 2026-04-16 : 2 en mandat pour un effectif officiel de 2.
    const { donnees } = construire(
      entree(
        [ANA, DI_FILIPPO, END],
        [
          scrutin(1, '2026-04-16', { pour: ['PA1', 'PA720386'] }, 2),
          scrutin(2, '2026-04-21', { pour: ['PA1', 'PA720390'] }, 2),
        ],
        seuils,
      ),
    );
    expect(donnees.meta.statistiques.effectif).toEqual({
      ecartMax: 0,
      repartition: { '0': 2 },
      horsTolerance: [],
    });
    expect(donnees.meta.avertissements).toEqual([]);
  });

  it('un écart modéré est un avertissement dans meta.avertissements, jamais un échec', () => {
    const { donnees } = construire(
      entree(
        [ANA, DI_FILIPPO],
        [scrutin(1, '2026-04-16', { pour: ['PA1', 'PA720386'] }, 12)],
        seuils,
      ),
    );
    expect(donnees.meta.statistiques.effectif).toMatchObject({ ecartMax: 10, horsTolerance: [1] });
    expect(donnees.meta.avertissements).toEqual(['effectif']);
  });

  it("garde l'avertissement Wikidata en plus de l'avertissement d'effectif", () => {
    const { donnees } = construire({
      ...entree([ANA], [scrutin(1, '2026-04-16', { pour: ['PA1'] }, 20)], seuils),
      avertissements: ['wikipedia'],
    });
    expect(donnees.meta.avertissements).toEqual(['wikipedia', 'effectif']);
  });

  it('échoue quand la plupart des scrutins ont plus de 20 députés de trop (dates de mandat lues telles quelles)', () => {
    expect(() =>
      construire(entree([ANA], [scrutin(1, '2026-04-16', { pour: ['PA1'] }, 40)], seuils)),
    ).toThrow(/garde-fou : effectif : 1 scrutins sur 1 ont plus de 20 députés d'écart/);
  });

  it("n'est pas appliqué sans seuil `effectif` (fixtures : liste de députés réduite)", () => {
    const { donnees } = construire(
      entree([ANA], [scrutin(1, '2026-04-16', { pour: ['PA1'] }, 577)], SEUILS_BAS),
    );
    expect(donnees.meta.statistiques.effectif).toBeNull();
    expect(donnees.meta.avertissements).toEqual([]);
  });

  it('est appliqué aux seuils officiels', () => {
    expect(SEUILS_OFFICIELS).toEqual({
      scrutins: 8000,
      deputes: 570,
      effectif: { tolerance: 3, grossier: 20, partGrossiere: 0.01 },
    });
  });
});
