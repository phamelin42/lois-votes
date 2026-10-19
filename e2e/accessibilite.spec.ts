import { test } from '@playwright/test';
import { PAGES, attendreHydratation, choisirTheme, verifierAxe, type Theme } from './aide';

// Aucune violation tolérée, sur chaque page, en Jour et en Nuit (WCAG 2.2 AA).
for (const theme of ['jour', 'nuit'] as Theme[]) {
  test.describe(`axe — thème ${theme}`, () => {
    for (const { nom, chemin } of PAGES) {
      test(`${nom} (${chemin})`, async ({ page }) => {
        await choisirTheme(page, theme);
        await page.goto(chemin);
        await attendreHydratation(page);

        await verifierAxe(page);
      });
    }
  });
}

test.describe('axe — états ouverts', () => {
  test('liste de recherche ouverte', async ({ page }) => {
    await page.goto('/');
    await attendreHydratation(page);
    await page.getByRole('combobox').fill('a');
    await page.getByRole('listbox').waitFor();

    await verifierAxe(page);
  });

  test('liste nominative dépliée', async ({ page }) => {
    await page.goto('/lois/DLR5L17N54445');
    await attendreHydratation(page);
    await page.getByRole('button', { name: 'Voir comment chaque député a voté' }).click();
    await page.getByRole('link', { name: 'Jérôme Guedj' }).first().waitFor();

    await verifierAxe(page);
  });
});
