import { Component, computed, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdAlert, FdBadge, FdBreadcrumb, FdButton, FdEmptyState, FdLink } from 'fuda';
import type { DeputeDetail, VoteDepute } from '@contrat';
import { DeputeApi } from '../../data/depute-api';
import { dateCourte, libelleAdoption, pourcent } from '../../data/format';
import { AppLienVisible } from '../../data/lien-visible';
import { PageMeta } from '../../data/page-meta';
import { AppPrefetch } from '../../data/prefetch';
import { valeurDe } from '../../data/ressource';
import { estIntrouvable, statutDePage } from '../../data/statut-de-page';
import { AppDeputyPhoto } from '../../ui/deputy-photo/deputy-photo';
import { AppGroupPill } from '../../ui/group-pill/group-pill';
import { AppPosition } from '../../ui/position/position';

/** Profil d'un député : identité, trois chiffres clés, ses votes sur les dix dernières lois. */
@Component({
  selector: 'app-depute-page',
  imports: [
    AppDeputyPhoto,
    AppGroupPill,
    AppLienVisible,
    AppPosition,
    AppPrefetch,
    FdAlert,
    FdBadge,
    FdBreadcrumb,
    FdButton,
    FdEmptyState,
    FdLink,
    RouterLink,
  ],
  templateUrl: './depute.html',
  styleUrl: './depute.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-depute' },
})
export class DeputePage {
  readonly slug = input<string>();

  private readonly api = inject(DeputeApi);
  private readonly meta = inject(PageMeta);
  protected readonly ressource = this.api.detail(this.slug);

  protected readonly depute = computed<DeputeDetail | undefined>(() => valeurDe(this.ressource));
  protected readonly erreur = computed(() => this.ressource.error() !== undefined);
  protected readonly introuvable = computed(() => estIntrouvable(this.ressource.error()));

  protected readonly fil = computed(() => [
    { label: 'Députés', link: '/deputes' },
    { label: this.depute()?.nom ?? 'Député' },
  ]);

  protected readonly pourcent = pourcent;
  protected readonly dateCourte = dateCourte;
  protected readonly libelleAdoption = libelleAdoption;

  constructor() {
    statutDePage(this.ressource);
    effect(() => {
      const depute = this.depute();
      if (depute) {
        this.meta.poser(
          depute.nom,
          `Participation aux scrutins, abstentions et votes de ${depute.nom}${depute.groupe ? ` (${depute.groupe.libelle})` : ''}.`,
        );
      }
    });
  }

  /** Vrai quand le député a voté autrement que son groupe : le texte le dit, pas seulement la couleur. */
  protected ecart(vote: VoteDepute): boolean {
    return vote.position !== null && vote.positionGroupe !== null && vote.position !== vote.positionGroupe;
  }

  /** Une loi mène à sa page ; un vote sans dossier mène à son scrutin. */
  protected lienVote(vote: VoteDepute): string[] {
    return vote.loi.dossier ? ['/lois', vote.loi.dossier] : ['/scrutins', String(vote.numero)];
  }

  protected precharge(vote: VoteDepute): string {
    return vote.loi.dossier
      ? `/api/lois/${encodeURIComponent(vote.loi.dossier)}`
      : `/api/scrutins/${vote.numero}`;
  }
}
