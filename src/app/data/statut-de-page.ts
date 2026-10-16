import { HttpErrorResponse } from '@angular/common/http';
import { effect, inject, RESPONSE_INIT, Signal } from '@angular/core';

/**
 * Reporte l'état d'une ressource sur le statut HTTP de la page rendue par le serveur :
 * 404 si la ressource est introuvable, 503 si la source est indisponible ou en erreur, 200 sinon.
 * Sans effet dans le navigateur (RESPONSE_INIT n'y est pas fourni).
 */
export function statutDePage(ressource: { readonly error: Signal<unknown> }): void {
  const init = inject(RESPONSE_INIT, { optional: true });
  if (!init) return;

  effect(() => {
    const erreur = ressource.error();
    if (erreur === undefined) {
      init.status = 200;
    } else {
      init.status = erreur instanceof HttpErrorResponse && erreur.status === 404 ? 404 : 503;
    }
  });
}
