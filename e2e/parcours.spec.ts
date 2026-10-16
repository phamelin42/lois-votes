import { expect, test } from '@playwright/test';
import { attendreHydratation } from './aide';

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
    await expect(cartes.first()).toContainText('au sujet n°111');
    await expect(cartes.first()).toContainText(/Adopté|Rejeté par l'Assemblée/);

    // « Voir plus » ajoute les 4 cartes restantes sans remplacer les premières
    await page.getByRole('button', { name: 'Voir plus' }).click();
    await expect(cartes).toHaveCount(14);
    await expect(page.getByRole('button', { name: 'Voir plus' })).toHaveCount(0);
    await expect(page).toHaveURL('/');

    // Loi : le vote final, le tableau par groupe
    await page.locator('app-loi-card', { hasText: 'sobriété foncière' }).click();
    await expect(page).toHaveURL('/lois/DLR5L17N1110');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Projet de loi relatif à la sobriété foncière',
    );
    await expect(page.getByText("Rejeté par l'Assemblée").first()).toBeVisible();
    const tableau = page.getByRole('table', { name: 'Vote par groupe' });
    await expect(tableau).toBeVisible();
    await expect(tableau.getByRole('row', { name: /RN.*Pour/ })).toBeVisible();

    // Liste nominative, chargée à la demande
    await page.getByRole('button', { name: 'Voir comment chaque député a voté' }).click();
    await page.getByRole('tab', { name: /Abstention/ }).click(); // David Moreau s'est abstenu sur ce scrutin
    await page.getByRole('link', { name: 'David Moreau' }).first().click();

    // Député : photo ou initiales, parti, chiffres clés, 10 derniers votes
    await expect(page).toHaveURL('/deputes/david-moreau');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('David Moreau');
    await expect(page.getByText('Rassemblement National').first()).toBeVisible();
    await expect(page.getByText('Participation aux scrutins')).toBeVisible();
    await expect(page.getByText(/93\s?%/)).toBeVisible();
    await expect(page.getByText("Taux d'abstention")).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await expect(page.getByText('Différent de son groupe').first()).toBeVisible();

    // Recherche d'un autre député depuis l'en-tête : ouvre son profil
    const recherche = page.getByRole('combobox');
    await recherche.fill('elodie');
    await expect(page.getByRole('option', { name: /Élodie Roux/ })).toBeVisible();
    await recherche.press('ArrowDown');
    await recherche.press('Enter');
    await expect(page).toHaveURL('/deputes/elodie-roux');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Élodie Roux');
  });

  test("la page des députés se filtre par l'URL", async ({ page }) => {
    await page.goto('/deputes?groupe=RN&dept=69');
    await attendreHydratation(page);

    await expect(page.locator('.app-depute-carte')).toHaveCount(1);
    await expect(page.locator('.app-depute-carte')).toContainText('Alice Durand');
  });

  test('une recherche à un seul résultat atterrit sur le profil', async ({ page }) => {
    await page.goto('/recherche?q=elodie');

    await expect(page).toHaveURL('/deputes/elodie-roux');
  });

  test('une loi à plusieurs lectures liste la lecture précédente', async ({ page }) => {
    await page.goto('/lois/DLR5L17N2000');
    await attendreHydratation(page);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Lectures précédentes' }),
    ).toBeVisible();
    await page.locator('a[href="/scrutins/90"]').click();
    await expect(page).toHaveURL('/scrutins/90');
  });
});
