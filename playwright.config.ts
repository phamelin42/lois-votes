import { defineConfig } from '@playwright/test';

// Trois instances du build SSR et deux faux serveurs de l'API tabulaire (voir e2e/aide.ts et les specs).
//  - 4000 : site normal, faux serveur sain (4010), sans Umami ;
//  - 4001 : site « panne », faux serveur qui répond 500 (4011) ;
//  - 4002 : site avec Umami configuré, même faux serveur sain que 4000.
const SSR = 'node dist/lois-votes/server/server.mjs';
const SAIN = 'http://localhost:4010/api';

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
      command: 'node e2e/faux-tabulaire.mjs',
      env: { FAUX_PORT: '4010' },
      port: 4010,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'node e2e/faux-tabulaire.mjs',
      env: { FAUX_PORT: '4011', FAUX_ERREUR: '500' },
      port: 4011,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: SSR,
      env: { PORT: '4000', TABULAR_API_BASE: SAIN },
      port: 4000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: SSR,
      env: { PORT: '4001', TABULAR_API_BASE: 'http://localhost:4011/api' },
      port: 4001,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: SSR,
      env: { PORT: '4002', TABULAR_API_BASE: SAIN, UMAMI_WEBSITE_ID: 'site-de-test' },
      port: 4002,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
