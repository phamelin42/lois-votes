import { expect, test } from '@playwright/test';
import { attendreHydratation } from './aide';

const estApi = (url: string) => new URL(url).pathname.startsWith('/api/');

test.describe('chargement intelligent', () => {
  test('hydratation : aucune requête /api refaite après le rendu serveur', async ({ page }) => {
    const appels: string[] = [];
    page.on('request', (r) => estApi(r.url()) && appels.push(r.url()));

    await page.goto('/');
    await attendreHydratation(page);
    expect(appels).toEqual([]);

    await page.goto('/lois/DLR5L17N1110');
    await attendreHydratation(page);
    expect(appels).toEqual([]); // seul le rendu serveur a interrogé le BFF
  });

  test('« Voir plus » ne fait qu\'une requête, pour la page suivante', async ({ page }) => {
    await page.goto('/');
    await attendreHydratation(page);
    const appels: string[] = [];
    page.on('request', (r) => estApi(r.url()) && appels.push(new URL(r.url()).pathname + new URL(r.url()).search));

    await page.getByRole('button', { name: 'Voir plus' }).click();
    await expect(page.locator('app-loi-card')).toHaveCount(14);

    expect(appels).toEqual(['/api/accueil?page=2']);
  });

  test('le survol d\'une carte précharge le code de la route et les données de la loi', async ({ page }) => {
    await page.goto('/');
    await attendreHydratation(page);
    const apres: string[] = [];
    page.on('request', (r) => apres.push(new URL(r.url()).pathname));

    await page.locator('app-loi-card').nth(1).hover();

    await expect.poll(() => apres.some((p) => p.startsWith('/api/lois/DLR5L17N1110'))).toBe(true);
    expect(page.url()).toMatch(/\/$/); // on n'a pas navigué : seulement préchargé
  });

  test('le code de la page cible est préchargé quand le lien devient visible', async ({ page }) => {
    const scripts: string[] = [];
    await page.goto('/');
    await attendreHydratation(page);
    page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));

    await page.locator('app-loi-card').first().scrollIntoViewIfNeeded();

    await expect.poll(() => scripts.length, { timeout: 5000 }).toBeGreaterThan(0);
  });

  test('les blocs différés sous la ligne de flottaison ne chargent rien avant d\'être visibles', async ({ page }) => {
    await page.goto('/lois/DLR5L17N1110');
    await attendreHydratation(page);

    const scrutins = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/scrutins/110', { timeout: 1500 }).then(
      () => true,
      () => false,
    );
    expect(await scrutins).toBe(false);

    await page.getByRole('button', { name: 'Voir comment chaque député a voté' }).click();
    await expect(page.getByRole('link', { name: 'Alice Durand' }).first()).toBeVisible();
  });

  test('la photo du député est le LCP : chargée en priorité', async ({ page }) => {
    await page.goto('/deputes/david-moreau');

    await expect(page.locator('img[fetchpriority="high"]')).toHaveCount(1);
  });

  test('le navigateur ne parle jamais à data.gouv.fr', async ({ page }) => {
    const hotes = new Set<string>();
    page.on('request', (r) => hotes.add(new URL(r.url()).hostname));

    await page.goto('/');
    await attendreHydratation(page);
    await page.goto('/deputes/david-moreau');
    await attendreHydratation(page);

    expect([...hotes].filter((h) => h.includes('data.gouv.fr') || h.includes('nosparlementaires') || h.includes('datan'))).toEqual([]);
  });

  test('seules les polices latines sont chargées', async ({ page }) => {
    const polices: string[] = [];
    page.on('request', (r) => r.resourceType() === 'font' && polices.push(r.url()));

    await page.goto('/');
    await attendreHydratation(page);

    expect(polices.length).toBeGreaterThan(0);
    expect(polices.filter((u) => /japanese|kana|kanji|cjk/i.test(u))).toEqual([]);
  });
});
