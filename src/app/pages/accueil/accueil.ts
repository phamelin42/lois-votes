import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { Accueil } from '@contrat';
import { AccueilApi } from '../../data/accueil-api';
import { EtatSite } from '../../data/etat-site';
import { PageMeta } from '../../data/page-meta';
import { valeurDe } from '../../data/ressource';
import { statutDePage } from '../../data/statut-de-page';
import { AccueilVue } from './accueil-vue';

/** Accueil : les dernières lois votées. « Voir plus » ajoute la page suivante aux cartes déjà là. */
@Component({
  selector: 'app-accueil-page',
  imports: [AccueilVue],
  templateUrl: './accueil.html',
  styleUrl: './accueil.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AccueilPage {
  private readonly api = inject(AccueilApi);
  private readonly meta = inject(PageMeta);
  private readonly etat = inject(EtatSite);

  private readonly page = signal(1);
  private readonly ressource = this.api.page(this.page);

  /** Les pages reçues, cumulées : une page suivante s'ajoute à la liste sans la remplacer. */
  protected readonly donnees = linkedSignal<Accueil | undefined, Accueil | undefined>({
    source: () => valeurDe(this.ressource),
    computation: (nouvelle, precedente) => {
      if (!nouvelle) return precedente?.value;
      const deja = nouvelle.page > 1 ? (precedente?.value?.lois ?? []) : [];
      return { ...nouvelle, lois: [...deja, ...nouvelle.lois] };
    },
  });
  protected readonly chargement = this.ressource.isLoading;
  protected readonly erreur = computed(() => this.ressource.error() !== undefined);

  constructor() {
    statutDePage(this.ressource);
    this.meta.poser(
      'Dernières lois votées',
      "Pour chaque loi votée à l'Assemblée nationale, le vote de chaque groupe, des plus récentes aux plus anciennes.",
    );
    effect(() => {
      const miseAJour = valeurDe(this.ressource)?.miseAJour;
      if (miseAJour) this.etat.miseAJour.set(miseAJour);
    });
  }

  protected voirPlus(): void {
    this.page.update((page) => page + 1);
  }
}
