import { defineConfig } from '@playwright/test';

// Trois instances du même build SSR (`npm run build:fixtures` : données du jeu de test, aucun réseau) :
//  - 4000 : site normal, avec ses données, sans Umami ;
//  - 4001 : site « panne », dont le dossier de données n'existe pas : toutes les routes /api répondent 503 ;
//  - 4002 : site avec Umami configuré.
const SSR = 'node dist/lois-votes/server/server.mjs';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4000',
    viewport: { width: 960, height: 640 },
    trace: 'retain-on-failure',
    // Pour utiliser un Chromium déjà installé : PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/vers/chrome
    launchOptions: {
      executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'],
      // Le rendu du texte ne dépend pas de la fontconfig de la machine.
      args: ['--font-render-hinting=none'],
    },
  },
  webServer: [
    {
      command: SSR,
      env: { PORT: '4000', DONNEES_DIR: '' },
      port: 4000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: SSR,
      env: { PORT: '4001', DONNEES_DIR: 'dossier-de-donnees-inexistant' },
      port: 4001,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: SSR,
      env: { PORT: '4002', DONNEES_DIR: '', UMAMI_WEBSITE_ID: 'site-de-test' },
      port: 4002,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
