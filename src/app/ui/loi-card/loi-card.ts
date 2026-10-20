import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdBadge, FdCard } from 'fuda';
import type { LoiCarte } from '@contrat';
import { AppLienVisible } from '../../data/lien-visible';
import { AppPrefetch } from '../../data/prefetch';
import { dateCourte } from '../../data/format';
import { AppGroupPills } from '../group-pills/group-pills';
import { AppTypeVote } from '../type-vote/type-vote';
import { AppVoteBar } from '../vote-bar/vote-bar';

/** Une loi de l'accueil : carte-lien vers sa page, ou vers le scrutin quand elle n'a pas de dossier. */
@Component({
  selector: 'app-loi-card',
  imports: [
    RouterLink,
    FdBadge,
    FdCard,
    AppGroupPills,
    AppTypeVote,
    AppVoteBar,
    AppLienVisible,
    AppPrefetch,
  ],
  templateUrl: './loi-card.html',
  styleUrl: './loi-card.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppLoiCard {
  readonly loi = input.required<LoiCarte>();

  protected readonly cible = computed(() => {
    const { dossier, voteFinal } = this.loi();
    return dossier ? `/lois/${encodeURIComponent(dossier)}` : `/scrutins/${voteFinal.numero}`;
  });
  /** Données de la cible du lien, pour le préchargement au survol. */
  protected readonly precharge = computed(() => {
    const { dossier, voteFinal } = this.loi();
    return dossier
      ? `/api/lois/${encodeURIComponent(dossier)}`
      : `/api/scrutins/${voteFinal.numero}`;
  });
  protected readonly dateCourte = dateCourte;
}
