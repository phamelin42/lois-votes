import { Component, inject, RESPONSE_INIT, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-introuvable',
  templateUrl: './introuvable.html',
  styleUrl: './introuvable.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-introuvable' },
})
export class Introuvable {
  constructor() {
    // Rendu serveur : la page répond 404 (sans effet dans le navigateur).
    const reponse = inject(RESPONSE_INIT, { optional: true });
    if (reponse) {
      reponse.status = 404;
    }
  }
}
