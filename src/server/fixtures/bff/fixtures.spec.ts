import type {
  Accueil,
  Compte,
  DeputeDetail,
  DeputeListe,
  LoiDetail,
  Position,
  ScrutinDetail,
  ScrutinResume,
  TypeScrutin,
  VoteGroupe,
} from '@contrat';
import accueil from './accueil.json';
import deputes from './deputes.json';
import marineLePen from './deputes/marine-le-pen.json';
import mathildePanot from './deputes/mathilde-panot.json';
import loi51670 from './lois/DLR5L17N51670.json';
import loi54372 from './lois/DLR5L17N54372.json';
import scrutin8280 from './scrutins/8280.json';
import scrutin8430 from './scrutins/8430.json';

/**
 * Un import JSON élargit les unions de littéraux en `string` (« 'pour' » devient `string`).
 * `Elargi<T>` fait de même sur le type du contrat : `satisfies Elargi<T>` vérifie alors les clés, les
 * `null`, les nombres et les booléens. Les valeurs des unions sont vérifiées à l'exécution.
 */
type Elargi<T> = T extends string
  ? string
  : T extends (infer U)[]
    ? Elargi<U>[]
    : T extends object
      ? { [K in keyof T]: Elargi<T[K]> }
      : T;

// Le contrat (docs/CONTRAT.md) : chaque réponse factice doit y satisfaire (vérifié par `npm run typecheck`).
const reponses = [
  accueil satisfies Elargi<Accueil>,
  loi51670 satisfies Elargi<LoiDetail>,
  loi54372 satisfies Elargi<LoiDetail>,
  scrutin8280 satisfies Elargi<ScrutinDetail>,
  scrutin8430 satisfies Elargi<ScrutinDetail>,
  deputes satisfies Elargi<DeputeListe>,
  marineLePen satisfies Elargi<DeputeDetail>,
  mathildePanot satisfies Elargi<DeputeDetail>,
];

const POSITIONS: readonly Position[] = ['pour', 'contre', 'abstention', 'nonvotant'];
const TYPES: readonly TypeScrutin[] = ['final', 'motion', 'article', 'amendement', 'autre'];
const GROUPES_REELS = [
  'RN',
  'EPR',
  'LFI-NFP',
  'SOC',
  'DR',
  'ECOS',
  'DEM',
  'HOR',
  'LIOT',
  'UDDPLR',
  'GDR',
  'NI',
];
const DOSSIER = /^DLR5L17N\d+$/;

const somme = (c: Compte) => c.pour + c.contre + c.abstention + c.nonvotant;

function verifierScrutin(s: Elargi<ScrutinResume>) {
  expect(Number.isInteger(s.numero)).toBe(true);
  expect(Number.isNaN(Date.parse(s.date))).toBe(false);
  expect(TYPES as readonly string[]).toContain(s.type);
  expect(s.titre.length).toBeGreaterThan(0);
  expect(s.urlOfficielle).toBe(`https://www.assemblee-nationale.fr/dyn/17/scrutins/${s.numero}`);
  for (const p of POSITIONS) {
    expect(Number.isInteger(s.compte[p]) && s.compte[p] >= 0).toBe(true);
  }
  // Règle de PLAN.md : majorité des suffrages exprimés, ou 289 pour une motion de censure.
  expect(s.adopte).toBe(
    s.type === 'motion' ? s.compte.pour >= 289 : s.compte.pour > s.compte.contre,
  );
}

function verifierGroupes(groupes: Elargi<VoteGroupe>[], total: Compte) {
  expect(groupes.map((g) => g.groupe.id)).toEqual(GROUPES_REELS);
  const cumul: Compte = { pour: 0, contre: 0, abstention: 0, nonvotant: 0 };
  for (const g of groupes) {
    expect(g.groupe.abrege).toBe(g.groupe.id);
    expect([...POSITIONS, 'partage']).toContain(g.position);
    for (const p of POSITIONS) {
      cumul[p] += g.compte[p];
    }
  }
  // Pour un même scrutin, la somme des groupes égale le total du scrutin.
  expect(cumul).toEqual(total);
}

