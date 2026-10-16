import { DOCUMENT } from '@angular/common';
import {
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { catchError, from, mergeMap, Observable, of, throwError } from 'rxjs';

/** Réponse du BFF, telle que la produit appelerBff (ou le BFF factice en MOCK_BFF=1). */
export interface ReponseBff {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type AppelerBff = (url: string) => Promise<ReponseBff>;

/** Fourni seulement par la configuration serveur : exécute une requête /api/* sans réseau. */
export const APPELER_BFF = new InjectionToken<AppelerBff>('APPELER_BFF');

const ORIGINE_PAR_DEFAUT = 'http://localhost';

/**
 * Pendant le rendu serveur, une requête vers /api/* est exécutée en mémoire par APPELER_BFF,
 * sans aller-retour réseau. La réponse devient une HttpResponse, pour que le cache de transfert
 * l'emporte à l'hydratation. Toute autre requête suit son cours normal.
 */
export const serverApiInterceptor: HttpInterceptorFn = (req, suivant) => {
  const origine = inject(DOCUMENT).location?.origin ?? ORIGINE_PAR_DEFAUT;
  const cible = new URL(req.url, origine);
  if (cible.origin !== origine || !cible.pathname.startsWith('/api/')) {
    return suivant(req);
  }

  const appeler = inject(APPELER_BFF);
  return from(appeler(cible.pathname + cible.search)).pipe(
    catchError(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            headers: new HttpHeaders({ 'retry-after': '60' }),
            error: { erreur: 'API indisponible' },
            url: req.url,
          }),
      ),
    ),
    mergeMap((reponse): Observable<HttpResponse<unknown>> => {
      const headers = new HttpHeaders(reponse.headers);
      if (reponse.status >= 400) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: reponse.status,
              headers,
              error: reponse.body,
              url: req.url,
            }),
        );
      }
      return of(new HttpResponse({ status: reponse.status, headers, body: reponse.body, url: req.url }));
    }),
  );
};
