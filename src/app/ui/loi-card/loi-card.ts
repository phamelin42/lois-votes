import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdBadge, FdCard } from 'fuda';
import type { LoiCarte } from '@contrat';
import { dateCourte } from '../../data/format';
import { AppGroupPills } from '../group-pills/group-pills';
import { AppVoteBar } from '../vote-bar/vote-bar';

/** Une loi de l'accueil : carte-lien vers sa page, ou vers le scrutin quand elle n'a pas de dossier. */
@Component({
  selector: 'app-loi-card',
  imports: [RouterLink, FdBadge, FdCard, AppGroupPills, AppVoteBar],
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
  protected readonly dateCourte = dateCourte;
}
