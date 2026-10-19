// @vitest-environment node
import type { Donnees } from '../../src/server/donnees.types';
import {
  construire as construireReel,
  couverture,
  fonctionsEnCours,
  legislaturesDeDepute,
  periodesDeGroupe,
} from './construire.mjs';

// La fiche d'un député : état civil, mandats, historique de groupes, fonctions, parti et liens externes.

const construire = (entree: Record<string, unknown>): Donnees =>
  (construireReel(entree as never) as unknown as { donnees: Donnees }).donnees;

const organe = (
  id: string,
  codeType: string,
  libelle: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  codeType,
  legislature: '17',
  abrege: libelle,
  libelle,
  couleur: '#123456',
  debut: '2024-07-18',
  fin: null,
  preseance: 1,
  ...extra,
});
const RN = organe('PO1', 'GP', 'Rassemblement National', { abrege: 'RN', preseance: 1 });
const NI = organe('PO5', 'GP', 'Non inscrit', { abrege: 'NI', preseance: 99, debut: '2024-07-01' });
const AD = organe('PO6', 'GP', 'À Droite', {
  abrege: 'AD',
  debut: '2024-07-18',
  fin: '2024-09-11',
});
const BUREAU = organe('PO10', 'BUREAU', "Bureau de l'Assemblée nationale");
const AFFAIRES_ETRANGERES = organe('PO11', 'COMPER', 'Commission des affaires étrangères');
const FINANCES = organe('PO12', 'COMPER', 'Commission des finances');
const PARTI = organe('PO20', 'PARPOL', 'Rassemblement national', { legislature: null });
const PARTI_ANCIEN = organe('PO21', 'PARPOL', 'Front National', { legislature: null });
const ORGANES = [RN, NI, AD, BUREAU, AFFAIRES_ETRANGERES, FINANCES, PARTI, PARTI_ANCIEN];

const mandat = (
  type: string,
  organeRef: string | null,
  debut: string,
  fin: string | null = null,
  plus: Record<string, unknown> = {},
) => ({
  uid: `PM-${type}-${organeRef}-${debut}-${plus['qualite'] ?? ''}`,
  type,
  legislature: '17',
  debut,
  fin,
  organe: organeRef,
  qualite: null,
  lieu: null,
  ...plus,
});
const assemblee = (debut: string, fin: string | null = null, legislature = '17') =>
  mandat('ASSEMBLEE', 'PO838901', debut, fin, {
    legislature,
    lieu: { departement: 'Nord', numDepartement: '59', numCirco: '19' },
  });

const acteur = (pa: string, mandats: unknown[], plus: Record<string, unknown> = {}) => ({
  pa,
  prenom: 'Ana',
  nom: `Nom${pa}`,
  naissance: null,
  deces: null,
  profession: null,
  hatvp: null,
  liens: { siteWeb: null, x: null, facebook: null },
  mandats,
  ...plus,
});

const votant = (pa: string) => ({
  organeRef: 'PO1',
  nombreMembres: 10,
  positionOfficielle: 'pour' as const,
  compte: { pour: 1, contre: 0, abstention: 0, nonvotant: 0 },
  votants: { pour: [pa], contre: [], abstention: [], nonvotant: [] },
});
const scrutinDe = (pas: string[]) => ({
  numero: 1,
  date: '2025-02-10',
  titre: "l'ensemble du projet de loi relatif à X (première lecture).",
  codeTypeVote: 'SPO',
  sortCode: 'adopté',
  dossier: null,
  compte: { pour: pas.length, contre: 0, abstention: 0, nonvotant: 0 },
  miseAuPoint: false,
  groupes: [
    {
      ...votant(pas[0]),
      compte: { pour: pas.length, contre: 0, abstention: 0, nonvotant: 0 },
      votants: { pour: pas, contre: [], abstention: [], nonvotant: [] },
    },
  ],
});

