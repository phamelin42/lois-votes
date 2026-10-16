import { booleanAttribute, Component, ViewEncapsulation, input, output } from '@angular/core';
import { FdAlert, FdButton, FdEmptyState } from 'fuda';
import type { Accueil } from '@contrat';
import { AppLoiCard } from '../../ui/loi-card/loi-card';

/** Vue de l'accueil : les dernières lois votées. Les données arrivent par entrées, la page les charge. */
@Component({
  selector: 'app-accueil-vue',
  imports: [AppLoiCard, FdAlert, FdButton, FdEmptyState],
  templateUrl: './accueil-vue.html',
  styleUrl: './accueil-vue.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AccueilVue {
  readonly donnees = input<Accueil | undefined>();
  readonly chargement = input(false, { transform: booleanAttribute });
  readonly erreur = input(false, { transform: booleanAttribute });
  /** Demande de la page suivante (« Voir plus »). */
  readonly pageSuivante = output<void>();
}
