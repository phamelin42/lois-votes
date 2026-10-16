import { expect, test } from '@playwright/test';

// Sans JavaScript, le contenu doit déjà être dans le HTML, avec le bon statut.
test.describe('rendu serveur (JavaScript désactivé)', () => {
  test.use({ javaScriptEnabled: false });

  test('accueil : titre, cartes et chiffres écrits', async ({ page }) => {
    const reponse = await page.goto('/');

    expect(reponse!.status()).toBe(200);
    await expect(page).toHaveTitle(/Qui a voté quoi \?/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('app-loi-card')).toHaveCount(10);
    await expect(page.locator('app-loi-card').first()).toContainText(/\d+ pour/);
  });

  test('loi : titre, vote final et tableau par groupe', async ({ page }) => {
    const reponse = await page.goto('/lois/DLR5L17N1110');

    expect(reponse!.status()).toBe(200);
    await expect(page).toHaveTitle(/sobriété foncière/);
    await expect(page.getByRole('table', { name: 'Vote par groupe' })).toBeVisible();
  });

  test('député : nom, chiffres clés et votes', async ({ page }) => {
    const reponse = await page.goto('/deputes/david-moreau');

    expect(reponse!.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('David Moreau');
    await expect(page.getByText('Participation aux scrutins')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(10);
  });

  test('la recherche fonctionne sans JavaScript', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox').fill('abeilles');
    await page.getByRole('combobox').press('Enter');

    await expect(page).toHaveURL(/\/recherche\?q=abeilles/);
    await expect(page.getByRole('link', { name: /protéger les abeilles/ })).toBeVisible();
  });

  test('la recherche à un seul résultat redirige en 302', async ({ request }) => {
    const reponse = await request.get('/recherche?q=elodie', { maxRedirects: 0 });

    expect(reponse.status()).toBe(302);
    expect(reponse.headers()['location']).toBe('/deputes/elodie-roux');
  });

  test('les pages inconnues répondent 404', async ({ request }) => {
    expect((await request.get('/lois/DLR5L17N0')).status()).toBe(404);
    expect((await request.get('/deputes/personne-inconnue')).status()).toBe(404);
    expect((await request.get('/scrutins/999999')).status()).toBe(404);
    expect((await request.get('/n-importe-quoi')).status()).toBe(404);
  });

  test('/a-propos est pré-rendue', async ({ request }) => {
    const reponse = await request.get('/a-propos');

    expect(reponse.status()).toBe(200);
    expect(await reponse.text()).toContain('groupe actuel');
  });

  test('robots.txt et sitemap.xml existent', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    const sitemap = await request.get('/sitemap.xml');

    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Sitemap:');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('xml');
    expect(await sitemap.text()).toContain('/lois/DLR5L17N1110');
  });

  test('les en-têtes de sécurité et de cache sont posés', async ({ request }) => {
    const reponse = await request.get('/');
    const en = reponse.headers();

    expect(en['x-content-type-options']).toBe('nosniff');
    expect(en['content-security-policy']).toContain("default-src 'self'");
    expect(en['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(en['cache-control']).toBe('public, s-maxage=600, stale-while-revalidate=86400');
  });

  test('les routes /api renvoient du JSON avec Cache-Control', async ({ request }) => {
    const reponse = await request.get('/api/lois/DLR5L17N1110');

    expect(reponse.status()).toBe(200);
    expect(reponse.headers()['cache-control']).toContain('s-maxage=3600');
    expect((await reponse.json()).dossier).toBe('DLR5L17N1110');
  });
});
