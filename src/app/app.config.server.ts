import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { ɵHTTP_ROOT_INTERCEPTOR_FNS } from '@angular/common/http';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appelerBffActif } from '../server/bff';
import { appConfig } from './app.config';
import { APPELER_BFF, serverApiInterceptor } from './data/server-api.interceptor';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Pendant le rendu serveur, /api/* s'exécute en mémoire, depuis les données de data/ (src/server/bff.ts).
    { provide: APPELER_BFF, useValue: appelerBffActif },
    // L'intercepteur de /api est enregistré comme intercepteur racine, donc après le cache de
    // transfert : celui-ci doit voir la réponse pour la transmettre au navigateur (sinon le
    // navigateur refait la requête à l'hydratation). Voir CLAUDE.md, « Données et chargement ».
    { provide: ɵHTTP_ROOT_INTERCEPTOR_FNS, useValue: serverApiInterceptor, multi: true },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
