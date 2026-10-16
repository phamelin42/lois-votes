import type { HttpResourceRef } from '@angular/common/http';

/**
 * Valeur d'une ressource, ou `undefined`. Lire `value()` en erreur lève une exception : on passe
 * d'abord par `hasValue()`, pour que la page affiche son alerte au lieu de planter.
 */
export function valeurDe<T>(ressource: HttpResourceRef<T | undefined>): T | undefined {
  return ressource.hasValue() ? ressource.value() : undefined;
}
