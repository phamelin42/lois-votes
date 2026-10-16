import { Component, ViewEncapsulation, input } from '@angular/core';
import { FdBadge, FdBadgeTone } from 'fuda';
import type { PositionGroupe } from '@contrat';
import { libellePosition } from '../../data/format';

const TONS: Record<PositionGroupe, FdBadgeTone> = {
  pour: 'tokiwa',
  contre: 'enji',
  abstention: 'yamabuki',
  nonvotant: 'neutral',
  partage: 'neutral',
};

/** Position d'un groupe sur un vote, écrite en toutes lettres dans un badge. */
@Component({
  selector: 'app-position',
  imports: [FdBadge],
  templateUrl: './position.html',
  styleUrl: './position.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppPosition {
  readonly position = input<PositionGroupe | null>(null);

  protected readonly tons = TONS;
  protected readonly libellePosition = libellePosition;
}
