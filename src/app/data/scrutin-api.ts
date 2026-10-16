import { Injectable, Signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { ScrutinDetail } from '@contrat';

/** Détail d'un scrutin, par son numéro (8317). Aucune requête tant que le numéro est indéfini. */
@Injectable({ providedIn: 'root' })
export class ScrutinApi {
  detail(numero: Signal<string | undefined>) {
    return httpResource<ScrutinDetail>(() => {
      const valeur = numero();
      return valeur === undefined ? undefined : `/api/scrutins/${encodeURIComponent(valeur)}`;
    });
  }
}
