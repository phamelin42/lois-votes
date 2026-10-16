import { Injectable, Signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { DeputeDetail, DeputeListe } from '@contrat';

/** Députés : l'index compact (liste et recherche) et le profil d'un député. */
@Injectable({ providedIn: 'root' })
export class DeputeApi {
  liste() {
    return httpResource<DeputeListe>(() => '/api/deputes');
  }

  detail(slug: Signal<string | undefined>) {
    return httpResource<DeputeDetail>(() => {
      const valeur = slug();
      return valeur === undefined ? undefined : `/api/deputes/${encodeURIComponent(valeur)}`;
    });
  }
}
