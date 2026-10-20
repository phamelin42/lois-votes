import { createHash } from 'node:crypto';
import {
  cacheControlFichier,
  cacheControlPage,
  enTetesSecurite,
  FICHIERS_PUBLICS,
} from './en-tetes';

describe('en-têtes de sécurité', () => {
  const hash = (script: string) => `'sha256-${createHash('sha256').update(script).digest('base64')}'`;

  it('pose les en-têtes de base', () => {
    const e = enTetesSecurite({});

    expect(e['X-Content-Type-Options']).toBe('nosniff');
    expect(e['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(e['Permissions-Policy']).toMatch(/camera=\(\)/);
    expect(e['Permissions-Policy']).toMatch(/geolocation=\(\)/);
  });

  it('a une CSP qui interdit tout par défaut', () => {
    const csp = enTetesSecurite({})['Content-Security-Policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('autorise les scripts en ligne par empreinte, jamais par unsafe-inline', () => {
    const csp = enTetesSecurite({ scriptsEnLigne: ["document.x = 1;"] })['Content-Security-Policy'];
    const directive = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'))!;

    expect(directive).toContain(hash('document.x = 1;'));
    expect(directive).not.toContain("'unsafe-inline'");
    expect(directive).not.toContain("'unsafe-eval'");
  });

  it('autorise les photos de l\'Assemblée nationale', () => {
    const csp = enTetesSecurite({})['Content-Security-Policy'];
    const img = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('img-src'))!;

    expect(img).toContain('https://www.assemblee-nationale.fr');
  });

  it('n\'autorise Umami que lorsqu\'il est configuré', () => {
    const sans = enTetesSecurite({})['Content-Security-Policy'];
    const avec = enTetesSecurite({ umamiSrc: 'https://cloud.umami.is/script.js' })['Content-Security-Policy'];

    expect(sans).not.toContain('umami');
    expect(avec).toContain('https://cloud.umami.is');
    const connect = avec.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'))!;
    expect(connect).toContain('https://cloud.umami.is');
  });

  it('autorise les styles de composants (Angular injecte des <style>)', () => {
    const csp = enTetesSecurite({})['Content-Security-Policy'];

    expect(csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('style-src'))).toBeDefined();
  });
});

describe('Cache-Control des pages HTML', () => {
  it('met en cache une page rendue : 10 min en CDN, 1 jour de stale-while-revalidate', () => {
    expect(cacheControlPage(200)).toBe('public, s-maxage=600, stale-while-revalidate=86400');
  });

  it('ne met jamais en cache une indisponibilité ni une redirection de recherche', () => {
    expect(cacheControlPage(503)).toBe('no-store');
    expect(cacheControlPage(302)).toBe('no-store');
  });
});

describe('cacheControlFichier', () => {
  it.each(FICHIERS_PUBLICS)(
    'garde %s un jour, sans immutable : son adresse ne change pas',
    (fichier) => {
      expect(cacheControlFichier(fichier)).toBe('public, max-age=86400');
    },
  );

  it('garde un an, immutable, les fichiers hachés du build', () => {
    for (const fichier of [
      'main-ZWXZAP55.js',
      'styles-NJ2HFDJT.css',
      'media/zen-maru-gothic-latin-500-normal.woff2',
    ]) {
      expect(cacheControlFichier(fichier)).toBe('public, max-age=31536000, immutable');
    }
  });

  it("ne confond pas un fichier d'un sous-dossier avec un fichier de la racine", () => {
    expect(cacheControlFichier('media/favicon.ico')).toBe('public, max-age=31536000, immutable');
    expect(cacheControlFichier('a-propos/favicon.ico')).toBe('public, max-age=31536000, immutable');
  });
});
