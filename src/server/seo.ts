/** robots.txt et sitemap.xml : fonctions pures, le serveur fournit l'adresse du site et les données. */

export interface EntreesSitemap {
  /** Lois récentes : dossier et date de leur dernier vote (ISO). */
  lois: { dossier: string; date: string }[];
  /** Index des députés actifs. */
  deputes: { slug: string }[];
}

const ESPACES_XML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const echapperXml = (valeur: string): string => valeur.replace(/[&<>"']/g, (c) => ESPACES_XML[c]);

export function genererRobots(base: string): string {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n');
}

export function genererSitemap(base: string, { lois, deputes }: EntreesSitemap): string {
  const adresses: { loc: string; lastmod?: string }[] = [
    { loc: `${base}/` },
    { loc: `${base}/deputes` },
    { loc: `${base}/a-propos` },
    ...lois.map((loi) => ({ loc: `${base}/lois/${loi.dossier}`, lastmod: loi.date.slice(0, 10) })),
    ...deputes.map((depute) => ({ loc: `${base}/deputes/${depute.slug}` })),
  ];

  const entrees = adresses.map(({ loc, lastmod }) => {
    const date = lastmod ? `<lastmod>${echapperXml(lastmod)}</lastmod>` : '';
    return `  <url><loc>${echapperXml(loc)}</loc>${date}</url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entrees,
    '</urlset>',
    '',
  ].join('\n');
}
