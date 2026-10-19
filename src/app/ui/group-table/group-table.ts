import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import type { Groupe, VoteGroupe } from '@contrat';
import { pourcentEntier, repartir } from '../../data/format';
import { AppGroupPill } from '../group-pill/group-pill';
import { AppPosition } from '../position/position';
import { AppVoteBar } from '../vote-bar/vote-bar';

interface LigneGroupe {
  vote: VoteGroupe;
  /** Pourcentage entier de chaque suffrage sur les votants du groupe, ou « — » sans votant. */
  pour: string;
  contre: string;
  abstention: string;
}

/**
 * Le vote de chaque groupe en tableau : position, décomptes et pourcentages des votants du groupe,
 * défilement horizontal sur petit écran. Les groupes sans aucun votant sont nommés sous le tableau.
 */
@Component({
  selector: 'app-group-table',
  imports: [AppGroupPill, AppPosition, AppVoteBar],
  templateUrl: './group-table.html',
  styleUrl: './group-table.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppGroupTable {
  readonly groupes = input.required<VoteGroupe[]>();
  /** Groupes en activité ce jour-là dont aucun député n'a voté ni n'est listé (absents de `groupes`). */
  readonly sansVotant = input<Groupe[]>([]);

  protected readonly lignes = computed<LigneGroupe[]>(() =>
    this.groupes().map((vote) => {
      const { pour, contre, abstention } = vote.compte;
      const votants = pour + contre + abstention;
      const [p, c, a] = repartir([pour, contre, abstention]).map((n) =>
        votants > 0 ? pourcentEntier(n) : '—',
      );
      return { vote, pour: p, contre: c, abstention: a };
    }),
  );

  /** « LFI-NFP, GDR » : les abrégés, dans l'ordre officiel des groupes. */
  protected readonly nomsSansVotant = computed(() =>
    this.sansVotant()
      .map((g) => g.abrege)
      .join(', '),
  );
}
