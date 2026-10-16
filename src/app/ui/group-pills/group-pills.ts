import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import type { VoteGroupe } from '@contrat';
import { libellePosition } from '../../data/format';
import { AppGroupPill } from '../group-pill/group-pill';

/** Ligne compacte « RN Pour · LFI-NFP Contre · … », limitée à `max` groupes. */
@Component({
  selector: 'app-group-pills',
  imports: [AppGroupPill],
  templateUrl: './group-pills.html',
  styleUrl: './group-pills.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppGroupPills {
  readonly groupes = input.required<VoteGroupe[]>();
  readonly max = input(6);

  protected readonly visibles = computed(() => this.groupes().slice(0, this.max()));
  protected readonly reste = computed(() => Math.max(0, this.groupes().length - this.max()));
  protected readonly libellePosition = libellePosition;
}
