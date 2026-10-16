import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Pages parcourues par les tests d'accessibilité (adresses de l'univers de test). */
export const PAGES = [
  { nom: 'accueil', chemin: '/' },
  { nom: 'loi', chemin: '/lois/DLR5L17N1110' },
  { nom: 'loi à plusieurs lectures', chemin: '/lois/DLR5L17N2000' },
  { nom: 'scrutin', chemin: '/scrutins/110' },
  { nom: 'députés', chemin: '/deputes' },
  { nom: 'député', chemin: '/deputes/david-moreau' },
  { nom: 'recherche', chemin: '/recherche?q=ou' },
  { nom: 'à propos', chemin: '/a-propos' },
  { nom: 'introuvable', chemin: '/cette-page-n-existe-pas' },
] as const;

export type Theme = 'jour' | 'nuit';

/** Pose le thème comme le ferait un visiteur (même clé que FdThemeService). */
export async function choisirTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('fuda-theme', t === 'nuit' ? 'dark' : 'light');
    } catch {
      /* stockage indisponible */
    }
  }, theme);
}

/** Attend que l'hydratation soit finie (les blocs différés restent à l'état de repos). */
export async function attendreHydratation(page: Page) {
  await page.waitForFunction(() => document.querySelector('[ng-version]') !== null);
  await page.waitForLoadState('networkidle');
}

export async function verifierAxe(page: Page) {
  const resultat = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(
    resultat.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}
