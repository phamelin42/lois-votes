import { scriptUmami, injecterUmami } from './umami';

describe('mesure d\'audience Umami (sans cookie)', () => {
  it('ne produit aucun script sans UMAMI_WEBSITE_ID', () => {
    expect(scriptUmami({})).toBe('');
    expect(scriptUmami({ UMAMI_SRC: 'https://stats.exemple.org/script.js' })).toBe('');
  });

  it('produit le script par défaut de cloud.umami.is quand seul l\'identifiant est donné', () => {
    expect(scriptUmami({ UMAMI_WEBSITE_ID: 'abc-123' })).toBe(
      '<script defer src="https://cloud.umami.is/script.js" data-website-id="abc-123"></script>',
    );
  });

  it('utilise UMAMI_SRC quand il est défini', () => {
    expect(scriptUmami({ UMAMI_WEBSITE_ID: 'abc', UMAMI_SRC: 'https://stats.exemple.org/u.js' })).toContain(
      'src="https://stats.exemple.org/u.js"',
    );
  });

  it('échappe les valeurs d\'attribut', () => {
    const script = scriptUmami({ UMAMI_WEBSITE_ID: '"><script>alert(1)</script>' });

    expect(script).not.toContain('<script>alert');
    expect(script).toContain('&quot;');
  });

  it('refuse une source qui n\'est pas en https', () => {
    expect(scriptUmami({ UMAMI_WEBSITE_ID: 'abc', UMAMI_SRC: 'javascript:alert(1)' })).toBe('');
    expect(scriptUmami({ UMAMI_WEBSITE_ID: 'abc', UMAMI_SRC: 'http://stats.exemple.org/u.js' })).toBe('');
  });

  it('injecte le script juste avant </head>, et seulement une fois', () => {
    const page = '<html><head><title>x</title></head><body></body></html>';
    const env = { UMAMI_WEBSITE_ID: 'abc' };

    const resultat = injecterUmami(page, env);

    expect(resultat).toMatch(/<script defer src="[^"]+" data-website-id="abc"><\/script><\/head>/);
    expect(injecterUmami(resultat, env)).toBe(resultat);
  });

  it('laisse la page intacte sans identifiant', () => {
    const page = '<html><head></head><body></body></html>';

    expect(injecterUmami(page, {})).toBe(page);
  });
});