function fabriquer(acteurs: unknown[], plus: Record<string, unknown> = {}) {
  const pas = (acteurs as { pa: string }[]).map((a) => a.pa);
  return construire({
    scrutins: [scrutinDe(pas)],
    acteurs,
    organes: ORGANES,
    sources: { scrutins: {}, acteurs: {} },
    seuils: { scrutins: 1, deputes: 1 },
    maintenant: new Date('2026-10-19T05:41:02Z'),
    ...plus,
  });
}
const premier = (acteurs: unknown[], plus: Record<string, unknown> = {}) =>
  fabriquer(acteurs, plus).deputes[0];

describe('construire : fiche, état civil et liens', () => {
  const ana = () =>
    acteur('PA720468', [assemblee('2024-06-30')], {
      naissance: { date: '1973-04-13', lieu: 'Beauvais' },
      profession: 'Conseiller en communication',
      hatvp: 'https://www.hatvp.fr/pages_nominatives/chenu-sebastien',
      liens: { siteWeb: null, x: 'https://x.com/sebchenu', facebook: null },
    });

  it("recopie la naissance, la profession, l'adresse HATVP, le site, X et Facebook de la fiche", () => {
    const depute = premier([ana()]);

    expect(depute.naissance).toEqual({ date: '1973-04-13', lieu: 'Beauvais' });
    expect(depute.deces).toBeNull();
    expect(depute.profession).toBe('Conseiller en communication');
    expect(depute.liens).toEqual({
      hatvp: 'https://www.hatvp.fr/pages_nominatives/chenu-sebastien',
      wikipedia: null,
      siteWeb: null,
      x: 'https://x.com/sebchenu',
      facebook: null,
    });
  });

  it("n'invente rien : sans information, tout est null", () => {
    const depute = premier([acteur('PA1', [assemblee('2024-06-30')])]);

    expect(depute).toMatchObject({
      naissance: null,
      deces: null,
      profession: null,
      parti: null,
      fonctions: [],
      liens: { hatvp: null, wikipedia: null, siteWeb: null, x: null, facebook: null },
    });
  });

  it('retrouve la page Wikipédia par le numéro de PA sans préfixe', () => {
    const wikipedia = new Map([['720468', 'https://fr.wikipedia.org/wiki/S%C3%A9bastien_Chenu']]);

    expect(premier([ana()], { wikipedia }).liens.wikipedia).toBe(
      'https://fr.wikipedia.org/wiki/S%C3%A9bastien_Chenu',
    );
  });

  it('laisse le lien Wikipédia à null pour un député absent de Wikidata, ou quand Wikidata est indisponible', () => {
    expect(
      premier([ana()], { wikipedia: new Map([['1', 'https://fr.wikipedia.org/wiki/X']]) }).liens
        .wikipedia,
    ).toBeNull();
    expect(premier([ana()], { wikipedia: null }).liens.wikipedia).toBeNull();
  });

  it('recopie les avertissements (Wikidata indisponible) dans meta.json, et la couverture', () => {
    const donnees = fabriquer([ana()], { wikipedia: null, avertissements: ['wikipedia'] });

    expect(donnees.meta.avertissements).toEqual(['wikipedia']);
    expect(donnees.meta.statistiques.couverture.tous).toMatchObject({
      deputes: 1,
      wikipedia: 0,
      hatvp: 1,
      profession: 1,
      naissance: 1,
      x: 1,
    });
  });

  it('garde la date de décès', () => {
    expect(premier([acteur('PA1', [assemblee('2024-06-30')], { deces: '2025-07-07' })]).deces).toBe(
      '2025-07-07',
    );
  });
});