describe('fixtures du BFF factice', () => {
  it('accueil.json : 10 lois conformes, du plus récent au plus ancien', () => {
    expect(accueil.lois).toHaveLength(10);
    expect(accueil.page).toBe(1);
    expect(Number.isNaN(Date.parse(accueil.miseAJour))).toBe(false);
    for (const loi of accueil.lois) {
      expect(loi.dossier).toMatch(DOSSIER);
      expect(loi.statut).toBeNull();
      expect(loi.titreOfficiel).toBe(loi.voteFinal.titre);
      expect(loi.voteFinal.type).toBe('final');
      verifierScrutin(loi.voteFinal);
      verifierGroupes(loi.groupes, loi.voteFinal.compte);
    }
    const dates = accueil.lois.map((l) => l.voteFinal.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(new Set(accueil.lois.map((l) => l.dossier)).size).toBe(10);
  });

  it.each([
    ['DLR5L17N51670', loi51670, 2],
    ['DLR5L17N54372', loi54372, 0],
  ])('lois/%s.json : loi conforme avec %i lecture(s) précédente(s)', (dossier, loi, lectures) => {
    expect(loi.dossier).toBe(dossier);
    expect(loi.statut).toBeNull();
    expect(loi.urlDossier).toBeNull();
    expect(loi.lectures).toHaveLength(lectures);
    expect(loi.voteFinal.titre).toBe(loi.titreOfficiel);
    verifierScrutin(loi.voteFinal);
    verifierGroupes(loi.voteFinal.groupes, loi.voteFinal.compte);
    for (const s of [...loi.lectures, ...loi.scrutins]) {
      verifierScrutin(s);
    }
    for (const s of loi.lectures) {
      expect(s.type).toBe('final');
      expect(s.date < loi.voteFinal.date).toBe(true);
    }
    for (const s of loi.scrutins) {
      expect(s.type).not.toBe('final');
    }
    const dates = loi.scrutins.map((s) => s.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('une des lois a plusieurs lectures', () => {
    expect(loi51670.lectures.length).toBeGreaterThan(0);
    expect(loi51670.lecture).toBe('lecture définitive');
  });

  it.each([
    [8280, scrutin8280],
    [8430, scrutin8430],
  ])('scrutins/%i.json : scrutin conforme', (numero, scrutin) => {
    expect(scrutin.numero).toBe(numero);
    verifierScrutin(scrutin);
    verifierGroupes(scrutin.groupes, scrutin.compte);
    if (scrutin.loi?.dossier) {
      expect(scrutin.loi.dossier).toMatch(DOSSIER);
    }
    // Le nominatif reprend exactement les comptes par groupe et par position.
    for (const groupe of scrutin.groupes) {
      for (const p of POSITIONS) {
        const liste = scrutin.nominatif.find(
          (n) => n.groupeId === groupe.groupe.id && n.position === p,
        );
        expect(liste?.deputes.length ?? 0).toBe(groupe.compte[p]);
      }
    }
    expect(scrutin.nominatif.reduce((n, l) => n + l.deputes.length, 0)).toBe(somme(scrutin.compte));
  });

  it('deputes.json : les 574 députés actifs, 12 groupes, des lois récentes', () => {
    expect(deputes.deputes).toHaveLength(574);
    expect(deputes.groupes.map((g) => g.id)).toEqual(GROUPES_REELS);
    expect(new Set(deputes.deputes.map((d) => d.slug)).size).toBe(574);
    for (const d of deputes.deputes) {
      expect(GROUPES_REELS).toContain(d.groupe);
    }
    expect(deputes.loisRecentes.length).toBeGreaterThan(0);
    for (const l of deputes.loisRecentes) {
      expect(l.dossier).toMatch(DOSSIER);
    }
  });

  it.each([
    ['marine-le-pen', marineLePen],
    ['mathilde-panot', mathildePanot],
  ])('deputes/%s.json : fiche conforme', (slug, fiche) => {
    expect(fiche.slug).toBe(slug);
    expect(deputes.deputes.find((d) => d.slug === slug)?.groupe).toBe(fiche.groupe?.id);
    for (const t of Object.values(fiche.taux)) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
    expect(fiche.dernieresLois).toHaveLength(10);
    // Ce sont les 10 derniers votes finaux, ceux de l'accueil.
    expect(fiche.dernieresLois.map((l) => l.numero)).toEqual(
      accueil.lois.map((l) => l.voteFinal.numero),
    );
    for (const l of fiche.dernieresLois) {
      expect(l.position === null || (POSITIONS as readonly string[]).includes(l.position)).toBe(
        true,
      );
    }
  });

  it('contient une réponse par route, sans HTML', () => {
    expect(reponses).toHaveLength(8);
    expect(JSON.stringify(reponses)).not.toMatch(/<\/?[a-z][^>]*>/i);
  });
});
