import { Component, ViewEncapsulation, inject, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdButton, FdEmptyState } from 'fuda';
import { AppLienVisible } from '../../data/lien-visible';
import { PageMeta } from '../../data/page-meta';

/** Adresse inconnue : page d'état vide, servie avec le statut 404. */
@Component({
  selector: 'app-introuvable-page',
  imports: [AppLienVisible, FdButton, FdEmptyState, RouterLink],
  templateUrl: './introuvable.html',
  styleUrl: './introuvable.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-introuvable' },
})
export class IntrouvablePage {
  constructor() {
    const init = inject(RESPONSE_INIT, { optional: true });
    if (init) init.status = 404;
    inject(PageMeta).poser('Page introuvable', "Cette adresse n'existe pas sur « Qui a voté quoi ? ».");
  }
}
