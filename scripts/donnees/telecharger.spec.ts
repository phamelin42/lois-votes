// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import {
  TAILLE_MINIMALE,
  URL_ACTEURS,
  URL_SCRUTINS,
  entreesDossier,
  entreesZip,
  ouvrirArchives,
  telecharger,
} from './telecharger.mjs';

const URL = 'https://exemple.test/archive.zip';

/** Un zip de plus de 1 Mo (contenu stocké, sans compression) qui contient les fichiers donnés. */
function zipVolumineux(fichiers: Record<string, string> = { 'json/a.json': '{}' }): Uint8Array {
  const donnees: Record<string, Uint8Array> = {};
  for (const [nom, texte] of Object.entries(fichiers)) donnees[nom] = strToU8(texte);
  donnees['remplissage.bin'] = new Uint8Array(TAILLE_MINIMALE + 10);
  return zipSync(donnees, { level: 0 });
}

function reponse(corps: Uint8Array | string, statut = 200, entetes: Record<string, string> = {}) {
  // Un 304 n'a pas de corps : le constructeur de Response refuse un corps pour ce statut.
  return new Response(statut === 304 ? null : (corps as BodyInit), {
    status: statut,
    headers: entetes,
  });
}

/** Égalité d'octets sans comparer un mégaoctet case par case (toEqual est très lent sur un Uint8Array de cette taille). */
const memes = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

