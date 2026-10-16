import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FdLink } from 'fuda';
import { PageMeta } from '../../data/page-meta';

/** À propos : d'où viennent les données, comment les lire, ce qu'elles ne disent pas. Pré-rendue au build. */
@Component({
  selector: 'app-a-propos-page',
  imports: [FdLink],
  templateUrl: './a-propos.html',
  styleUrl: './a-propos.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-a-propos' },
})
export class AProposPage {
  constructor() {
    inject(PageMeta).poser(
      'À propos',
      "D'où viennent les données de « Qui a voté quoi ? », comment les lire, et leurs limites.",
    );
  }
}
