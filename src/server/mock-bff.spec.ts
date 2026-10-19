import accueil from './fixtures/bff/accueil.json';
import deputes from './fixtures/bff/deputes.json';
import loi from './fixtures/bff/lois/DLR5L17N54372.json';
import { appelerMock, DELAI_MOCK } from './mock-bff';

const SANS_DELAI = { delai: 0 };

describe('appelerMock', () => {
  it('sert la fixture de chaque route avec un Cache-Control', async () => {
    const cas: [string, unknown, RegExp][] = [
      ['/api/accueil', accueil, /s-maxage=1800/],
      ['/api/accueil?page=1', accueil, /s-maxage=1800/],
      ['/api/lois/DLR5L17N54372', loi, /s-maxage=3600/],
      ['/api/scrutins/8430', undefined, /s-maxage=86400/],
      ['/api/deputes', deputes, /s-maxage=21600/],
      ['/api/deputes/mathilde-panot', undefined, /s-maxage=3600/],
    ];
    for (const [url, corps, cache] of cas) {
      const reponse = await appelerMock(url, SANS_DELAI);
      expect(reponse.statut, url).toBe(200);
      expect(reponse.entetes['Cache-Control'], url).toMatch(cache);
      expect(reponse.entetes['Cache-Control'], url).toMatch(/stale-while-revalidate=\d+/);
      if (corps) {
        expect(reponse.corps, url).toEqual(corps);
      }
    }
  });

  it('répond 404 { erreur } pour une ressource inconnue, sans mise en cache', async () => {
    for (const url of [
      '/api/lois/DLR5L17N0',
      '/api/scrutins/1',
      '/api/deputes/inconnu',
      '/api/inconnu',
      '/api/lois/DLR5L17N54372/en-trop',
      '/api/accueil?page=0',
    ]) {
      const reponse = await appelerMock(url, SANS_DELAI);
      expect(reponse.statut, url).toBe(404);
      expect(reponse.entetes['Cache-Control'], url).toBe('no-store');
      expect(reponse.corps, url).toEqual({ erreur: expect.any(String) });
    }
  });

  it('ne confond pas un nom de propriété d’objet avec une fixture', async () => {
    expect((await appelerMock('/api/lois/__proto__', SANS_DELAI)).statut).toBe(404);
    expect((await appelerMock('/api/lois/constructor', SANS_DELAI)).statut).toBe(404);
  });

  it('renvoie une page vide au-delà de la première page', async () => {
    const reponse = await appelerMock('/api/accueil?page=2', SANS_DELAI);
    expect(reponse.corps).toMatchObject({ lois: [], page: 2, pageSuivante: false });
  });

  it('simule un délai de 150 ms par défaut', async () => {
    expect(DELAI_MOCK).toBe(150);
    vi.useFakeTimers();
    try {
      let terminee = false;
      const attente = appelerMock('/api/accueil').then(() => (terminee = true));
      await vi.advanceTimersByTimeAsync(DELAI_MOCK - 1);
      expect(terminee).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await attente;
      expect(terminee).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
