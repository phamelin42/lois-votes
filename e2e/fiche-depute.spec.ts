import { expect, test, type Page } from '@playwright/test';
import { attendreHydratation, choisirTheme, verifierAxe, type Theme } from './aide';

// Fiche enrichie (état civil, mandats, liens externes) et photos dans la liste des députés.
// Les photos viennent du site de l'Assemblée : les tests n'utilisent aucun réseau externe, ils servent eux-mêmes l'image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PHOTOS = 'https://www.assemblee-nationale.fr/**';

async function servirLesPhotos(page: Page, charger: boolean) {
  await page.route(PHOTOS, (route) =>
    charger ? route.fulfill({ contentType: 'image/png', body: PNG }) : route.abort(),
  );
}

test.describe('fiche d’un député, sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('Sébastien Chenu : son profil est écrit dans le HTML', async ({ page }) => {
    const reponse = await page.goto('/deputes/sebastien-chenu');

    expect(reponse!.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sébastien Chenu');
    await expect(page.getByRole('heading', { level: 2, name: 'Informations' })).toBeVisible();
    const profil = page.locator('app-depute-profil');
    await expect(profil).toContainText(/Naissance\s*13 avril 1973 \(\d+ ans\), à Beauvais/);
    await expect(profil).toContainText('Conseiller en communication');
    await expect(profil).toContainText('Nord (19)');
    await expect(profil).toContainText('En cours depuis le 30 juin 2024');
    await expect(profil).toContainText('15ᵉ, 16ᵉ et 17ᵉ législatures');
    await expect(profil).toContainText(
      "Vice-président de l'Assemblée nationale, depuis le 1 octobre 2025",
    );
    await expect(profil).toContainText(
      'Membre, Commission des affaires étrangères, depuis le 20 juillet 2024',
    );
    await expect(profil).toContainText('Non inscrit (NI), du 1 juillet 2024 au 18 juillet 2024');
    await expect(profil).toContainText('Rassemblement National (RN), depuis le 19 juillet 2024');
    await expect(profil).toContainText('Parti de rattachement');
    await expect(profil).not.toContainText(/\bnée?\b/i);
  });

  test('Sébastien Chenu : ses liens externes, chacun dans un nouvel onglet', async ({ page }) => {
    await page.goto('/deputes/sebastien-chenu');
    const liens = page.locator('app-depute-liens a');

    await expect(liens).toHaveCount(5); // pas de site personnel déclaré : pas de lien
    const attendus = [
      ["Fiche à l'Assemblée", 'https://www.assemblee-nationale.fr/dyn/deputes/PA720468'],
      ['Déclarations HATVP', 'https://www.hatvp.fr/pages_nominatives/chenu-sebastien'],
      ['Page Wikipédia', 'https://fr.wikipedia.org/wiki/S%C3%A9bastien_Chenu'],
      ['Compte X', 'https://x.com/sebchenu'],
      ['Page Facebook', 'https://www.facebook.com/chenu.sebastien'],
    ];
    for (const [i, [libelle, href]] of attendus.entries()) {
      const lien = liens.nth(i);
      await expect(lien).toContainText(libelle);
      await expect(lien).toContainText('(nouvel onglet)');
      await expect(lien).toHaveAttribute('href', href);
      await expect(lien).toHaveAttribute('target', '_blank');
      await expect(lien).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect(page.getByRole('link', { name: /Site web/ })).toHaveCount(0);
  });

  test('la source du lien Wikipédia est dite : Wikidata, communautaire, non officielle', async ({
    page,
  }) => {
    await page.goto('/deputes/sebastien-chenu');

    await expect(page.locator('.app-depute__section').first()).toContainText(
      'Wikidata, une source communautaire et non officielle',
    );
  });

  test("un député sans adresse HATVP n'a pas de lien « Déclarations »", async ({ page }) => {
    await page.goto('/deputes/alexandra-martin-gironde');

    await expect(page.getByRole('link', { name: /Déclarations HATVP/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Page Wikipédia/ })).toHaveCount(1);
    await expect(page.locator('a[href*="hatvp.fr"]')).toHaveCount(0);
  });

  test("un ancien député : mandat terminé, ni fonction ni parti, pas d'adresse HATVP", async ({
    page,
  }) => {
    const reponse = await page.goto('/deputes/nicolas-forissier');

    expect(reponse!.status()).toBe(200);
    const profil = page.locator('app-depute-profil');
    await expect(profil).toContainText(/Du 7 juillet 2024 au 12 novembre 2025/);
    await expect(profil).not.toContainText('Parti de rattachement');
    await expect(profil).not.toContainText('Fonction');
    await expect(page.getByRole('link', { name: /Déclarations HATVP/ })).toHaveCount(0);
  });

  test('un député avec un lieu de naissance à l’étranger : le pays est écrit', async ({ page }) => {
    await page.goto('/deputes/jean-louis-roumegas');

    await expect(page.locator('app-depute-profil')).toContainText(/, à Alger \(Algérie\)/);
  });

  test("le titre et la description restent propres : pas d'âge ni de lieu de naissance", async ({
    page,
  }) => {
    await page.goto('/deputes/sebastien-chenu');

    await expect(page).toHaveTitle('Sébastien Chenu · Qui a voté quoi ?');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBe(
      'Participation aux scrutins, abstentions et votes de Sébastien Chenu (Rassemblement National).',
    );
  });

  test('l’API ne publie ni téléphone, ni e-mail, ni adresse postale', async ({ request }) => {
    const texte = await (await request.get('/api/deputes/sebastien-chenu')).text();

    expect(texte).not.toMatch(
      /@assemblee-nationale\.fr|\b0[1-9]([ .]?\d{2}){4}\b|Rue de l'Université|75355/,
    );
    const index = await (await request.get('/api/deputes')).json();
    expect(index.deputes[0].pa).toMatch(/^\d{1,7}$/);
    expect(index.deputes[0]).not.toHaveProperty('photo');
  });

  test('/a-propos cite la HATVP, Wikidata (non officiel) et les photos de l’Assemblée', async ({
    request,
  }) => {
    const texte = await (await request.get('/a-propos')).text();

    expect(texte).toContain('Haute Autorité pour la transparence de la vie publique');
    expect(texte).toContain('Wikidata');
    expect(texte).toContain('communautaire et non officielle');
    expect(texte).toContain('photos et les fiches des députés sont celles du site de l');
  });
});

