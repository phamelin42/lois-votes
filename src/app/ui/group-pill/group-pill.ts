import { Component, ViewEncapsulation, input } from '@angular/core';
import type { Groupe } from '@contrat';

/** Abrégé d'un groupe, précédé de sa couleur officielle (décorative) ; le nom complet est en infobulle et lu aux lecteurs d'écran. */
@Component({
  selector: 'app-group-pill',
  templateUrl: './group-pill.html',
  styleUrl: './group-pill.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppGroupPill {
  readonly groupe = input.required<Groupe>();
}
