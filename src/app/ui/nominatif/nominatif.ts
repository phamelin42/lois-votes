import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdAlert, FdSpinner, FdTab, FdTabs } from 'fuda';
import type { DeputeMini, Groupe, Position } from '@contrat';
import { AppLienVisible } from '../../data/lien-visible';
import { AppPrefetch } from '../../data/prefetch';
import { valeurDe } from '../../data/ressource';
import { ScrutinApi } from '../../data/scrutin-api';
import { AppGroupPill } from '../group-pill/group-pill';

const ONGLETS: { position: Position; libelle: string }[] = [
  { position: 'pour', libelle: 'Pour' },
  { position: 'contre', libelle: 'Contre' },
  { position: 'abstention', libelle: 'Abstention' },
  { position: 'nonvotant', libelle: 'Non-votants' },
];

interface BlocGroupe {
  id: string;
  groupe: Groupe | undefined;
  deputes: DeputeMini[];
}

/**
 * Liste nominative d'un scrutin : un onglet par position, les députés regroupés par groupe, chaque
 * nom vers sa fiche. Les données ne sont demandées qu'à l'interaction (@defer dans la page).
 */
@Component({
  selector: 'app-nominatif',
  imports: [RouterLink, AppGroupPill, AppLienVisible, AppPrefetch, FdAlert, FdSpinner, FdTab, FdTabs],
  templateUrl: './nominatif.html',
  styleUrl: './nominatif.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppNominatif {
  readonly numero = input.required<number>();

  private readonly api = inject(ScrutinApi);
  protected readonly ressource = this.api.detail(computed(() => String(this.numero())));
  protected readonly detail = computed(() => valeurDe(this.ressource));
  protected readonly erreur = computed(() => this.ressource.error() !== undefined);
  protected readonly onglets = ONGLETS;

  private readonly groupeParId = computed(
    () => new Map(this.detail()?.groupes.map((v) => [v.groupe.id, v.groupe]) ?? []),
  );

  protected nombre(position: Position): number {
    return (this.detail()?.nominatif ?? [])
      .filter((bloc) => bloc.position === position)
      .reduce((total, bloc) => total + bloc.deputes.length, 0);
  }

  protected groupesDe(position: Position): BlocGroupe[] {
    return (this.detail()?.nominatif ?? [])
      .filter((bloc) => bloc.position === position && bloc.deputes.length > 0)
      .map((bloc) => ({
        id: bloc.groupeId,
        groupe: this.groupeParId().get(bloc.groupeId),
        deputes: bloc.deputes,
      }));
  }
}
