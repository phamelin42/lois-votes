import { Injectable, Signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { Accueil } from '@contrat';

/** Page d'accueil : les dernières lois votées, par pages de 10. */
@Injectable({ providedIn: 'root' })
export class AccueilApi {
  page(page: Signal<number>) {
    return httpResource<Accueil>(() => `/api/accueil?page=${encodeURIComponent(page())}`);
  }
}
