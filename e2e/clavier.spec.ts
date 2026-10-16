import { expect, test } from '@playwright/test';
import { attendreHydratation } from './aide';

test.describe('clavier et focus', () => {
  test("le lien d'évitement est le premier élément focalisable et mène au contenu", async ({
    page,
  }) => {
    await page.goto('/');
    await attendreHydratation(page);

    await page.keyboard.press('Tab');
    const lien = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(lien).toBeFocused();
    await expect(lien).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/#contenu$/);
  });

  test("chaque élément interactif de l'en-tête a un focus visible", async ({ page }) => {
    await page.goto('/');
    await attendreHydratation(page);

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const visible = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = getComputedStyle(el);
        return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      });
      expect(visible, `Tab n°${i + 1}`).toBe(true);
    }
  });

  test('la recherche se pilote au clavier : flèches, Entrée, Échap', async ({ page }) => {
    await page.goto('/');
    await attendreHydratation(page);
    const recherche = page.getByRole('combobox');

    await recherche.fill('martin');
    await expect(recherche).toHaveAttribute('aria-expanded', 'true');
    await recherche.press('Escape');
    await expect(recherche).toHaveAttribute('aria-expanded', 'false');

    await recherche.fill('roux');
    await recherche.press('ArrowDown');
    await expect(recherche).toHaveAttribute('aria-activedescendant', /.+/);
    await recherche.press('Enter');
    await expect(page).toHaveURL('/deputes/elodie-roux');
  });

  test('la bascule de thème se commande au clavier et se mémorise', async ({ page }) => {
    await page.goto('/');
    await attendreHydratation(page);
    const bouton = page.getByRole('button', { name: 'Thème sombre' });

    await bouton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(bouton).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('le thème sombre est posé avant le rendu : pas de flash', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('fuda-theme', 'dark'));
    const themes: (string | null)[] = [];
    await page.exposeFunction('noter', (t: string | null) => themes.push(t));
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () =>
        (window as unknown as { noter: (t: string | null) => void }).noter(
          document.documentElement.getAttribute('data-theme'),
        ),
      );
    });

    await page.goto('/');

    expect(themes[0]).toBe('dark');
  });
});

test.describe('mouvement réduit', () => {
  const compterTransitions = () =>
    `(() => {
      window.__transitions = 0;
      const original = document.startViewTransition?.bind(document);
      if (original) document.startViewTransition = (...args) => { window.__transitions++; return original(...args); };
    })()`;

  test('les transitions de vue sont jouées par défaut', async ({ page }) => {
    await page.addInitScript(compterTransitions());
    await page.goto('/');
    await attendreHydratation(page);

    await page.getByRole('link', { name: 'Députés' }).click();
    await expect(page).toHaveURL('/deputes');

    expect(
      await page.evaluate(() => (window as unknown as { __transitions: number }).__transitions),
    ).toBeGreaterThan(0);
  });

  test('aucune transition de vue avec prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(compterTransitions());
    await page.goto('/');
    await attendreHydratation(page);

    await page.getByRole('link', { name: 'Députés' }).click();
    await expect(page).toHaveURL('/deputes');

    expect(
      await page.evaluate(() => (window as unknown as { __transitions: number }).__transitions),
    ).toBe(0);
  });
});
