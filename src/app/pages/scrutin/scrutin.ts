import { Component, computed, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FdAlert, FdBadge, FdBreadcrumb, FdButton, FdEmptyState, FdLink } from 'fuda';
import type { ScrutinDetail } from '@contrat';
import { AppLienVisible } from '../../data/lien-visible';
import { AppPrefetch } from '../../data/prefetch';
import { dateLongue, libelleAdoption, libelleType } from '../../data/format';
import { PageMeta } from '../../data/page-meta';
import { valeurDe } from '../../data/ressource';
import { ScrutinApi } from '../../data/scrutin-api';
import { estIntrouvable, statutDePage } from '../../data/statut-de-page';
import { AppGroupTable } from '../../ui/group-table/group-table';
import { AppNominatif } from '../../ui/nominatif/nominatif';
import { AppVoteBar } from '../../ui/vote-bar/vote-bar';

/** Un scrutin : décompte, tableau par groupe, lien vers sa loi et liste nominative. */
@Component({
  selector: 'app-scrutin-page',
  imports: [
    AppGroupTable,
    AppLienVisible,
    AppNominatif,
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
  templateUrl: './scrutin.html',
  styleUrl: './scrutin.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-scrutin' },
})
export class ScrutinPage {
  readonly numero = input<string>();

  private readonly api = inject(ScrutinApi);
  private readonly meta = inject(PageMeta);
  protected readonly ressource = this.api.detail(this.numero);

  protected readonly scrutin = computed<ScrutinDetail | undefined>(() =>
    valeurDe(this.ressource),
  );
  protected readonly erreur = computed(() => this.ressource.error() !== undefined);
  protected readonly introuvable = computed(() => estIntrouvable(this.ressource.error()));

  protected readonly fil = computed(() => {
    const scrutin = this.scrutin();
    const etapes: { label: string; link?: string }[] = [{ label: 'Lois', link: '/' }];
    if (scrutin?.loi?.dossier) {
      etapes.push({
        label: scrutin.loi.titreCourt,
        link: `/lois/${encodeURIComponent(scrutin.loi.dossier)}`,
      });
    }
    etapes.push({ label: `Scrutin n° ${scrutin?.numero ?? this.numero() ?? ''}` });
    return etapes;
  });

  protected readonly dateLongue = dateLongue;
  protected readonly libelleAdoption = libelleAdoption;
  protected readonly libelleType = libelleType;

  constructor() {
    statutDePage(this.ressource);
    effect(() => {
      const scrutin = this.scrutin();
      if (scrutin) {
        this.meta.poser(
          `Scrutin n° ${scrutin.numero}`,
          `${libelleType(scrutin.type)} du ${dateLongue(scrutin.date)} : ${libelleAdoption(scrutin.adopte)}. ${scrutin.titre}`,
        );
      } else if (this.introuvable()) {
        this.meta.poser('Scrutin introuvable', "Ce scrutin n'est pas dans les données.");
      }
    });
  }
}
