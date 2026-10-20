import { booleanAttribute, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { FdBadge } from 'fuda';
import type { ScrutinResume } from '@contrat';

/**
 * Badge « Vote solennel » ou « Vote ordinaire », avec en option la phrase qui l'explique.
 *
 * Un scrutin public solennel convoque tous les députés ; un scrutin public ordinaire se tient en séance, avec les
 * seuls députés présents dans l'hémicycle : le nombre de votants varie donc énormément. Le texte porte l'information,
 * la couleur ne fait que la doubler. Une motion de censure n'est ni l'un ni l'autre : rien n'est affiché.
 */
@Component({
  selector: 'app-type-vote',
  imports: [FdBadge],
  templateUrl: './type-vote.html',
  styleUrl: './type-vote.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-type-vote' },
})
export class AppTypeVote {
  readonly scrutin = input.required<Pick<ScrutinResume, 'solennel' | 'type'>>();
  /** Ajoute la phrase d'explication sous le badge (pages d'une loi et d'un scrutin). */
  readonly phrase = input(false, { transform: booleanAttribute });

  protected readonly visible = computed(() => this.scrutin().type !== 'motion');
  protected readonly solennel = computed(() => this.scrutin().solennel);
  protected readonly libelle = computed(() =>
    this.solennel() ? 'Vote solennel' : 'Vote ordinaire',
  );
  protected readonly explication = computed(() =>
    this.solennel()
      ? 'Vote solennel : tous les députés sont convoqués.'
      : "Vote ordinaire : en séance, seuls les députés présents dans l'hémicycle votent.",
  );
}