describe('construire : mandat de député', () => {
  it('donne le début du mandat en cours, et les législatures où il ou elle a été député', () => {
    const depute = premier([
      acteur('PA1', [
        assemblee('2017-06-18', '2022-06-21', '15'),
        assemblee('2022-06-19', '2024-06-09', '16'),
        assemblee('2024-06-30', null, '17'),
        mandat('GP', 'PO1', '2024-07-19'),
      ]),
    ]);

    expect(depute.mandat).toEqual({ depuis: '2024-06-30', fin: null, legislatures: [15, 16, 17] });
    expect(depute.actif).toBe(true);
  });

  it('prend le mandat en cours quand un membre du gouvernement a retrouvé son siège', () => {
    const depute = premier([
      acteur('PA1', [assemblee('2024-06-30', '2024-10-21'), assemblee('2025-01-05')]),
    ]);

    expect(depute.mandat).toEqual({ depuis: '2025-01-05', fin: null, legislatures: [17] });
  });

  it('donne le dernier mandat et sa fin pour un ancien député', () => {
    const depute = premier([acteur('PA1', [assemblee('2024-06-30', '2026-01-10')])]);

    expect(depute.mandat).toEqual({ depuis: '2024-06-30', fin: '2026-01-10', legislatures: [17] });
    expect(depute.actif).toBe(false);
  });

  it('est null sans mandat de député', () => {
    expect(premier([acteur('PA1', [])]).mandat).toBeNull();
  });
});

describe('periodesDeGroupe', () => {
  const gp = (organeRef: string | null, debut: string, fin: string | null = null) =>
    mandat('GP', organeRef, debut, fin);

  it('range les périodes de la plus ancienne à la plus récente', () => {
    expect(
      periodesDeGroupe([gp('PO1', '2024-07-19'), gp('PO5', '2024-07-01', '2024-07-18')] as never),
    ).toEqual([
      { id: 'PO5', debut: '2024-07-01', fin: '2024-07-18' },
      { id: 'PO1', debut: '2024-07-19', fin: null },
    ]);
  });

  it('écarte les mandats en double (même groupe, mêmes dates)', () => {
    expect(
      periodesDeGroupe([
        gp('PO1', '2024-07-19', '2025-03-31'),
        gp('PO1', '2024-07-19', '2025-03-31'),
      ] as never),
    ).toEqual([{ id: 'PO1', debut: '2024-07-19', fin: '2025-03-31' }]);
  });

  it('fusionne les périodes qui se suivent dans un même groupe, ouvertes ou fermées', () => {
    expect(
      periodesDeGroupe([gp('PO5', '2024-07-08', '2024-07-18'), gp('PO5', '2024-07-19')] as never),
    ).toEqual([{ id: 'PO5', debut: '2024-07-08', fin: null }]);
    expect(
      periodesDeGroupe([
        gp('PO5', '2024-07-08', '2024-07-18'),
        gp('PO5', '2024-07-19', '2024-09-01'),
      ] as never),
    ).toEqual([{ id: 'PO5', debut: '2024-07-08', fin: '2024-09-01' }]);
  });

  it('ne fusionne pas deux périodes séparées par un trou, ni deux groupes différents', () => {
    expect(
      periodesDeGroupe([
        gp('PO1', '2024-07-19', '2024-10-01'),
        gp('PO1', '2024-12-01'),
        gp('PO5', '2024-10-02', '2024-11-30'),
      ] as never),
    ).toEqual([
      { id: 'PO1', debut: '2024-07-19', fin: '2024-10-01' },
      { id: 'PO5', debut: '2024-10-02', fin: '2024-11-30' },
      { id: 'PO1', debut: '2024-12-01', fin: null },
    ]);
  });

  it('ignore un mandat sans organe', () => {
    expect(periodesDeGroupe([gp(null, '2024-07-19')] as never)).toEqual([]);
  });
});