describe('telecharger', () => {
  let dossier: string;
  beforeEach(() => {
    dossier = mkdtempSync(join(tmpdir(), 'donnees-telecharger-'));
  });
  afterEach(() => rmSync(dossier, { recursive: true, force: true }));

  const sansPause = async () => undefined;

  it('télécharge, vérifie la taille et écrit le cache avec son ETag', async () => {
    const zip = zipVolumineux();
    const appels: { url: string; headers: Record<string, string> }[] = [];
    const requete = async (url: string, options: { headers: Record<string, string> }) => {
      appels.push({ url, headers: options.headers });
      return reponse(zip, 200, {
        etag: '"v1"',
        'last-modified': 'Mon, 19 Oct 2026 04:25:16 GMT',
        'content-length': String(zip.length),
      });
    };

    const archive = await telecharger({
      url: URL,
      dossier: join(dossier, 'a'),
      fetch: requete as never,
    });

    expect(memes(archive.octets, zip)).toBe(true);
    expect(archive.depuisCache).toBe(false);
    expect(archive.source).toEqual({
      url: URL,
      lastModified: 'Mon, 19 Oct 2026 04:25:16 GMT',
      etag: '"v1"',
    });
    expect(appels).toEqual([{ url: URL, headers: {} }]);
    expect(readdirSync(join(dossier, 'a')).sort()).toEqual(['archive.zip', 'meta.json']);
  });

  it("envoie If-None-Match avec l'ETag du cache et réutilise le fichier sur un 304", async () => {
    const zip = zipVolumineux();
    const cache = join(dossier, 'a');
    await telecharger({
      url: URL,
      dossier: cache,
      fetch: (async () => reponse(zip, 200, { etag: '"v1"', 'last-modified': 'hier' })) as never,
    });

    const envoyes: Record<string, string>[] = [];
    const archive = await telecharger({
      url: URL,
      dossier: cache,
      attendre: async () => {
        throw new Error('pas de nouvel essai attendu');
      },
      fetch: (async (_url: string, options: { headers: Record<string, string> }) => {
        envoyes.push(options.headers);
        return reponse('', 304);
      }) as never,
    });

    expect(envoyes).toEqual([{ 'If-None-Match': '"v1"' }]);
    expect(archive.depuisCache).toBe(true);
    expect(memes(archive.octets, zip)).toBe(true);
    expect(archive.source).toEqual({ url: URL, lastModified: 'hier', etag: '"v1"' });
  });

  it("remplace le cache quand l'archive a changé (200 avec un nouvel ETag)", async () => {
    const cache = join(dossier, 'a');
    const v1 = zipVolumineux({ 'json/v1.json': '1' });
    const v2 = zipVolumineux({ 'json/v2.json': '2' });
    await telecharger({
      url: URL,
      dossier: cache,
      fetch: (async () => reponse(v1, 200, { etag: '"v1"' })) as never,
    });
    const archive = await telecharger({
      url: URL,
      dossier: cache,
      fetch: (async () => reponse(v2, 200, { etag: '"v2"' })) as never,
    });
    expect(archive.depuisCache).toBe(false);
    expect(archive.source.etag).toBe('"v2"');

    const apres = await telecharger({
      url: URL,
      dossier: cache,
      fetch: (async () => reponse('', 304)) as never,
    });
    expect(memes(apres.octets, v2)).toBe(true);
  });

  it('ignore un cache dont la taille ne correspond pas aux métadonnées (pas de If-None-Match)', async () => {
    const cache = join(dossier, 'a');
    await telecharger({
      url: URL,
      dossier: cache,
      fetch: (async () => reponse(zipVolumineux(), 200, { etag: '"v1"' })) as never,
    });
    writeFileSync(join(cache, 'archive.zip'), 'tronqué');

    const envoyes: Record<string, string>[] = [];
    await telecharger({
      url: URL,
      dossier: cache,
      fetch: (async (_url: string, options: { headers: Record<string, string> }) => {
        envoyes.push(options.headers);
        return reponse(zipVolumineux(), 200, { etag: '"v2"' });
      }) as never,
    });
    expect(envoyes).toEqual([{}]);
  });

  it("échoue tout de suite, avec le statut, quand ce n'est pas 200 (404 : pas de nouvel essai)", async () => {
    const requete = vi.fn(async () => reponse('introuvable', 404));
    await expect(
      telecharger({
        url: URL,
        dossier: join(dossier, 'a'),
        fetch: requete as never,
        attendre: sansPause,
      }),
    ).rejects.toThrow(`${URL} : statut 404 au lieu de 200`);
    expect(requete).toHaveBeenCalledTimes(1);
  });

  it("échoue sur un 304 quand il n'y a pas de cache", async () => {
    await expect(
      telecharger({
        url: URL,
        dossier: join(dossier, 'a'),
        fetch: (async () => reponse('', 304)) as never,
      }),
    ).rejects.toThrow(/304 sans cache/);
  });

  it('refuse une archive de moins de 1 Mo', async () => {
    const petit = zipSync({ 'json/a.json': strToU8('{}') });
    const requete = vi.fn(async () => reponse(petit, 200, { etag: '"v1"' }));
    await expect(
      telecharger({
        url: URL,
        dossier: join(dossier, 'a'),
        fetch: requete as never,
        attendre: sansPause,
      }),
    ).rejects.toThrow(/inférieure au minimum/);
    expect(requete).toHaveBeenCalledTimes(1);
  });

  it('réessaie après une panne réseau ou un 503, avec les pauses données, puis réussit', async () => {
    const zip = zipVolumineux();
    let n = 0;
    const requete = vi.fn(async () => {
      n++;
      if (n === 1) throw new TypeError('fetch failed');
      if (n === 2) return reponse('indisponible', 503);
      return reponse(zip, 200, { etag: '"v1"' });
    });
    const pauses: number[] = [];
    const messages: string[] = [];
    const archive = await telecharger({
      url: URL,
      dossier: join(dossier, 'a'),
      fetch: requete as never,
      attendre: async (ms) => void pauses.push(ms),
      journal: (m) => messages.push(m),
    });
    expect(memes(archive.octets, zip)).toBe(true);
    expect(pauses).toEqual([2000, 4000]);
    expect(messages.some((m) => m.includes('fetch failed'))).toBe(true);
  });

  it('abandonne après la dernière pause, en nommant la dernière erreur', async () => {
    const requete = vi.fn(async () => reponse('', 502));
    await expect(
      telecharger({
        url: URL,
        dossier: join(dossier, 'a'),
        fetch: requete as never,
        pauses: [1, 2],
        attendre: sansPause,
      }),
    ).rejects.toThrow(/après 3 essais \(.*statut 502 au lieu de 200\)/);
    expect(requete).toHaveBeenCalledTimes(3);
  });

  it('détecte un corps incomplet (content-length plus grand que les octets reçus) et réessaie', async () => {
    const zip = zipVolumineux();
    const tronquee = {
      status: 200,
      headers: new Headers({ etag: '"v1"', 'content-length': String(zip.length) }),
      arrayBuffer: async () => zip.slice(0, zip.length - 20).buffer,
    };
    const requete = vi
      .fn()
      .mockResolvedValueOnce(tronquee)
      .mockResolvedValueOnce(
        reponse(zip, 200, { etag: '"v1"', 'content-length': String(zip.length) }),
      );
    const messages: string[] = [];
    const archive = await telecharger({
      url: URL,
      dossier: join(dossier, 'a'),
      fetch: requete as never,
      attendre: sansPause,
      journal: (m) => messages.push(m),
    });
    expect(archive.octets.length).toBe(zip.length);
    expect(requete).toHaveBeenCalledTimes(2);
    expect(messages.some((m) => m.includes('corps incomplet'))).toBe(true);
  });
});

describe('entreesZip', () => {
  const zip = zipSync(
    {
      'json/VTANR5L17V1.json': strToU8('{"n":1}'),
      'json/VTANR5L17V2.json': strToU8('{"n":2}'),
      'json/VTANR5L17V3.json': strToU8('{"n":3}'),
      'json/autre.txt': strToU8('x'),
    },
    { level: 0 },
  );

  it('ne renvoie que les entrées acceptées, avec leur contenu, quel que soit le découpage en lots', () => {
    for (const lot of [1, 2, 400]) {
      const entrees = [...entreesZip(zip, (nom) => nom.endsWith('.json'), lot)].map(
        ([nom, octets]) => [nom, new TextDecoder().decode(octets)],
      );
      expect(entrees.sort()).toEqual([
        ['json/VTANR5L17V1.json', '{"n":1}'],
        ['json/VTANR5L17V2.json', '{"n":2}'],
        ['json/VTANR5L17V3.json', '{"n":3}'],
      ]);
    }
  });

  it("ne renvoie rien quand aucune entrée n'est acceptée", () => {
    expect([...entreesZip(zip, () => false)]).toEqual([]);
  });
});

