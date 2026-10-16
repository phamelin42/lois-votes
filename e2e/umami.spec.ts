import { expect, test } from '@playwright/test';

// Le site de test (port 4000) tourne sans UMAMI_WEBSITE_ID ; celui de 4002 avec (voir playwright.config.ts).
test.describe('Umami', () => {
  test('aucun script de mesure sans identifiant', async ({ request }) => {
    const html = await (await request.get('/')).text();

    expect(html).not.toContain('umami');
  });

  test('le script est ajouté dans <head> quand l\'identifiant est défini', async ({ request }) => {
    const html = await (await request.get('http://localhost:4002/')).text();

    expect(html).toMatch(/<script defer src="https:\/\/cloud\.umami\.is\/script\.js" data-website-id="site-de-test"><\/script>/);
    expect(html.indexOf('umami')).toBeLessThan(html.indexOf('</head>'));
  });
});