describe('construire : historique de groupes', () => {
  it('donne les groupes du député dans la législature, du plus ancien au plus récent', () => {
    const depute = premier([
      acteur('PA1', [
        assemblee('2024-06-30'),
        mandat('GP', 'PO1', '2024-07-19'),
        mandat('GP', 'PO5', '2024-07-01', '2024-07-18'),
      ]),
    ]);

    expect(depute.groupes).toEqual([
      { id: 'PO5', debut: '2024-07-01', fin: '2024-07-18' },
      { id: 'PO1', debut: '2024-07-19', fin: null },
    ]);
  });

  it("garde un groupe qu'aucun scrutin ne liste (AD) et le décrit dans meta.autresGroupes", () => {
    const donnees = fabriquer([
      acteur('PA1', [
        assemblee('2024-06-30'),
        mandat('GP', 'PO5', '2024-07-08', '2024-07-18'),
        mandat('GP', 'PO6', '2024-07-19', '2024-09-11'),
        mandat('GP', 'PO1', '2024-09-12'),
      ]),
    ]);

    expect(donnees.deputes[0].groupes.map((g) => g.id)).toEqual(['PO5', 'PO6', 'PO1']);
    // Seul « RN » est listé par le scrutin : les deux autres n'ont pas d'index dans les matrices.
    expect(donnees.groupes.map((g) => g.id)).toEqual(['PO1']);
    expect(donnees.meta.autresGroupes).toEqual([
      {
        id: 'PO5',
        abrege: 'NI',
        libelle: 'Non inscrit',
        couleur: '#123456',
        debut: '2024-07-01',
        fin: null,
      },
      {
        id: 'PO6',
        abrege: 'AD',
        libelle: 'À Droite',
        couleur: '#123456',
        debut: '2024-07-18',
        fin: '2024-09-11',
      },
    ]);
  });

  it("ignore un mandat de groupe d'un organe inconnu ou d'une autre législature", () => {
    const depute = premier([
      acteur('PA1', [
        assemblee('2024-06-30'),
        mandat('GP', 'PO1', '2024-07-19'),
        mandat('GP', 'PO999', '2024-07-01', '2024-07-18'),
        mandat('GP', 'PO1', '2022-06-29', '2024-06-09', { legislature: '16' }),
      ]),
    ]);

    expect(depute.groupes).toEqual([{ id: 'PO1', debut: '2024-07-19', fin: null }]);
  });

  it('ne signale aucun autre groupe quand tous sont dans les scrutins', () => {
    expect(
      fabriquer([acteur('PA1', [assemblee('2024-06-30'), mandat('GP', 'PO1', '2024-07-19')])]).meta
        .autresGroupes,
    ).toEqual([]);
  });
});

describe('fonctionsEnCours', () => {
  const organes = new Map(ORGANES.map((o) => [o.id, o]));
  const fonction = (
    type: string,
    organeRef: string,
    debut: string,
    qualite: string | null,
    fin: string | null = null,
    legislature = '17',
  ) => mandat(type, organeRef, debut, fin, { qualite, legislature });

  it("donne le bureau puis la commission permanente, avec la qualité accordée au genre de l'archive", () => {
    expect(
      fonctionsEnCours(
        [
          fonction('COMPER', 'PO11', '2024-07-20', 'Membre'),
          fonction('BUREAU', 'PO10', '2025-10-01', "Vice-présidente de l'Assemblée nationale"),
        ] as never,
        organes as never,
      ),
    ).toEqual([
      {
        organe: "Bureau de l'Assemblée nationale",
        qualite: "Vice-présidente de l'Assemblée nationale",
        depuis: '2025-10-01',
      },
      { organe: 'Commission des affaires étrangères', qualite: 'Membre', depuis: '2024-07-20' },
    ]);
  });

  it('écarte les fonctions terminées, celles des autres législatures et les autres types de mandat', () => {
    expect(
      fonctionsEnCours(
        [
          fonction('COMPER', 'PO11', '2024-07-20', 'Membre', '2025-01-01'),
          fonction('COMPER', 'PO12', '2022-06-30', 'Membre', null, '16'),
          fonction('GA', 'PO11', '2024-07-20', 'Membre'),
          fonction('COMPER', 'PO12', '2025-02-01', 'Président'),
        ] as never,
        organes as never,
      ),
    ).toEqual([{ organe: 'Commission des finances', qualite: 'Président', depuis: '2025-02-01' }]);
  });

  it('écarte un organe inconnu, écrit « Membre » sans qualité et ne répète pas une fonction en double', () => {
    expect(
      fonctionsEnCours(
        [
          fonction('COMPER', 'PO999', '2024-07-20', 'Membre'),
          fonction('COMPER', 'PO11', '2024-07-20', null),
          fonction('COMPER', 'PO11', '2024-07-20', null),
        ] as never,
        organes as never,
      ),
    ).toEqual([
      { organe: 'Commission des affaires étrangères', qualite: 'Membre', depuis: '2024-07-20' },
    ]);
  });

  it("n'est calculé que pour un député en mandat", () => {
    const mandats = [
      assemblee('2024-06-30', '2026-01-10'),
      mandat('COMPER', 'PO11', '2024-07-20', null, { qualite: 'Membre' }),
    ];

    expect(premier([acteur('PA1', mandats)]).fonctions).toEqual([]);
    expect(premier([acteur('PA1', [assemblee('2024-06-30'), mandats[1]])]).fonctions).toHaveLength(
      1,
    );
  });
});

