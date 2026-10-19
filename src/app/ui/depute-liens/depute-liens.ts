import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { FdLink } from 'fuda';
import type { LiensDepute } from '@contrat';

interface Lien {
  libelle: string;
  url: string;
}

/**
 * Liens externes d'un député, chacun dans un nouvel onglet (annoncé aux lecteurs d'écran). Un lien absent n'est pas
 * affiché : jamais d'adresse devinée.
 */
@Component({
  selector: 'app-depute-liens',
  imports: [FdLink],
  templateUrl: './depute-liens.html',
  styleUrl: './depute-liens.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-depute-liens' },
})
export class AppDeputeLiens {
  readonly liens = input.required<LiensDepute>();

  protected readonly affiches = computed<Lien[]>(() => {
    const { assemblee, hatvp, wikipedia, siteWeb, x, facebook } = this.liens();
    const candidats: [string, string | null][] = [
      ["Fiche à l'Assemblée", assemblee],
      ['Déclarations HATVP', hatvp],
      ['Page Wikipédia', wikipedia],
      ['Site web', siteWeb],
      ['Compte X', x],
      ['Page Facebook', facebook],
    ];
    return candidats.flatMap(([libelle, url]) => (url ? [{ libelle, url }] : []));
  });
}
