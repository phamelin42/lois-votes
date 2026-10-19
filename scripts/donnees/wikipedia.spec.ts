// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DELAI_MAX_WIKIDATA,
  PAUSES_WIKIDATA,
  REQUETE_WIKIDATA,
  USER_AGENT,
  chargerWikipedia,
  lireWikidata,
  telechargerWikidata,
} from './wikipedia.mjs';

const WIKI = 'https://fr.wikipedia.org/wiki/';
const ligne = (numero: string, article?: string) => ({
  an: { type: 'literal', value: numero },
  ...(article ? { article: { type: 'uri', value: article } } : {}),
});
const reponse = (...lignes: object[]) => ({
  head: { vars: ['an', 'article'] },
  results: { bindings: lignes },
});
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { 'content-type': 'application/sparql-results+json' },
  });
const SANS_MINIMUM = { lignesMinimales: 1 };

describe('lireWikidata', () => {
  it("associe le numéro d'acteur (sans PA) à l'article Wikipédia en français", () => {
    const liens = lireWikidata(
      reponse(ligne('720468', `${WIKI}S%C3%A9bastien_Chenu`), ligne('1008', `${WIKI}Alain_David`)),
      SANS_MINIMUM,
    );

    expect(liens.get('720468')).toBe(`${WIKI}S%C3%A9bastien_Chenu`);
    expect(liens.get('1008')).toBe(`${WIKI}Alain_David`);
    expect(liens.size).toBe(2);
  });

  it("ignore une ligne sans article (l'élément existe mais n'a pas de page en français)", () => {
    const liens = lireWikidata(reponse(ligne('1'), ligne('2', `${WIKI}B`)), SANS_MINIMUM);

    expect([...liens.keys()]).toEqual(['2']);
  });

  it('ne retient que des adresses qui commencent par « https://fr.wikipedia.org/wiki/ »', () => {
    const liens = lireWikidata(
      reponse(
        ligne('1', 'https://en.wikipedia.org/wiki/A'),
        ligne('2', 'http://fr.wikipedia.org/wiki/B'),
        ligne('3', 'https://fr.wikipedia.org.example.com/wiki/C'),
        ligne('4', 'https://example.com/https://fr.wikipedia.org/wiki/D'),
        ligne('5', 'javascript:alert(1)'),
        ligne('6', `${WIKI}Avec espace`),
        ligne('7', `${WIKI}Bonne_page`),
      ),
      SANS_MINIMUM,
    );

    expect([...liens.keys()]).toEqual(['7']);
  });

  it('ignore un identifiant qui ne ressemble pas à un numéro', () => {
    const liens = lireWikidata(
      reponse(ligne('PA720468', `${WIKI}A`), ligne('', `${WIKI}B`), ligne('12345678', `${WIKI}C`)),
      SANS_MINIMUM,
    );

    expect(liens.size).toBe(0);
  });

  it("n'en garde aucun quand deux articles différents se disputent un numéro, et garde un doublon identique", () => {
    const liens = lireWikidata(
      reponse(
        ligne('1', `${WIKI}A`),
        ligne('1', `${WIKI}B`),
        ligne('2', `${WIKI}C`),
        ligne('2', `${WIKI}C`),
      ),
      SANS_MINIMUM,
    );

    expect([...liens.entries()]).toEqual([['2', `${WIKI}C`]]);
  });

  it('refuse une réponse illisible ou incomplète', () => {
    expect(() => lireWikidata({})).toThrow(/illisible/);
    expect(() => lireWikidata(null)).toThrow(/illisible/);
    expect(() => lireWikidata(reponse(ligne('1', `${WIKI}A`)))).toThrow(/incomplète : 1 lignes/);
  });
});