describe('construire : parti de rattachement', () => {
  it('donne le parti en cours (le plus récent) pour un député en mandat', () => {
    const depute = premier([
      acteur('PA1', [
        assemblee('2024-06-30'),
        mandat('PARPOL', 'PO21', '2017-12-01', '2018-11-30', { legislature: null }),
        mandat('PARPOL', 'PO20', '2025-12-03', null, { legislature: null }),
      ]),
    ]);

    expect(depute.parti).toBe('Rassemblement national');
  });

  it('est null sans parti en cours, ou pour un ancien député', () => {
    const termine = mandat('PARPOL', 'PO20', '2017-12-01', '2018-11-30', { legislature: null });
    const ouvert = mandat('PARPOL', 'PO20', '2025-12-03', null, { legislature: null });

    expect(premier([acteur('PA1', [assemblee('2024-06-30'), termine])]).parti).toBeNull();
    expect(
      premier([acteur('PA1', [assemblee('2024-06-30', '2026-01-10'), ouvert])]).parti,
    ).toBeNull();
  });
});

describe('legislaturesDeDepute', () => {
  it('liste les législatures des mandats de député, sans doublon et dans l’ordre', () => {
    expect(
      legislaturesDeDepute([
        assemblee('2024-06-30', null, '17'),
        assemblee('2017-06-18', '2022-06-21', '15'),
        assemblee('2025-01-05', null, '17'),
        mandat('GP', 'PO1', '2024-07-19'),
        { ...assemblee('2000-01-01'), legislature: 'null' },
      ] as never),
    ).toEqual([15, 17]);
  });
});

describe('couverture', () => {
  const depute = (actif: boolean, plus: Record<string, unknown> = {}) => ({
    actif,
    naissance: { date: '1973-04-13', lieu: null },
    profession: 'Avocat',
    liens: {
      hatvp: null,
      wikipedia: 'https://fr.wikipedia.org/wiki/A',
      siteWeb: null,
      x: null,
      facebook: null,
    },
    ...plus,
  });

  it('compte les informations présentes, pour les députés en mandat puis pour tous', () => {
    const resultat = couverture([
      depute(true),
      depute(true, { profession: null, naissance: null }),
      depute(false, {
        liens: { hatvp: null, wikipedia: null, siteWeb: null, x: null, facebook: null },
      }),
    ]);

    expect(resultat.actifs).toEqual({
      deputes: 2,
      wikipedia: 2,
      hatvp: 0,
      profession: 1,
      naissance: 1,
      siteWeb: 0,
      x: 0,
      facebook: 0,
    });
    expect(resultat.tous).toMatchObject({ deputes: 3, wikipedia: 2, profession: 2, naissance: 2 });
  });
});
