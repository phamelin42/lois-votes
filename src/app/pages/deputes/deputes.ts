import { Component, computed, inject, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FdAlert,
  FdButton,
  FdEmptyState,
  FdSelect,
  FdSelectOption,
  FdSpinner,
  FdTextField,
} from 'fuda';
import type { DeputeIndex, Groupe } from '@contrat';
import { photoDe } from '../../../shared/photo';
import { DeputeApi } from '../../data/depute-api';
import { normaliser } from '../../data/format';
import { AppLienVisible } from '../../data/lien-visible';
import { PageMeta } from '../../data/page-meta';
import { AppPrefetch } from '../../data/prefetch';
import { valeurDe } from '../../data/ressource';
import { statutDePage } from '../../data/statut-de-page';
import { AppDeputyPhoto } from '../../ui/deputy-photo/deputy-photo';
import { AppGroupPill } from '../../ui/group-pill/group-pill';

/** Nombre de cartes affichées avant « Afficher plus ». */
const PAR_PAGE = 60;

interface CarteDepute {
  depute: DeputeIndex;
  groupe: Groupe | undefined;
}

type Filtre = 'groupe' | 'dept' | 'q';

/** Annuaire des députés, filtré par les paramètres d'URL (groupe, dept, q) : partageable, rendu côté serveur. */
@Component({
  selector: 'app-deputes-page',
  imports: [
    AppDeputyPhoto,
    AppGroupPill,
    AppLienVisible,
    AppPrefetch,
    FdAlert,
    FdButton,
    FdEmptyState,
    FdSelect,
    FdSpinner,
    FdTextField,
    RouterLink,
  ],
  templateUrl: './deputes.html',
  styleUrl: './deputes.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-deputes' },
})
export class DeputesPage {
  readonly groupe = input<string>();
  readonly dept = input<string>();
  readonly q = input<string>();

  private readonly api = inject(DeputeApi);
  private readonly meta = inject(PageMeta);
  private readonly routeur = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly ressource = this.api.liste();
  private readonly liste = computed(() => valeurDe(this.ressource));
  protected readonly erreur = computed(() => this.ressource.error() !== undefined);

  /** Nombre de cartes visibles : revient à la première page quand un filtre change. */
  protected readonly limite = linkedSignal({
    source: () => [this.groupe(), this.dept(), this.q()],
    computation: () => PAR_PAGE,
  });

  /**
   * Les groupes par abrégé : deux organes peuvent porter le même (UDR a été recréé en 2025), et le filtre
   * `?groupe=` comme l'index des députés parlent en abrégés. Le serveur trie les groupes par abrégé puis par
   * identifiant : le dernier organe d'un abrégé, le plus récent, donne son libellé.
   */
  private readonly groupesParAbrege = computed(
    () => new Map((this.liste()?.groupes ?? []).map((g) => [g.abrege, g])),
  );

  protected readonly cartes = computed<CarteDepute[]>(() => {
    const liste = this.liste();
    if (!liste) return [];
    const groupe = this.groupe() ?? '';
    const dept = this.dept() ?? '';
    const q = normaliser(this.q() ?? '');
    const groupes = this.groupesParAbrege();

    return liste.deputes
      .filter(
        (d) =>
          (!groupe || d.groupe === groupe) &&
          (!dept || d.departement === dept) &&
          (!q || normaliser(d.nom).includes(q)),
      )
      .sort((a, b) => a.nomTri.localeCompare(b.nomTri, 'fr'))
      .map((depute) => ({
        depute,
        groupe: depute.groupe ? groupes.get(depute.groupe) : undefined,
      }));
  });

  protected readonly visibles = computed(() => this.cartes().slice(0, this.limite()));

  protected readonly photoDe = photoDe;

  protected readonly optionsGroupes = computed<FdSelectOption[]>(() => [
    { value: '', label: 'Tous les groupes' },
    ...[...this.groupesParAbrege().values()].map((g) => ({ value: g.abrege, label: g.libelle })),
  ]);

  protected readonly optionsDepartements = computed<FdSelectOption[]>(() => {
    const codes = new Set(
      (this.liste()?.deputes ?? []).map((d) => d.departement).filter((c): c is string => !!c),
    );
    return [
      { value: '', label: 'Tous les départements' },
      ...[...codes]
        .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
        .map((code) => ({ value: code, label: code })),
    ];
  });

  constructor() {
    statutDePage(this.ressource);
    this.meta.poser(
      'Députés',
      "Les députés actifs de l'Assemblée nationale : leur groupe, leur circonscription et leurs votes.",
    );
  }

  /** Un filtre change : l'URL porte le nouvel état (une valeur vide le retire). */
  protected filtrer(filtre: Filtre, valeur: string): void {
    void this.routeur.navigate([], {
      relativeTo: this.route,
      queryParams: { [filtre]: valeur.trim() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected plus(): void {
    this.limite.update((n) => n + PAR_PAGE);
  }
}
