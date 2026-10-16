import { createHash } from 'node:crypto';

export interface OptionsSecurite {
  /** Contenu exact des scripts en ligne de la page (index.html) : chacun est autorisé par son empreinte. */
  scriptsEnLigne?: string[];
  /** Adresse du script Umami, quand la mesure d'audience est configurée. */
  umamiSrc?: string;
}

const empreinte = (script: string): string =>
  `'sha256-${createHash('sha256').update(script).digest('base64')}'`;

/** Origine d'une adresse (`https://cloud.umami.is/script.js` → `https://cloud.umami.is`). */
const origine = (adresse: string): string => new URL(adresse).origin;

/** Umami Cloud envoie les mesures à sa passerelle, et non à l'origine de son script. */
const PASSERELLE_UMAMI_CLOUD = 'https://gateway.umami.is';

/**
 * En-têtes de sécurité posés sur chaque réponse. Pas de `unsafe-inline` pour les scripts : le script de
 * thème de index.html est autorisé par son empreinte. Les photos viennent de l'Assemblée nationale.
 */
export function enTetesSecurite({
  scriptsEnLigne = [],
  umamiSrc,
}: OptionsSecurite): Record<string, string> {
  const umami = umamiSrc ? [origine(umamiSrc)] : [];
  const envoiUmami =
    umamiSrc && origine(umamiSrc) === 'https://cloud.umami.is' ? [PASSERELLE_UMAMI_CLOUD] : [];
  const directives = [
    "default-src 'self'",
    ["script-src 'self'", ...scriptsEnLigne.map(empreinte), ...umami].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://www.assemblee-nationale.fr",
    "font-src 'self'",
    ["connect-src 'self'", ...umami, ...envoiUmami].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  return {
    'Content-Security-Policy': directives.join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}

/**
 * Cache-Control d'une page HTML : une page rendue est gardée 10 min par le CDN, avec 1 jour de
 * stale-while-revalidate. Une indisponibilité ou une redirection ne se met jamais en cache.
 */
export function cacheControlPage(statut: number): string {
  return statut === 200 ? 'public, s-maxage=600, stale-while-revalidate=86400' : 'no-store';
}

/**
 * Contenu des scripts en ligne exécutables d'un document HTML (ceux qui n'ont pas de `src`, et dont le type
 * est JavaScript). Les blocs de données (`application/json`) ne sont pas exécutés : la CSP ne les concerne pas.
 */
export function extraireScriptsEnLigne(html: string): string[] {
  const scripts: string[] = [];
  for (const [, attributs, contenu] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc\s*=/.test(attributs)) continue;
    const type = /\stype\s*=\s*"([^"]*)"/.exec(attributs)?.[1] ?? 'text/javascript';
    if (type === 'text/javascript' || type === 'module') scripts.push(contenu);
  }
  return scripts;
}
