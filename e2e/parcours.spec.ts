import { expect, test } from '@playwright/test';
import { attendreHydratation } from './aide';

// Le jeu de données de ces tests est celui des fixtures officielles (src/server/fixtures/officiel) : 19 scrutins,
// dont 11 votes finaux, regroupés en 10 cartes sur l'accueil (le projet de loi n°53980 a deux votes finaux).
test.describe('parcours complet', () => {
  test("accueil → loi → liste nominative → député → recherche d'un autre député", async ({
    page,
  }) => {
    // Accueil : les dernières lois votées, la plus récente d'abord
    await page.goto('/');
    await attendreHydratation(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      "Les dernières lois votées à l'Assemblée",
    );
    const cartes = page.locator('app-loi-card');
    await expect(cartes).toHaveCount(10);
    await expect(cartes.first()).toContainText('Proposition de loi organique visant à adapter');
    await expect(cartes.first()).toContainText(/Adopté|Rejeté par l'Assemblée/);
    await expect(page.getByRole('button', { name: 'Voir plus' })).toHaveCount(0);

    // Un vote final sans dossier mène à son scrutin, jamais à une page de loi vide
    await expect(
      cartes.filter({ hasText: "droit à l'aide à mourir" }).locator('a[href="/scrutins/5729"]'),
    ).toHaveCount(1);

    // Loi : le vote final, le tableau par groupe
    await page.locator('app-loi-card', { hasText: 'réponses immédiates' }).click();
    await expect(page).toHaveURL('/lois/DLR5L17N53980');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Projet de loi visant à offrir des réponses immédiates',
    );
    await expect(page.getByText("Adopté par l'Assemblée").first()).toBeVisible();
    const tableau = page.getByRole('table', { name: 'Vote par groupe' });
    await expect(tableau).toBeVisible();
    await expect(tableau.getByRole('row', { name: /RN.*Pour/ })).toBeVisible();
    await expect(tableau.getByRole('row', { name: /LFI-NFP.*Contre/ })).toBeVisible();

    // Liste nominative, chargée à la demande
    await page.getByRole('button', { name: 'Voir comment chaque député a voté' }).click();
    await page.getByRole('tab', { name: /Abstention/ }).click(); // Stella Dupont (non inscrite) s'est abstenue
    await page.getByRole('link', { name: 'Stella Dupont' }).first().click();

    // Député : photo ou initiales, groupe actuel, chiffres clés, 10 derniers votes
    await expect(page).toHaveURL('/deputes/stella-dupont');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stella Dupont');
    await expect(page.getByText('Non inscrit', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Participation aux scrutins')).toBeVisible();
    await expect(page.getByText(/\d+\s?%/).first()).toBeVisible();
    await expect(page.getByText("Taux d'abstention")).toBeVisible();
    await expect(page.getByText("Calculé d'après les scrutins publics").first()).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await expect(page.getByText('Différent de son groupe').first()).toBeVisible();

    // Recherche d'un autre député depuis l'en-tête : ouvre son profil
    const recherche = page.getByRole('combobox');
    await recherche.fill('jerome');
    await expect(page.getByRole('option', { name: /Jérôme Guedj/ })).toBeVisible();
    await recherche.press('ArrowDown');
    await recherche.press('Enter');
    await expect(page).toHaveURL('/deputes/jerome-guedj');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jérôme Guedj');
  });

  test("la page des députés se filtre par l'URL", async ({ page }) => {
    await page.goto('/deputes?groupe=RN&dept=30');
    await attendreHydratation(page);

    await expect(page.locator('.app-depute-carte')).toHaveCount(2);
    await expect(page.locator('.app-depute-carte').first()).toContainText('Yoann Gillet');
    await expect(page.locator('.app-depute-carte').nth(1)).toContainText('Nicolas Meizonnet');
  });

  test('le filtre par groupe parle en abrégés : les deux organes « UDR » sont confondus', async ({
    page,
  }) => {
    await page.goto('/deputes?groupe=UDR');
    await attendreHydratation(page);

    await expect(page.locator('.app-depute-carte')).toHaveCount(7);
    await expect(page.locator('.app-depute-carte', { hasText: 'Éric Ciotti' })).toBeVisible();
  });

  test('une recherche à un seul résultat atterrit sur le profil', async ({ page }) => {
    await page.goto('/recherche?q=jerome');

    await expect(page).toHaveURL('/deputes/jerome-guedj');
  });

  test('une loi à plusieurs lectures liste la lecture précédente', async ({ page }) => {
    await page.goto('/lois/DLR5L17N53980');
    await attendreHydratation(page);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Lectures précédentes' }),
    ).toBeVisible();
    await page.locator('a[href="/scrutins/8279"]').click();
    await expect(page).toHaveURL('/scrutins/8279');
  });
});
