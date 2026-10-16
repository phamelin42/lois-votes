import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { appelerMock } from './mock-bff';

const fixtures = join(process.cwd(), 'src/server/fixtures/bff');
const json = (chemin: string) => JSON.parse(readFileSync(join(fixtures, chemin), 'utf8'));
const premier = (sous: string) => readdirSync(join(fixtures, sous))[0].replace(/\.json$/, '');

describe('BFF factice (MOCK_BFF=1)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function appeler(url: string, delai = 150) {
    const reponse = appelerMock(url, { delai });
    await vi.advanceTimersByTimeAsync(delai + 10);
    return reponse;
  }

  it('sert accueil.json au format de appelerBff', async () => {
    const reponse = await appeler('/api/accueil?page=1');

    expect(reponse.status).toBe(200);
    expect(reponse.body).toEqual(json('accueil.json'));
    expect(reponse.headers['cache-control']).toBeDefined();
  });

  it('sert une loi, un scrutin, la liste des députés et un député', async () => {
    const loi = premier('lois');
    const scrutin = premier('scrutins');
    const depute = premier('deputes');

    expect((await appeler(`/api/lois/${loi}`)).body).toEqual(json(`lois/${loi}.json`));
    expect((await appeler(`/api/scrutins/${scrutin}`)).body).toEqual(
      json(`scrutins/${scrutin}.json`),
    );
    expect((await appeler('/api/deputes')).body).toEqual(json('deputes.json'));
    expect((await appeler(`/api/deputes/${depute}`)).body).toEqual(json(`deputes/${depute}.json`));
  });

  it('répond 404 {erreur} pour un objet inconnu', async () => {
    const reponse = await appeler('/api/lois/DLR5L17N0');

    expect(reponse.status).toBe(404);
    expect(reponse.body).toEqual({ erreur: expect.any(String) });
  });

  it("ne répond qu'après le délai de 150 ms", async () => {
    let fini = false;
    appelerMock('/api/deputes').then(() => (fini = true));

    await vi.advanceTimersByTimeAsync(100);
    expect(fini).toBe(false);
    await vi.advanceTimersByTimeAsync(60);
    expect(fini).toBe(true);
  });

  it('refuse de sortir du dossier de fixtures', async () => {
    const reponse = await appeler('/api/lois/..%2F..%2Fpackage');

    expect(reponse.status).toBe(404);
  });
});
