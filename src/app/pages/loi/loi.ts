import { Component, computed, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FdAccordion,
  FdAccordionItem,
  FdAlert,
  FdBadge,
  FdBreadcrumb,
  FdButton,
  FdEmptyState,
  FdLink,
} from 'fuda';
import type { LoiDetail, ScrutinResume } from '@contrat';
import { LoiApi } from '../../data/loi-api';
import { AppLienVisible } from '../../data/lien-visible';
import { dateCourte, dateLongue, libelleAdoption } from '../../data/format';
import { AppPrefetch } from '../../data/prefetch';
import { PageMeta } from '../../data/page-meta';
import { valeurDe } from '../../data/ressource';
import { estIntrouvable, statutDePage } from '../../data/statut-de-page';
import { AppGroupTable } from '../../ui/group-table/group-table';
import { AppNominatif } from '../../ui/nominatif/nominatif';
import { AppVoteBar } from '../../ui/vote-bar/vote-bar';

/** Un groupe d'autres scrutins du texte (articles, amendements, autres), repliable. */
interface GroupeAutres {
  id: string;
  libelle: string;
  scrutins: ScrutinResume[];
}

/** Une loi : son vote final, ses lectures précédentes, les autres scrutins du texte. */
@Component({
  selector: 'app-loi-page',
  imports: [
    AppGroupTable,
    AppLienVisible,
    AppNominatif,
    AppPrefetch,
    AppVoteBar,
    FdAccordion,
    FdAccordionItem,
    FdAlert,
    FdBadge,
    FdBreadcrumb,
    FdButton,
    FdEmptyState,
    FdLink,
    RouterLink,
  ],
  templateUrl: './loi.html',
  styleUrl: './loi.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-loi' },
})
export class LoiPage {
  readonly dossier = input<string>();

  private readonly api = inject(LoiApi);
  private readonly meta = inject(PageMeta);
  protected readonly ressource = this.api.detail(this.dossier);

  protected readonly loi = computed<LoiDetail | undefined>(() => valeurDe(this.ressource));
  protected readonly erreur = computed(() => this.ressource.error() !== undefined);
  protected readonly introuvable = computed(() => estIntrouvable(this.ressource.error()));

  protected readonly fil = computed(() => {
    const loi = this.loi();
    return [{ label: 'Lois', link: '/' }, { label: loi?.titreCourt ?? 'Loi' }];
  });

  /** Les autres scrutins du texte, rangés par type. Les groupes vides n'apparaissent pas. */
  protected readonly autres = computed<GroupeAutres[]>(() => {
    const scrutins = this.loi()?.scrutins ?? [];
    return [
      { id: 'articles', libelle: 'Articles', scrutins: scrutins.filter((s) => s.type === 'article') },
      {
        id: 'amendements',
        libelle: 'Amendements',
        scrutins: scrutins.filter((s) => s.type === 'amendement'),
      },
      {
        id: 'autres',
        libelle: 'Autres votes',
        scrutins: scrutins.filter((s) => s.type !== 'article' && s.type !== 'amendement'),
      },
    ].filter((groupe) => groupe.scrutins.length > 0);
  });

  protected readonly dateLongue = dateLongue;
  protected readonly dateCourte = dateCourte;
  protected readonly libelleAdoption = libelleAdoption;

  constructor() {
    statutDePage(this.ressource);
    effect(() => {
      const loi = this.loi();
      if (loi) {
        this.meta.poser(
          loi.titreCourt,
          `Vote de chaque groupe sur « ${loi.titreCourt} » à l'Assemblée nationale.`,
        );
      } else if (this.introuvable()) {
        this.meta.poser('Loi introuvable', "Cette loi n'est pas dans les données.");
      }
    });
  }
}
