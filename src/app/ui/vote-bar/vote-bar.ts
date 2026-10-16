import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import type { Compte, Position } from '@contrat';

const ORDRE: Position[] = ['pour', 'contre', 'abstention', 'nonvotant'];

interface Segment {
  type: Position;
  nombre: number;
}

/** « 1 abstention », « 18 abstentions » : le singulier vaut pour zéro. */
const compter = (n: number, singulier: string, pluriel: string) =>
  `${n} ${n > 1 ? pluriel : singulier}`;

/** Répartition d'un vote : barre empilée, chiffres écrits dessous (la couleur ne porte jamais seule l'information). */
@Component({
  selector: 'app-vote-bar',
  templateUrl: './vote-bar.html',
  styleUrl: './vote-bar.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppVoteBar {
  readonly compte = input.required<Compte>();
  readonly taille = input<'sm' | 'md'>('md');

  protected readonly segments = computed<Segment[]>(() => {
    const compte = this.compte();
    return ORDRE.map((type) => ({ type, nombre: compte[type] })).filter((s) => s.nombre > 0);
  });

  protected readonly resume = computed(() => {
    const compte = this.compte();
    return [
      `${compte.pour} pour`,
      `${compte.contre} contre`,
      compter(compte.abstention, 'abstention', 'abstentions'),
      compter(compte.nonvotant, 'non-votant', 'non-votants'),
    ].join(', ');
  });
}
