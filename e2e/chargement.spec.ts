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

    await page.goto('/lois/DLR5L17N54445');
    await attendreHydratation(page);
    expect(appels).toEqual([]); // seul le rendu serveur a interrogé le BFF
  });

  test("sans page suivante, l'accueil ne propose pas « Voir plus » et ne fait aucune requête", async ({
    page,
  }) => {
    const appels: string[] = [];
    page.on('request', (r) => estApi(r.url()) && appels.push(new URL(r.url()).pathname));

    await page.goto('/');
    await attendreHydratation(page);

    await expect(page.locator('app-loi-card')).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Voir plus' })).toHaveCount(0);
    expect(appels).toEqual([]);
  });

  test("le survol d'une carte précharge le code de la route et les données de la loi", async ({
    page,
  }) => {
    await page.goto('/');
    await attendreHydratation(page);
    const apres: string[] = [];
    page.on('request', (r) => apres.push(new URL(r.url()).pathname));

    await page.locator('app-loi-card').nth(1).hover();

    await expect.poll(() => apres.some((p) => p.startsWith('/api/lois/DLR5L17N54776'))).toBe(true);
    expect(page.url()).toMatch(/\/$/); // on n'a pas navigué : seulement préchargé
  });

  test('le code de la page cible est déjà préchargé : naviguer ne le redemande pas', async ({
    page,
  }) => {
    await page.goto('/');
    await attendreHydratation(page);
    await page.waitForTimeout(1500); // le pré-chargement attend un moment d'inactivité du navigateur
    const chargesApresClic: Promise<string>[] = [];
    page.on('response', (r) => {
      if (r.request().resourceType() === 'script') chargesApresClic.push(r.text().catch(() => ''));
    });

    await page.getByRole('link', { name: 'Députés' }).click();
    await expect(page).toHaveURL('/deputes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // D'autres routes (profil, à propos) peuvent se précharger à l'arrivée : seule la page cible compte.
    const corps = await Promise.all(chargesApresClic);
    expect(corps.filter((code) => code.includes('app-deputes-page'))).toEqual([]);
  });

  test("les blocs différés sous la ligne de flottaison ne chargent rien avant d'être visibles", async ({
    page,
  }) => {
    await page.goto('/lois/DLR5L17N54445');
    await attendreHydratation(page);

    const scrutins = page
      .waitForRequest((r) => new URL(r.url()).pathname === '/api/scrutins/8693', { timeout: 1500 })
      .then(
        () => true,
        () => false,
      );
    expect(await scrutins).toBe(false);

    await page.getByRole('button', { name: 'Voir comment chaque député a voté' }).click();
    await expect(page.getByRole('link', { name: 'Jérôme Guedj' }).first()).toBeVisible();
  });

  test('la photo du député est le LCP : chargée en priorité dès le HTML rendu par le serveur', async ({
    request,
  }) => {
    const html = await (await request.get('/deputes/jerome-guedj')).text();

    expect(html).toMatch(/<img[^>]*fetchpriority="high"/);
  });

  test("le navigateur ne parle qu'à notre serveur, et au site de l'Assemblée pour les photos", async ({
    page,
  }) => {
    const hotes = new Set<string>();
    page.on('request', (r) => hotes.add(new URL(r.url()).hostname));

    await page.goto('/');
    await attendreHydratation(page);
    await page.goto('/deputes/jerome-guedj');
    await attendreHydratation(page);

    expect(
      [...hotes].filter((h) => h !== 'localhost' && h !== 'www.assemblee-nationale.fr'),
    ).toEqual([]);
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
