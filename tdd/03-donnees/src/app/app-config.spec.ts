import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Test d'architecture : le plan impose ces choix dans la configuration (voir docs/PLAN.md « Chargement intelligent »).
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8');

describe('configuration de l\'application', () => {
  const config = () => lire('src/app/app.config.ts');

  it.each([
    'provideClientHydration',
    'withIncrementalHydration',
    'withHttpTransferCacheOptions',
    'provideHttpClient',
    'withFetch',
    'withInterceptors',
    'withViewTransitions',
    'skipInitialTransition',
    'withPreloading',
    'ViewportPreloadingStrategy',
    'withComponentInputBinding',
    'withInMemoryScrolling',
  ])('utilise %s', (symbole) => {
    expect(config()).toContain(symbole);
  });

  it('désactive les transitions de vue en mouvement réduit', () => {
    expect(config()).toMatch(/prefers-reduced-motion/);
  });

  it('ne fournit l\'intercepteur serveur que dans la configuration serveur', () => {
    expect(config()).not.toContain('serverApiInterceptor');
    const serveur = lire('src/app/app.config.server.ts');
    expect(serveur).toContain('serverApiInterceptor');
    expect(serveur).toContain('APPELER_BFF');
  });
});