describe('telechargerWikidata', () => {
  const pasDAttente = async () => undefined;
  const complete = () =>
    reponse(...Array.from({ length: 5 }, (_, i) => ligne(String(i + 1), `${WIKI}P${i}`)));

  it('envoie la requête SPARQL en GET, avec un User-Agent qui identifie le site (ASCII)', async () => {
    const requete = vi.fn(async () => json(complete()));

    const liens = await telechargerWikidata({
      fetch: requete as never,
      attendre: pasDAttente,
      lignesMinimales: 1,
    });

    expect(liens.size).toBe(5);
    expect(requete).toHaveBeenCalledTimes(1);
    const [url, options] = requete.mock.calls[0] as unknown as [string, RequestInit];
    const adresse = new URL(url);
    expect(adresse.origin + adresse.pathname).toBe('https://query.wikidata.org/sparql');
    expect(adresse.searchParams.get('query')).toBe(REQUETE_WIKIDATA);
    expect(REQUETE_WIKIDATA).toContain('wdt:P4123');
    expect(REQUETE_WIKIDATA).toContain('<https://fr.wikipedia.org/>');
    const entetes = options.headers as Record<string, string>;
    expect(entetes['Accept']).toBe('application/sparql-results+json');
    expect(entetes['User-Agent']).toBe(USER_AGENT);
    expect(USER_AGENT).toContain('quiavotequoi.phamelin.fr');
    // Un en-tête HTTP est en ASCII : un caractère typographique ferait échouer la requête avant l'envoi.
    expect(USER_AGENT).toMatch(/^[\x20-\x7e]+$/);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('a des pauses de 2, 4 et 8 s et un délai maximal de 60 s', () => {
    expect(PAUSES_WIKIDATA).toEqual([2000, 4000, 8000]);
    expect(DELAI_MAX_WIKIDATA).toBe(60_000);
  });

  it('réessaie après un 503 puis une coupure réseau, avec les pauses prévues', async () => {
    const reponses = [
      () => new Response('indisponible', { status: 503 }),
      () => {
        throw new TypeError('fetch failed');
      },
      () => json(complete()),
    ];
    const requete = vi.fn(async () => reponses.shift()!());
    const attentes: number[] = [];
    const journal: string[] = [];

    const liens = await telechargerWikidata({
      fetch: requete as never,
      attendre: async (ms) => void attentes.push(ms),
      journal: (m) => journal.push(m),
      lignesMinimales: 1,
    });

    expect(liens.size).toBe(5);
    expect(requete).toHaveBeenCalledTimes(3);
    expect(attentes).toEqual([2000, 4000]);
    expect(journal[0]).toMatch(/nouvel essai dans 2 s \(statut 503/);
  });

  it('abandonne après la première tentative et trois nouveaux essais', async () => {
    const requete = vi.fn(async () => new Response('', { status: 502 }));
    const attentes: number[] = [];

    await expect(
      telechargerWikidata({
        fetch: requete as never,
        attendre: async (ms) => void attentes.push(ms),
      }),
    ).rejects.toThrow(/Wikidata : statut 502/);

    expect(requete).toHaveBeenCalledTimes(4);
    expect(attentes).toEqual([2000, 4000, 8000]);
  });

  it('réessaie sur un 429 mais pas sur un 403 ou un 400 (refus définitif)', async () => {
    const limite = vi.fn(async () => new Response('', { status: 429 }));
    await expect(
      telechargerWikidata({ fetch: limite as never, attendre: pasDAttente, pauses: [1] }),
    ).rejects.toThrow(/429/);
    expect(limite).toHaveBeenCalledTimes(2);

    for (const status of [400, 403, 404]) {
      const refus = vi.fn(async () => new Response('', { status }));
      await expect(
        telechargerWikidata({ fetch: refus as never, attendre: pasDAttente }),
      ).rejects.toThrow(new RegExp(String(status)));
      expect(refus).toHaveBeenCalledTimes(1);
    }
  });

  it("réessaie quand le corps n'est pas du JSON, puis échoue", async () => {
    const requete = vi.fn(async () => new Response('<html>erreur</html>', { status: 200 }));

    await expect(
      telechargerWikidata({ fetch: requete as never, attendre: pasDAttente, pauses: [1] }),
    ).rejects.toThrow(/Wikidata/);
    expect(requete).toHaveBeenCalledTimes(2);
  });

  it('écarte une réponse trop courte pour être la liste complète', async () => {
    const requete = vi.fn(async () => json(reponse(ligne('1', `${WIKI}A`))));

    await expect(
      telechargerWikidata({ fetch: requete as never, attendre: pasDAttente, pauses: [] }),
    ).rejects.toThrow(/incomplète/);
  });
});

describe('chargerWikipedia', () => {
  const silence = () => undefined;

  it('lit wikidata.json des fixtures, sans réseau', async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'wikidata-fixtures-'));
    try {
      writeFileSync(
        join(dossier, 'wikidata.json'),
        JSON.stringify(reponse(ligne('7', `${WIKI}A`))),
      );
      const requete = vi.fn();

      const resultat = await chargerWikipedia({
        depuis: 'fixtures',
        fixtures: dossier,
        fetch: requete as never,
        journal: silence,
      });

      expect(requete).not.toHaveBeenCalled();
      expect(resultat.avertissements).toEqual([]);
      expect(resultat.liens?.get('7')).toBe(`${WIKI}A`);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it("interroge Wikidata pour la source officielle et n'avertit de rien quand il répond", async () => {
    const complete = reponse(
      ...Array.from({ length: 1200 }, (_, i) => ligne(String(i + 1), `${WIKI}P${i}`)),
    );
    const requete = vi.fn(async () => json(complete));
    const journal: string[] = [];

    const resultat = await chargerWikipedia({
      depuis: 'officiel',
      fixtures: 'inutile',
      fetch: requete as never,
      journal: (m) => journal.push(m),
    });

    expect(resultat.avertissements).toEqual([]);
    expect(resultat.liens?.size).toBe(1200);
    expect(journal.at(-1)).toMatch(/1200 articles Wikipédia/);
  });

  it("ne lève jamais d'erreur : sans Wikidata, pas de liens, un avertissement « wikipedia » et un message dans le journal", async () => {
    const requete = vi.fn(async () => new Response('', { status: 503 }));
    const journal: string[] = [];

    const resultat = await chargerWikipedia({
      depuis: 'officiel',
      fixtures: 'inutile',
      fetch: requete as never,
      pauses: [],
      journal: (m) => journal.push(m),
    });

    expect(resultat).toEqual({ liens: null, avertissements: ['wikipedia'] });
    expect(journal.at(-1)).toMatch(/AVERTISSEMENT : liens Wikipédia indisponibles/);
  });

  it('avertit aussi quand le fichier des fixtures manque, sans interrompre le build', async () => {
    const resultat = await chargerWikipedia({
      depuis: 'fixtures',
      fixtures: join(tmpdir(), 'dossier-absent-wikidata'),
      journal: silence,
    });

    expect(resultat).toEqual({ liens: null, avertissements: ['wikipedia'] });
  });
});
