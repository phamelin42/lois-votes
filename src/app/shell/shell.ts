import { Component, ViewEncapsulation, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FdIconButton, FdThemeService } from 'fuda';
import type { DeputeListe } from '@contrat';
import { dateLongue } from '../data/format';
import { AppSearch } from '../ui/search/search';

/** Cadre commun des pages : en-tête (nom, navigation, recherche, thème), contenu, pied avec les sources. */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet, FdIconButton, AppSearch],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppShell {
  /** Index de la recherche, transmis par la page qui le charge. */
  readonly index = input<DeputeListe | undefined>();
  /** Date de mise à jour des données, si la source la fournit. */
  readonly miseAJour = input<string | null>(null);
  /** Émis au premier focus de la recherche : la page charge alors l'index. */
  readonly besoinIndex = output<void>();

  protected readonly theme = inject(FdThemeService);
  protected readonly sombre = computed(() => this.theme.theme() === 'dark');
  protected readonly dateLongue = dateLongue;
}