test.describe('liste des députés : photos', () => {
  test('sans JavaScript, chaque carte porte une image avec son alt et ses dimensions', async ({
    browser,
  }) => {
    const contexte = await browser.newContext({ javaScriptEnabled: false });
    const page = await contexte.newPage();
    await page.goto('/deputes');

    const images = page.locator('.app-depute-carte img');
    await expect(images).toHaveCount(60); // la liste n'en montre que 60 à la fois
    const attributs = await images.evaluateAll((liste) =>
      liste.map((i) => ({
        alt: i.getAttribute('alt'),
        width: i.getAttribute('width'),
        height: i.getAttribute('height'),
        loading: i.getAttribute('loading'),
        decoding: i.getAttribute('decoding'),
        src: i.getAttribute('src'),
        priorite: i.getAttribute('fetchpriority'),
      })),
    );
    for (const a of attributs) {
      expect(a.alt).toBeTruthy();
      expect([a.width, a.height]).toEqual(['64', '64']);
      expect(a.loading).toBe('lazy');
      expect(a.decoding).toBe('async');
      expect(a.src).toMatch(
        /^https:\/\/www\.assemblee-nationale\.fr\/dyn\/static\/tribun\/17\/photos\/carre\/\d+\.jpg$/,
      );
      expect(a.priorite).not.toBe('high');
    }
    await contexte.close();
  });

  test('les images chargées ont 64 px de côté et la carte garde sa hauteur', async ({ page }) => {
    await servirLesPhotos(page, false);
    await page.goto('/deputes');
    await attendreHydratation(page);
    await expect(page.locator('.app-depute-carte').first()).toBeVisible();
    // Images en échec : les initiales prennent la place de la photo.
    await expect(page.locator('.app-depute-carte fd-avatar').first()).toBeVisible();
    const hauteursSansPhoto = await page
      .locator('.app-depute-carte')
      .evaluateAll((cartes) =>
        cartes.slice(0, 12).map((c) => Math.round(c.getBoundingClientRect().height)),
      );

    await page.unroute(PHOTOS);
    await servirLesPhotos(page, true);
    await page.reload();
    await attendreHydratation(page);
    const premiere = page.locator('.app-depute-carte img').first();
    await expect
      .poll(() => premiere.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);

    const boite = await premiere.boundingBox();
    expect([boite!.width, boite!.height]).toEqual([64, 64]);
    const hauteursAvecPhoto = await page
      .locator('.app-depute-carte')
      .evaluateAll((cartes) =>
        cartes.slice(0, 12).map((c) => Math.round(c.getBoundingClientRect().height)),
      );
    expect(hauteursAvecPhoto).toEqual(hauteursSansPhoto);
  });

  test('une image qui échoue laisse les initiales, sans casser la carte', async ({ page }) => {
    await servirLesPhotos(page, false);
    await page.goto('/deputes');
    await attendreHydratation(page);

    const carte = page.locator('.app-depute-carte').first();
    await expect(carte.locator('img')).toHaveCount(0);
    await expect(carte.locator('fd-avatar')).toBeVisible();
    await expect(carte.getByRole('link')).toBeVisible();
  });
});

for (const theme of ['jour', 'nuit'] as Theme[]) {
  test.describe(`axe — fiche enrichie et photos, thème ${theme}`, () => {
    for (const [nom, chemin] of [
      ['fiche d’un député', '/deputes/sebastien-chenu'],
      ['fiche d’un ancien député', '/deputes/nicolas-forissier'],
      ['liste des députés avec photos', '/deputes'],
    ]) {
      test(`${nom} (${chemin})`, async ({ page }) => {
        await servirLesPhotos(page, true);
        await choisirTheme(page, theme);
        await page.goto(chemin);
        await attendreHydratation(page);
        await expect(page.locator('img').first()).toBeVisible();

        await verifierAxe(page);
      });
    }
  });
}
