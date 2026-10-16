import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { withFetch, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideClientHydration,
  withHttpTransferCacheOptions,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  provideRouter,
  RouterFeatures,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { ViewportPreloadingStrategy } from './data/viewport-preloading.strategy';

// Sans mouvement réduit, la navigation passe par une transition de vue ; le premier rendu n'est pas animé.
const mouvementReduit =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const transitions: RouterFeatures[] = mouvementReduit
  ? []
  : [withViewTransitions({ skipInitialTransition: true })];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // L'événement replay est inclus. Le cache de transfert évite la double requête à l'hydratation.
    provideClientHydration(
      withIncrementalHydration(),
      withHttpTransferCacheOptions({ includePostRequests: false }),
    ),
    // Aucun intercepteur côté navigateur pour l'instant : celui du serveur est dans app.config.server.ts.
    provideHttpClient(withFetch(), withInterceptors([])),
    provideRouter(
      routes,
      ...transitions,
      withPreloading(ViewportPreloadingStrategy),
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
  ],
};
