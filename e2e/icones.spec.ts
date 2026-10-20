import { expect, test } from '@playwright/test';

// Icônes du site (public/) : servies à la racine, avec leur type et un jour de cache (pas « immutable »),
// déclarées dans le HTML rendu par le serveur (c'est ce que lit Googlebot, voir docs/ICONE.md).
const FICHIERS = [
  { chemin: '/favicon.ico', type: /^image\/(x-icon|vnd\.microsoft\.icon)$/, debut: [0, 0, 1, 0] },
  { chemin: '/favicon.svg', type: /^image\/svg\+xml$/, debut: [0x3c, 0x73, 0x76, 0x67] },
  { chemin: '/apple-touch-icon.png', type: /^image\/png$/, debut: [0x89, 0x50, 0x4e, 0x47] },
  { chemin: '/icon-48.png', type: /^image\/png$/, debut: [0x89, 0x50, 0x4e, 0x47] },
  { chemin: '/icon-192.png', type: /^image\/png$/, debut: [0x89, 0x50, 0x4e, 0x47] },
  { chemin: '/icon-512.png', type: /^image\/png$/, debut: [0x89, 0x50, 0x4e, 0x47] },
  { chemin: '/site.webmanifest', type: /^application\/manifest\+json/, debut: [0x7b] },
] as const;

test.describe('fichiers des icônes', () => {
  for (const { chemin, type, debut } of FICHIERS) {
    test(`${chemin} : 200, bon type, un jour de cache, pas la page 404`, async ({ request }) => {
      const reponse = await request.get(chemin);

      expect(reponse.status()).toBe(200);
      expect(reponse.headers()['content-type']).toMatch(type);
      expect(reponse.headers()['cache-control']).toBe('public, max-age=86400');
      expect(reponse.headers()['cache-control']).not.toMatch(/immutable/);
      const corps = await reponse.body();
      expect([...corps.subarray(0, debut.length)]).toEqual(debut);
    });
  }

  test('le site « sans données » les sert aussi (ce sont des fichiers, pas des données)', async ({
    request,
  }) => {
    const reponse = await request.get('http://localhost:4001/favicon.ico');

    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['content-type']).toMatch(/^image\//);
  });

  test("le manifeste cite des icônes qu'on peut télécharger", async ({ request }) => {
    const manifeste = (await (await request.get('/site.webmanifest')).json()) as {
      icons: { src: string }[];
    };

    expect(manifeste.icons.length).toBeGreaterThan(0);
    for (const { src } of manifeste.icons) {
      expect((await request.get(src)).status(), src).toBe(200);
    }
  });

  test('les fichiers hachés du build restent « immutable » un an', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const feuille = /styles-[A-Za-z0-9_-]+\.css/.exec(html)?.[0];
    expect(feuille).toBeTruthy();

    const reponse = await request.get(`/${feuille}`);

    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test("robots.txt n'interdit pas les icônes (Googlebot-Image doit pouvoir les lire)", async ({
    request,
  }) => {
    const robots = await (await request.get('/robots.txt')).text();

    expect(robots).not.toMatch(/Disallow:\s*\S/i);
  });
});

test.describe('balises dans le HTML de la page d’accueil (JavaScript désactivé)', () => {
  test.use({ javaScriptEnabled: false });

  test('le serveur écrit les liens vers les icônes, le manifeste et theme-color', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('link[rel="icon"][href="/favicon.ico"][sizes="48x48"]')).toHaveCount(
      1,
    );
    await expect(
      page.locator('link[rel="icon"][href="/favicon.svg"][type="image/svg+xml"][sizes="any"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('link[rel="apple-touch-icon"][href="/apple-touch-icon.png"]'),
    ).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"][href="/site.webmanifest"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F5B1C5');
  });

  test('les mêmes balises sont dans le texte brut de la réponse, sans exécuter le moindre script', async ({
    request,
  }) => {
    const html = await (await request.get('/')).text();

    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico" sizes="48x48"/);
    expect(html).toMatch(
      /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" sizes="any"/,
    );
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
    expect(html).toMatch(/<link rel="manifest" href="\/site\.webmanifest"/);
  });
});

test.describe('politique de sécurité', () => {
  test('la CSP laisse passer les icônes et le manifeste (same-origin)', async ({
    page,
    request,
  }) => {
    const csp = (await request.get('/')).headers()['content-security-policy'];
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/img-src 'self'/);
    expect(csp).not.toMatch(/manifest-src/);

    const violations: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    await page.goto('/');
    const chargees = await page.evaluate(() =>
      Promise.all(
        ['/favicon.svg', '/apple-touch-icon.png'].map(
          (src) =>
            new Promise<boolean>((resolve) => {
              const image = new Image();
              image.onload = () => resolve(image.naturalWidth > 0);
              image.onerror = () => resolve(false);
              image.src = src;
            }),
        ),
      ),
    );

    expect(chargees).toEqual([true, true]);
    expect(violations).toEqual([]);
  });
});
