import { Injectable, signal } from '@angular/core';

/** Ce que les pages savent du site et que le cadre affiche : la date de mise à jour des données. */
@Injectable({ providedIn: 'root' })
export class EtatSite {
  /** ISO, ou null tant qu'une page ne l'a pas reçue de la source. */
  readonly miseAJour = signal<string | null>(null);
}
