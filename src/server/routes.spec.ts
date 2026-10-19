// @vitest-environment node
import type {
  Accueil,
  DeputeDetail,
  DeputeListe,
  LoiDetail,
  ScrutinDetail,
  ScrutinResume,
  VoteGroupe,
} from '@contrat';
import { creerAgregation } from './agregation';
import { creerBff, creerBffIndisponible, type Bff, type ReponseBff } from './routes';
import { produireDonneesDeTest, type DonneesDeTest } from './testing/donnees';

const POSITIONS_GROUPE = ['pour', 'contre', 'abstention', 'nonvotant', 'partage'];

function verifierGroupes(groupes: VoteGroupe[]) {
  expect(groupes.length).toBeGreaterThan(0);
  for (const { groupe, position, compte } of groupes) {
    expect(groupe.id).toMatch(/^PO\d+$/);
    expect(typeof groupe.abrege).toBe('string');
    expect(typeof groupe.libelle).toBe('string');
    expect(groupe.couleur === null || /^#[0-9A-Fa-f]{6}$/.test(groupe.couleur)).toBe(true);
    expect(POSITIONS_GROUPE).toContain(position);
    for (const n of Object.values(compte)) expect(Number.isInteger(n)).toBe(true);
  }
}

function verifierEnMandat(scrutin: ScrutinResume) {
  const { pour, contre, abstention } = scrutin.compte;
  expect(Number.isInteger(scrutin.enMandat)).toBe(true);
  expect(scrutin.enMandat).toBeGreaterThanOrEqual(pour + contre + abstention);
}

describe('routes /api/*', () => {
  let jeu: DonneesDeTest;
  let bff: Bff;
  const appeler = (url: string): Promise<ReponseBff> => bff.appelerBff(url);

  beforeAll(async () => {
    jeu = await produireDonneesDeTest();
    bff = creerBff(creerAgregation(jeu.donnees));
  });
  afterAll(() => jeu.nettoyer());

  describe('GET /api/accueil', () => {
    it('renvoie un Accueil conforme au contrat, en JSON, avec son Cache-Control', async () => {
      const reponse = await appeler('/api/accueil?page=1');
      const accueil = reponse.body as Accueil;

      expect(reponse.status).toBe(200);
      expect(reponse.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(reponse.headers['cache-control']).toBe(
        'public, max-age=60, s-maxage=1800, stale-while-revalidate=86400',
      );
      expect(accueil.page).toBe(1);
      expect(typeof accueil.pageSuivante).toBe('boolean');
      expect(accueil.miseAJour).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(accueil.lois).toHaveLength(10);
      for (const loi of accueil.lois) {
        expect(loi.dossier === null || /^DL[A-Z0-9]+$/.test(loi.dossier)).toBe(true);
        expect(loi.titreCourt).not.toBe('');
        expect(loi.statut).toBeNull();
        expect(loi.voteFinal.type).toBe('final');
        verifierEnMandat(loi.voteFinal);
        expect(loi.voteFinal.urlOfficielle).toBe(
          `https://www.assemblee-nationale.fr/dyn/17/scrutins/${loi.voteFinal.numero}`,
        );
        verifierGroupes(loi.groupes);
      }
    });

    it('prend la page 1 par défaut', async () => {
      expect(((await appeler('/api/accueil')).body as Accueil).page).toBe(1);
    });

    it.each(['0', '51', 'abc', '-1', '1.5', ''])('refuse la page %j (404)', async (page) => {
      const reponse = await appeler(`/api/accueil?page=${page}`);

      expect(reponse.status).toBe(404);
      expect(reponse.headers['cache-control']).toBe('no-store');
      expect(reponse.body).toEqual({ erreur: expect.any(String) });
    });
  });

  describe('GET /api/lois/:dossier', () => {
    it('renvoie une LoiDetail conforme au contrat', async () => {
      const reponse = await appeler('/api/lois/DLR5L17N53980');
      const loi = reponse.body as LoiDetail;

      expect(reponse.status).toBe(200);
      expect(reponse.headers['cache-control']).toBe(
        'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
      );
      expect(loi.dossier).toBe('DLR5L17N53980');
      expect(loi.voteFinal?.numero).toBe(8433);
      verifierGroupes(loi.voteFinal!.groupes);
      verifierEnMandat(loi.voteFinal!);
      for (const s of [...loi.lectures, ...loi.scrutins]) verifierEnMandat(s);
      expect(Array.isArray(loi.lectures)).toBe(true);
      expect(Array.isArray(loi.scrutins)).toBe(true);
    });

    it.each(['DLR5L17N0', 'abc', 'dlr5l17n53980', 'DL%20X'])(
      'répond 404 pour le dossier inconnu ou invalide %s',
      async (dossier) => {
        const reponse = await appeler(`/api/lois/${dossier}`);

        expect(reponse.status).toBe(404);
        expect(reponse.headers['cache-control']).toBe('no-store');
      },
    );

    it('répond 404 sur un segment mal encodé', async () => {
      expect((await appeler('/api/lois/%E0%A4%A')).status).toBe(404);
    });
  });

  describe('GET /api/scrutins/:numero', () => {
    it('renvoie un ScrutinDetail conforme au contrat', async () => {
      const reponse = await appeler('/api/scrutins/8706');
      const scrutin = reponse.body as ScrutinDetail;

      expect(reponse.status).toBe(200);
      expect(reponse.headers['cache-control']).toBe(
        'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800',
      );
      expect(scrutin.numero).toBe(8706);
      expect(scrutin.date).toBe('2026-10-13');
      expect(scrutin.type).toBe('final');
      verifierGroupes(scrutin.groupes);
      verifierEnMandat(scrutin);
      expect(scrutin.nominatif.length).toBeGreaterThan(0);
      for (const bloc of scrutin.nominatif) {
        expect(bloc.groupeId).toMatch(/^PO\d+$/);
        expect(['pour', 'contre', 'abstention', 'nonvotant']).toContain(bloc.position);
        for (const d of bloc.deputes)
          expect(d).toEqual({ slug: expect.any(String), nom: expect.any(String) });
      }
    });

    it.each(['999999', '0abc', 'abc', '-1'])('répond 404 pour le scrutin %s', async (numero) => {
      expect((await appeler(`/api/scrutins/${numero}`)).status).toBe(404);
    });
  });

  describe('GET /api/deputes', () => {
    it('renvoie une DeputeListe conforme au contrat', async () => {
      const reponse = await appeler('/api/deputes');
      const liste = reponse.body as DeputeListe;

      expect(reponse.status).toBe(200);
      expect(reponse.headers['cache-control']).toBe(
        'public, max-age=60, s-maxage=21600, stale-while-revalidate=86400',
      );
      expect(liste.deputes.length).toBeGreaterThan(50);
      for (const d of liste.deputes) {
        expect(d.slug).toMatch(/^[a-z0-9-]+$/);
        expect(d.pa).toMatch(/^\d{1,7}$/);
        expect(d.nom).not.toBe('');
        expect(d.nomTri).not.toBe('');
      }
      expect(liste.groupes.length).toBeGreaterThan(5);
      expect(liste.loisRecentes.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/deputes/:slug', () => {
    it('renvoie une DeputeDetail conforme au contrat', async () => {
      const reponse = await appeler('/api/deputes/jerome-guedj');
      const depute = reponse.body as DeputeDetail;

      expect(reponse.status).toBe(200);
      expect(reponse.headers['cache-control']).toBe(
        'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
      );
      expect(depute.slug).toBe('jerome-guedj');
      expect(depute.photo).toMatch(/\/photos\/carre\/\d+\.jpg$/);
      expect(depute.liens.assemblee).toMatch(/\/dyn\/deputes\/PA\d+$/);
      expect(depute.naissance).toEqual({
        date: '1972-01-23',
        age: expect.any(Number),
        lieu: 'Pantin',
      });
      expect(depute.profession).toBe('Inspecteur général des affaires sociales');
      expect(depute.mandat).toMatchObject({ depuis: '2024-07-07', fin: null });
      expect(depute.groupes.map((g) => g.groupe.abrege)).toEqual(['NI', 'SOC']);
      expect(depute.partiRattachement).toBe('Parti socialiste');
      expect(depute.liens).toMatchObject({
        hatvp: 'https://www.hatvp.fr/pages_nominatives/guedj-jerome',
        wikipedia: 'https://fr.wikipedia.org/wiki/J%C3%A9r%C3%B4me_Guedj',
      });
      for (const taux of Object.values(depute.taux)) {
        expect(taux === null || (taux >= 0 && taux <= 1)).toBe(true);
      }
      const { enMandat, pour, contre, abstention, nonVote } = depute.scrutins;
      expect(pour + contre + abstention + nonVote).toBe(enMandat);
      expect(depute.taux.participation).toBeCloseTo((pour + contre + abstention) / enMandat, 10);
      expect(depute.dernieresLois).toHaveLength(10);
    });

    it('accepte un slug avec précision de département', async () => {
      const reponse = await appeler('/api/deputes/alexandra-martin-gironde');

      expect(reponse.status).toBe(200);
      expect((reponse.body as DeputeDetail).nom).toBe('Alexandra Martin (Gironde)');
    });

    it.each(['personne', 'Jerome-Guedj', 'jerome_guedj', 'a%2Fb'])(
      'répond 404 pour le slug %s',
      async (slug) => {
        expect((await appeler(`/api/deputes/${slug}`)).status).toBe(404);
      },
    );
  });

  it('répond 404 sur une route inconnue', async () => {
    for (const url of ['/api', '/api/inconnue', '/api/lois', '/api/lois/DLR5L17N1/x']) {
      const reponse = await appeler(url);

      expect(reponse.status, url).toBe(404);
      expect(reponse.headers['cache-control']).toBe('no-store');
    }
  });

  it('répond 500 sans détail sur une erreur inattendue', async () => {
    const casse = creerBff({
      accueil: () => {
        throw new Error('secret interne');
      },
    } as never);
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const reponse = await casse.appelerBff('/api/accueil');

    expect(reponse.status).toBe(500);
    expect(JSON.stringify(reponse.body)).not.toContain('secret');
    erreur.mockRestore();
  });
});

describe('BFF sans données', () => {
  it('répond 503 sur toutes les routes, sans cache, avec Retry-After', async () => {
    const bff = creerBffIndisponible();

    for (const url of [
      '/api/accueil',
      '/api/lois/DLR5L17N53980',
      '/api/scrutins/8706',
      '/api/deputes',
      '/api/deputes/jerome-guedj',
      '/api/inconnue',
    ]) {
      const reponse = await bff.appelerBff(url);

      expect(reponse.status, url).toBe(503);
      expect(reponse.headers['cache-control']).toBe('no-store');
      expect(reponse.headers['retry-after']).toBe('60');
      expect(reponse.body).toEqual({ erreur: expect.any(String) });
    }
  });
});