describe('entreesDossier et ouvrirArchives (fixtures)', () => {
  let racine: string;
  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'donnees-fixtures-'));
    mkdirSync(join(racine, 'json', 'scrutins'), { recursive: true });
    mkdirSync(join(racine, 'json', 'acteur'));
    mkdirSync(join(racine, 'json', 'organe'));
    writeFileSync(join(racine, 'json', 'scrutins', 'VTANR5L17V2.json'), '{"s":2}');
    writeFileSync(join(racine, 'json', 'scrutins', 'VTANR5L17V1.json'), '{"s":1}');
    writeFileSync(join(racine, 'json', 'acteur', 'PA1.json'), '{"a":1}');
    writeFileSync(join(racine, 'json', 'organe', 'PO1.json'), '{"o":1}');
    writeFileSync(join(racine, 'LISEZMOI.md'), 'ignoré');
  });
  afterEach(() => rmSync(racine, { recursive: true, force: true }));

  it('lit les fichiers du dossier avec des noms relatifs en « / »', () => {
    const noms = [...entreesDossier(racine, () => true)].map(([nom]) => nom);
    expect(noms).toEqual([
      'LISEZMOI.md',
      'json/acteur/PA1.json',
      'json/organe/PO1.json',
      'json/scrutins/VTANR5L17V1.json',
      'json/scrutins/VTANR5L17V2.json',
    ]);
  });

  it("ouvre les fixtures comme une source : scrutins d'un côté, acteurs et organes de l'autre", async () => {
    const archives = await ouvrirArchives({ depuis: 'fixtures', fixtures: racine });
    expect([...archives.scrutins()].map(([nom]) => nom)).toEqual([
      'json/scrutins/VTANR5L17V1.json',
      'json/scrutins/VTANR5L17V2.json',
    ]);
    expect([...archives.acteurs()].map(([nom]) => nom)).toEqual([
      'json/acteur/PA1.json',
      'json/organe/PO1.json',
    ]);
    expect(archives.sources.scrutins).toEqual({
      url: racine.split('\\').join('/'),
      lastModified: null,
      etag: null,
    });
  });

  it('échoue clairement quand le dossier des fixtures manque ou quand la source est inconnue', async () => {
    await expect(
      ouvrirArchives({ depuis: 'fixtures', fixtures: join(racine, 'absent') }),
    ).rejects.toThrow(/fixtures introuvables/);
    await expect(ouvrirArchives({ depuis: 'ailleurs' as never })).rejects.toThrow(
      /source inconnue/,
    );
  });
});

describe('ouvrirArchives (officiel)', () => {
  it("télécharge les deux archives de l'Assemblée, chacune dans son dossier de cache", async () => {
    const cache = mkdtempSync(join(tmpdir(), 'donnees-officiel-'));
    try {
      const scrutins = zipVolumineux({ 'json/VTANR5L17V1.json': '{"s":1}' });
      const acteurs = zipVolumineux({
        'json/acteur/PA1.json': '{"a":1}',
        'json/organe/PO1.json': '{"o":1}',
        'json/deport/D1.json': '{}',
      });
      const demandees: string[] = [];
      const requete = async (url: string) => {
        demandees.push(url);
        return reponse(url === URL_SCRUTINS ? scrutins : acteurs, 200, {
          etag: `"${demandees.length}"`,
        });
      };

      const archives = await ouvrirArchives({ depuis: 'officiel', cache, fetch: requete as never });

      expect(demandees.sort()).toEqual([URL_ACTEURS, URL_SCRUTINS].sort());
      expect(readdirSync(cache).sort()).toEqual(['acteurs', 'scrutins']);
      expect([...archives.scrutins()].map(([nom]) => nom)).toEqual(['json/VTANR5L17V1.json']);
      expect([...archives.acteurs()].map(([nom]) => nom).sort()).toEqual([
        'json/acteur/PA1.json',
        'json/organe/PO1.json',
      ]);
      expect(archives.sources.scrutins.url).toBe(URL_SCRUTINS);
      expect(archives.sources.acteurs.url).toBe(URL_ACTEURS);
    } finally {
      rmSync(cache, { recursive: true, force: true });
    }
  });

  it('pointe vers les URL du plan (data.assemblee-nationale.fr, 17ᵉ législature)', () => {
    expect(URL_SCRUTINS).toBe(
      'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip',
    );
    expect(URL_ACTEURS).toBe(
      'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip',
    );
  });
});
