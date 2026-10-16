import { expect, test } from '@playwright/test';

// Ce fichier tourne contre une 2ᵉ instance du site (port 4001) dont l'API tabulaire répond toujours 500 (voir playwright.config.ts).
test.use({ baseURL: 'http://localhost:4001' });

test.describe('source de données en panne, sans cache', () => {
  test('l\'accueil répond 503 avec une alerte lisible', async ({ page }) => {
    const reponse = await page.goto('/');

    expect(reponse!.status()).toBe(503);
    await expect(page.locator('fd-alert')).toContainText('Données momentanément indisponibles, réessayez dans une minute.');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('une page de loi répond aussi 503 (pas 404)', async ({ request }) => {
    const reponse = await request.get('/lois/DLR5L17N1110');

    expect(reponse.status()).toBe(503);
    expect(reponse.headers()['cache-control']).toContain('no-store');
  });

  test('l\'API répond 503 avec Retry-After et sans cache', async ({ request }) => {
    const reponse = await request.get('/api/deputes');

    expect(reponse.status()).toBe(503);
    expect(reponse.headers()['retry-after']).toBe('60');
    expect(reponse.headers()['cache-control']).toBe('no-store');
    expect(await reponse.json()).toEqual({ erreur: expect.any(String) });
  });

  test('/a-propos reste disponible : elle ne dépend d\'aucune donnée', async ({ request }) => {
    expect((await request.get('/a-propos')).status()).toBe(200);
  });
});
