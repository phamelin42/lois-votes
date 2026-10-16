import { genererRobots, genererSitemap } from './seo';

const BASE = 'https://quiavotequi.phamelin.fr';

describe('robots.txt', () => {
  it('autorise tout et pointe vers le sitemap', () => {
    const robots = genererRobots(BASE);

    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/quiavotequi\.phamelin\.fr\/sitemap\.xml$/m);
    expect(robots).not.toMatch(/Disallow: \/\s*$/m);
  });
});

describe('sitemap.xml', () => {
  const sitemap = () =>
    genererSitemap(BASE, {
      lois: [{ dossier: 'DLR5L17N1110', date: '2025-04-21T22:00:00+00:00' }],
      deputes: [{ slug: 'alice-durand' }, { slug: 'elodie-roux' }],
    });

  it('est un document sitemap valide', () => {
    const xml = sitemap();

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
  });

  it('liste les pages fixes, les lois et les députés avec des URL absolues', () => {
    const emplacements = Array.from(sitemap().matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);

    expect(emplacements).toEqual(
      expect.arrayContaining([
        `${BASE}/`,
        `${BASE}/deputes`,
        `${BASE}/a-propos`,
        `${BASE}/lois/DLR5L17N1110`,
        `${BASE}/deputes/alice-durand`,
        `${BASE}/deputes/elodie-roux`,
      ]),
    );
    expect(new Set(emplacements).size).toBe(emplacements.length);
  });

  it('donne la date de dernière modification d\'une loi', () => {
    expect(sitemap()).toMatch(/<loc>[^<]*\/lois\/DLR5L17N1110<\/loc>\s*<lastmod>2025-04-21/);
  });

  it('échappe les caractères spéciaux XML', () => {
    const xml = genererSitemap(BASE, { lois: [], deputes: [{ slug: 'a&b<c' }] });

    expect(xml).not.toContain('a&b<c');
    expect(xml).toContain('a&amp;b&lt;c');
  });
});
