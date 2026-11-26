import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdBadge, FdCard } from 'fuda';
import type { LoiCarte } from '@contrat';
import { AppLienVisible } from '../../data/lien-visible';
import { AppPrefetch } from '../../data/prefetch';
import { dateCourte, explicationSansVote, libelleSansVote } from '../../data/format';
import { AppGroupPills } from '../group-pills/group-pills';
import { AppTypeVote } from '../type-vote/type-vote';
import { AppVoteBar } from '../vote-bar/vote-bar';

/**
 * Une loi de l'accueil : carte-lien vers sa page, ou vers le scrutin quand elle n'a pas de dossier. Sans vote nominatif
 * (main levée, article 49.3), la carte dit pourquoi à la place de la barre de vote et des groupes.
 */
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

  // Une carte sans dossier a toujours un vote final (une adoption sans vote vient d'un dossier).
  protected readonly cible = computed(() => {
    const { dossier, voteFinal } = this.loi();
    return dossier ? `/lois/${encodeURIComponent(dossier)}` : `/scrutins/${voteFinal?.numero}`;
  });
  /** Données de la cible du lien, pour le préchargement au survol. */
  protected readonly precharge = computed(() => {
    const { dossier, voteFinal } = this.loi();
    return dossier
      ? `/api/lois/${encodeURIComponent(dossier)}`
      : `/api/scrutins/${voteFinal?.numero}`;
  });
  /** Jour de la dernière décision : le vote final, ou l'adoption sans vote nominatif. */
  protected readonly date = computed(
    () => this.loi().voteFinal?.date ?? this.loi().adoptionSansVote?.date ?? '',
  );
  protected readonly dateCourte = dateCourte;
  protected readonly libelleSansVote = libelleSansVote;
  protected readonly explicationSansVote = explicationSansVote;
}
