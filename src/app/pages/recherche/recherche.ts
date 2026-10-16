import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
  RESPONSE_INIT,
  ViewEncapsulation,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FdAlert, FdEmptyState, FdSpinner } from 'fuda';
import type { DeputeIndex, DeputeListe } from '@contrat';
import { DeputeApi } from '../../data/depute-api';
import { dateCourte, normaliser } from '../../data/format';
import { AppLienVisible } from '../../data/lien-visible';
import { PageMeta } from '../../data/page-meta';
import { AppPrefetch } from '../../data/prefetch';
import { valeurDe } from '../../data/ressource';
import { statutDePage } from '../../data/statut-de-page';

/**
 * Recherche d'un député ou d'une loi, rendue par le serveur. Un seul député trouvé (et aucune loi) :
 * redirection vers son profil, en 302 côté serveur et par remplacement de l'historique côté navigateur.
 */
@Component({
  selector: 'app-recherche-page',
  imports: [AppLienVisible, AppPrefetch, FdAlert, FdEmptyState, FdSpinner, RouterLink],
  templateUrl: './recherche.html',
  styleUrl: './recherche.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-recherche' },
})
export class RecherchePage {
  readonly q = input<string>();

  private readonly api = inject(DeputeApi);
  private readonly meta = inject(PageMeta);
  private readonly routeur = inject(Router);
  private readonly init = inject(RESPONSE_INIT, { optional: true });
  private readonly plateforme = inject(PLATFORM_ID);

  protected readonly ressource = this.api.liste();
  private readonly liste = computed<DeputeListe | undefined>(() => valeurDe(this.ressource));
  protected readonly erreur = computed(() => this.ressource.error() !== undefined);

  protected readonly requete = computed(() => (this.q() ?? '').trim());
  private readonly motif = computed(() => normaliser(this.requete()));

  protected readonly deputes = computed<DeputeIndex[]>(() => {
    const motif = this.motif();
    if (!motif) return [];
    return (this.liste()?.deputes ?? []).filter((d) => normaliser(d.nom).includes(motif));
  });

  protected readonly lois = computed(() => {
    const motif = this.motif();
    if (!motif) return [];
    return (this.liste()?.loisRecentes ?? []).filter((l) =>
      normaliser(l.titreCourt).includes(motif),
    );
  });

  /** Un seul député et aucune loi : la recherche mène directement à son profil. */
  private readonly redirection = computed(() => {
    const deputes = this.deputes();
    return deputes.length === 1 && this.lois().length === 0
      ? `/deputes/${encodeURIComponent(deputes[0].slug)}`
      : undefined;
  });

  protected readonly dateCourte = dateCourte;

  /** Groupe et circonscription d'un député, séparés par « · ». */
  protected detail(depute: DeputeIndex): string {
    return [depute.groupe, depute.circonscription].filter((texte) => !!texte).join(' · ');
  }

  protected precharge(dossier: string): string {
    return `/api/lois/${encodeURIComponent(dossier)}`;
  }

  constructor() {
    statutDePage(this.ressource);
    effect(() => {
      const requete = this.requete();
      this.meta.poser(
        requete ? `Recherche : « ${requete} »` : 'Recherche',
        "Recherche d'un député ou d'une loi votée à l'Assemblée nationale.",
      );
    });
    effect(() => {
      const cible = this.redirection();
      if (!cible) return;
      if (this.init) {
        const entetes = new Headers(this.init.headers);
        entetes.set('Location', cible);
        this.init.status = 302;
        this.init.headers = entetes;
      }
      if (isPlatformBrowser(this.plateforme)) {
        void this.routeur.navigateByUrl(cible, { replaceUrl: true });
      }
    });
  }
}
