import {
  Component,
  computed,
  inject,
  Injector,
  runInInjectionContext,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { HttpResourceRef } from '@angular/common/http';
import type { DeputeListe } from '@contrat';
import { AppShell } from './shell/shell';
import { DeputeApi } from './data/depute-api';
import { EtatSite } from './data/etat-site';

/** Racine : le cadre commun, et l'index de la recherche chargé au premier besoin. */
@Component({
  selector: 'app-root',
  imports: [AppShell],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-shell' },
})
export class App {
  private readonly injecteur = inject(Injector);
  private readonly deputes = inject(DeputeApi);
  protected readonly etat = inject(EtatSite);

  /** Créée seulement quand la recherche le demande (premier focus) : pas de requête avant. */
  private readonly liste = signal<HttpResourceRef<DeputeListe | undefined> | undefined>(undefined);
  protected readonly index = computed(() => this.liste()?.value());

  protected demanderIndex(): void {
    if (this.liste()) return;
    this.liste.set(runInInjectionContext(this.injecteur, () => this.deputes.liste()));
  }
}
