import { Injectable, Signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { LoiDetail } from '@contrat';

/** Détail d'une loi, identifiée par son dossier_ref. Aucune requête tant que le dossier est indéfini. */
@Injectable({ providedIn: 'root' })
export class LoiApi {
  detail(dossier: Signal<string | undefined>) {
    return httpResource<LoiDetail>(() => {
      const valeur = dossier();
      return valeur === undefined ? undefined : `/api/lois/${encodeURIComponent(valeur)}`;
    });
  }
}
