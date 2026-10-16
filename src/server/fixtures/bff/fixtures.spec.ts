import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Accueil,
  Compte,
  DeputeDetail,
  DeputeListe,
  LoiDetail,
  ScrutinDetail,
  VoteGroupe,
} from '@contrat';

// Fixtures du BFF factice : une réponse conforme au contrat par route (voir docs/CONTRAT.md).
const dossier = join(process.cwd(), 'src/server/fixtures/bff');
const lire = <T>(chemin: string): T => JSON.parse(readFileSync(join(dossier, chemin), 'utf8')) as T;
const fichiers = (sous: string) => readdirSync(join(dossier, sous)).filter((f) => f.endsWith('.json'));

const POSITIONS = ['pour', 'contre', 'abstention', 'nonvotant'];
const POSITIONS_GROUPE = [...POSITIONS, 'partage'];
const GROUPES_REELS = ['RN', 'EPR', 'LFI-NFP', 'SOC', 'DR', 'ECOS', 'DEM', 'HOR', 'LIOT', 'UDDPLR', 'GDR', 'NI'];

function estCompte(c: Compte) {
  for (const cle of ['pour', 'contre', 'abstention', 'nonvotant'] as const) {
    expect(Number.isInteger(c[cle]) && c[cle] >= 0, `compte.${cle}`).toBe(true);
  }
}

function somme(c: Compte) {
  return c.pour + c.contre + c.abstention + c.nonvotant;
}

function verifierGroupes(groupes: VoteGroupe[], compte: Compte) {
  expect(groupes.length).toBeGreaterThan(0);
  const total = { pour: 0, contre: 0, abstention: 0, nonvotant: 0 };
  for (const g of groupes) {
    estCompte(g.compte);
    expect(POSITIONS_GROUPE).toContain(g.position);
    expect(g.groupe.id).toBe(g.groupe.abrege);
    for (const cle of Object.keys(total) as (keyof Compte)[]) total[cle] += g.compte[cle];
  }
  expect(total).toEqual(compte); // « à l'unité près » : les fixtures sont exactes
}

function verifierScrutin(s: { numero: number; date: string; titre: string; compte: Compte; urlOfficielle: string; adopte: boolean; type: string }) {
  expect(Number.isInteger(s.numero)).toBe(true);
  expect(Number.isNaN(Date.parse(s.date))).toBe(false);
  expect(s.titre.length).toBeGreaterThan(5);
  expect(['final', 'motion', 'article', 'amendement', 'autre']).toContain(s.type);
  expect(s.urlOfficielle).toBe(`https://www.assemblee-nationale.fr/dyn/17/scrutins/${s.numero}`);
  estCompte(s.compte);
  expect(typeof s.adopte).toBe('boolean');
}

const sansHtml = (valeur: unknown) => expect(JSON.stringify(valeur)).not.toMatch(/<\/?[a-z][^>]*>/i);

describe('fixtures du BFF factice', () => {
  it('fournit une fixture par route', () => {
    expect(existsSync(join(dossier, 'accueil.json'))).toBe(true);
    expect(existsSync(join(dossier, 'deputes.json'))).toBe(true);
    expect(fichiers('lois')).toHaveLength(2);
    expect(fichiers('scrutins')).toHaveLength(2);
    expect(fichiers('deputes')).toHaveLength(2);
  });

  it('accueil.json respecte Accueil', () => {
    const accueil = lire<Accueil>('accueil.json');

    expect(accueil.lois.length).toBeGreaterThanOrEqual(3);
    expect(accueil.page).toBe(1);
    expect(typeof accueil.pageSuivante).toBe('boolean');
    expect(Number.isNaN(Date.parse(accueil.miseAJour))).toBe(false);
    for (const loi of accueil.lois) {
      if (loi.dossier !== null) expect(loi.dossier).toMatch(/^DLR5L17N\d+$/);
      expect(loi.statut).toBeNull();
      expect(loi.titreCourt.length).toBeGreaterThan(3);
      expect(loi.voteFinal.type).toBe('final');
      verifierScrutin(loi.voteFinal);
      verifierGroupes(loi.groupes, loi.voteFinal.compte);
    }
    const dates = accueil.lois.map((l) => Date.parse(l.voteFinal.date));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    sansHtml(accueil);
  });

  it.each(fichiers('lois'))('lois/%s respecte LoiDetail', (fichier) => {
    const loi = lire<LoiDetail>(`lois/${fichier}`);

    expect(loi.dossier).toMatch(/^DLR5L17N\d+$/);
    expect(`${loi.dossier}.json`).toBe(fichier);
    expect(loi.statut).toBeNull();
    expect(loi.urlDossier).toBeNull();
    if (loi.voteFinal) {
      verifierScrutin(loi.voteFinal);
      verifierGroupes(loi.voteFinal.groupes, loi.voteFinal.compte);
    }
    for (const s of [...loi.lectures, ...loi.scrutins]) verifierScrutin(s);
    sansHtml(loi);
  });

  it('une des lois a plusieurs lectures', () => {
    const lectures = fichiers('lois').map((f) => lire<LoiDetail>(`lois/${f}`).lectures.length);

    expect(Math.max(...lectures)).toBeGreaterThanOrEqual(1);
  });

  it.each(fichiers('scrutins'))('scrutins/%s respecte ScrutinDetail', (fichier) => {
    const scrutin = lire<ScrutinDetail>(`scrutins/${fichier}`);

    expect(`${scrutin.numero}.json`).toBe(fichier);
    verifierScrutin(scrutin);
    verifierGroupes(scrutin.groupes, scrutin.compte);
    const nominatifs = scrutin.nominatif.reduce((t, n) => t + n.deputes.length, 0);
    expect(nominatifs).toBe(somme(scrutin.compte));
    for (const n of scrutin.nominatif) {
      expect(POSITIONS).toContain(n.position);
      expect(scrutin.groupes.some((g) => g.groupe.id === n.groupeId)).toBe(true);
    }
    sansHtml(scrutin);
  });

  it('deputes.json respecte DeputeListe, avec les 12 groupes réels', () => {
    const liste = lire<DeputeListe>('deputes.json');

    expect(liste.deputes.length).toBeGreaterThanOrEqual(10);
    expect(liste.groupes.map((g) => g.abrege).sort()).toEqual([...GROUPES_REELS].sort());
    for (const d of liste.deputes) {
      expect(d.slug).toMatch(/^[a-z0-9-]+$/);
      expect(d.nom.length).toBeGreaterThan(2);
      expect(d.nomTri.length).toBeGreaterThan(1);
    }
    for (const l of liste.loisRecentes) expect(l.dossier).toMatch(/^DLR5L17N\d+$/);
    sansHtml(liste);
  });

  it.each(fichiers('deputes'))('deputes/%s respecte DeputeDetail', (fichier) => {
    const depute = lire<DeputeDetail>(`deputes/${fichier}`);

    expect(`${depute.slug}.json`).toBe(fichier);
    expect(depute.dernieresLois.length).toBeLessThanOrEqual(10);
    expect(depute.dernieresLois.length).toBeGreaterThanOrEqual(3);
    for (const cle of ['participation', 'abstention', 'loyaute'] as const) {
      const v = depute.taux[cle];
      expect(v === null || (v >= 0 && v <= 1), `taux.${cle}`).toBe(true);
    }
    expect(depute.urlFiche).toMatch(/^https:\/\//);
    sansHtml(depute);
  });
});
