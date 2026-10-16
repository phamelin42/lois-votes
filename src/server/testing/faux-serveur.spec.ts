import { demarrer } from '../../../e2e/faux-tabulaire.mjs';
import { RIDS } from './univers.mjs';

// Le faux serveur HTTP de l'API tabulaire sert les e2e : il doit parler comme data.gouv.fr.
describe('faux serveur HTTP de l\'API tabulaire', () => {
  const ouverts: { fermer: () => Promise<void> }[] = [];
  afterEach(async () => {
    while (ouverts.length) await ouverts.pop()!.fermer();
  });

  async function lancer(options: Record<string, unknown> = {}) {
    const serveur = await demarrer({ port: 0, ...options });
    ouverts.push(serveur);
    return serveur as { url: string; fermer: () => Promise<void> };
  }

  it('sert une ressource au format { data, links, meta }', async () => {
    const { url } = await lancer();

    const reponse = await fetch(`${url}/api/resources/${RIDS.deputes}/data/?active__exact=true&page_size=3`);
    const corps = await reponse.json();

    expect(reponse.status).toBe(200);
    expect(corps.data).toHaveLength(3);
    expect(corps.meta).toEqual({ page: 1, page_size: 3, total: 11 });
    expect(corps.links.next).toContain('page=2');
  });

  it('applique le tri et __contains', async () => {
    const { url } = await lancer();
    const requete = new URLSearchParams({ title__contains: "l'ensemble", date__sort: 'desc', page_size: '2' });

    const corps = await (await fetch(`${url}/api/resources/${RIDS.scrutins}/data/?${requete}`)).json();

    expect(corps.data.map((l: { id: string }) => l.id)).toEqual(['VTANR5L17V115', 'VTANR5L17V111']);
  });

  it('refuse un page_size de plus de 200 comme la vraie API', async () => {
    const { url } = await lancer();

    const reponse = await fetch(`${url}/api/resources/${RIDS.votes}/data/?page_size=500`);

    expect(reponse.status).toBe(400);
  });

  it('répond 500 sur toutes les requêtes avec erreur=500', async () => {
    const { url } = await lancer({ erreur: 500 });

    expect((await fetch(`${url}/api/resources/${RIDS.deputes}/data/`)).status).toBe(500);
  });

  it('répond 429 avec Retry-After avec erreur=429', async () => {
    const { url } = await lancer({ erreur: 429 });
    const reponse = await fetch(`${url}/api/resources/${RIDS.deputes}/data/`);

    expect(reponse.status).toBe(429);
    expect(reponse.headers.get('retry-after')).toBeTruthy();
  });

  it('répond 404 pour une ressource inconnue', async () => {
    const { url } = await lancer();

    expect((await fetch(`${url}/api/resources/inconnu/data/`)).status).toBe(404);
  });
});
