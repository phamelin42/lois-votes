import { Component, ViewEncapsulation, input } from '@angular/core';
import type { VoteGroupe } from '@contrat';
import { AppGroupPill } from '../group-pill/group-pill';
import { AppPosition } from '../position/position';
import { AppVoteBar } from '../vote-bar/vote-bar';

/** Le vote de chaque groupe en tableau : position et décomptes, défilement horizontal sur petit écran. */
@Component({
  selector: 'app-group-table',
  imports: [AppGroupPill, AppPosition, AppVoteBar],
  templateUrl: './group-table.html',
  styleUrl: './group-table.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppGroupTable {
  readonly groupes = input.required<VoteGroupe[]>();
}
