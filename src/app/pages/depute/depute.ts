import { Component, computed, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdAlert, FdBadge, FdBreadcrumb, FdButton, FdEmptyState, FdLink } from 'fuda';
import type { Compte, DeputeDetail, VoteDepute } from '@contrat';
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
import { AppVoteBar } from '../../ui/vote-bar/vote-bar';

const nombreFr = new Intl.NumberFormat('fr-FR');

/** Profil d'un député : identité, chiffres clés (participation, ses votes, abstention, loyauté), ses votes sur les dix dernières lois. */
@Component({
  selector: 'app-depute-page',
  imports: [
    AppDeputyPhoto,
    AppGroupPill,
    AppLienVisible,
    AppPosition,
    AppPrefetch,
    AppVoteBar,
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

  /** Ses votes exprimés pour la barre « Ses votes » : pour, contre, abstention (les non-votes n'y entrent pas). */
  protected readonly compteVotes = computed<Compte>(() => {
    const { pour, contre, abstention } = this.depute()?.scrutins ?? {
      pour: 0,
      contre: 0,
      abstention: 0,
    };
    return { pour, contre, abstention, nonvotant: 0 };
  });

  /** « A voté à 1 156 scrutins sur 5 235 en mandat, n'a pas voté à 4 079. » : formulation neutre. */
  protected readonly detailParticipation = computed(() => {
    const scrutins = this.depute()?.scrutins;
    if (!scrutins || scrutins.enMandat === 0) return 'Aucun scrutin pendant son mandat.';
    const votes = scrutins.pour + scrutins.contre + scrutins.abstention;
    const nombre = (n: number) => nombreFr.format(n);
    return (
      `A voté à ${nombre(votes)} ${votes > 1 ? 'scrutins' : 'scrutin'} sur ` +
      `${nombre(scrutins.enMandat)} en mandat, n'a pas voté à ${nombre(scrutins.nonVote)}.`
    );
  });

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
      } else if (this.introuvable()) {
        this.meta.poser('Député introuvable', "Ce député n'est pas dans les données.");
      }
    });
  }

  /** Vrai quand le député a voté autrement que son groupe : le texte le dit, pas seulement la couleur. */
  protected ecart(vote: VoteDepute): boolean {
    return (
      vote.position !== null &&
      vote.positionGroupe !== null &&
      vote.position !== vote.positionGroupe
    );
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
