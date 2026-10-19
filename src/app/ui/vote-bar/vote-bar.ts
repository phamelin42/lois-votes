import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import type { Compte, Position } from '@contrat';
import { pourcentEntier, pourcentPartiel, repartir } from '../../data/format';

/** La barre porte les votants : pour, contre, abstention. Les non-votants sont dits par la ligne « n'ont pas voté ». */
type Suffrage = Exclude<Position, 'nonvotant'>;
const ORDRE: Suffrage[] = ['pour', 'contre', 'abstention'];
const LIBELLES: Record<Suffrage, { court: string; singulier: string; pluriel: string }> = {
  pour: { court: 'pour', singulier: 'pour', pluriel: 'pour' },
  contre: { court: 'contre', singulier: 'contre', pluriel: 'contre' },
  abstention: { court: 'abst.', singulier: 'abstention', pluriel: 'abstentions' },
};

interface Segment {
  type: Suffrage;
  nombre: number;
  /** Pourcentage entier des votants ; la somme des trois vaut 100 (ou 0 sans votant). */
  pourcent: number;
}

const accorder = (n: number, singulier: string, pluriel: string) =>
  `${n} ${n > 1 ? pluriel : singulier}`;

/**
 * Répartition d'un vote : barre empilée sur les votants, pourcentages et chiffres écrits dessous
 * (la couleur ne porte jamais seule l'information) et, si `enMandat` est fourni, combien n'ont pas voté.
 */
@Component({
  selector: 'app-vote-bar',
  templateUrl: './vote-bar.html',
  styleUrl: './vote-bar.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppVoteBar {
  readonly compte = input.required<Compte>();
  readonly taille = input<'sm' | 'md'>('md');
  /** Députés en mandat ce jour-là : active la ligne « n'ont pas voté sur … en mandat ». */
  readonly enMandat = input<number>();

  /** Ont voté : pour + contre + abstention. */
  protected readonly votants = computed(() => {
    const { pour, contre, abstention } = this.compte();
    return pour + contre + abstention;
  });

  protected readonly segments = computed<Segment[]>(() => {
    const compte = this.compte();
    const pourcents = repartir(ORDRE.map((type) => compte[type]));
    return ORDRE.map((type, i) => ({ type, nombre: compte[type], pourcent: pourcents[i] }));
  });

  /** « 66 % pour (351) · 33 % contre (179) · 1 % abst. (7) », ou « Aucun vote exprimé ». */
  protected readonly pourcentages = computed(() =>
    this.votants() === 0
      ? 'Aucun vote exprimé'
      : this.segments()
          .map((s) => `${pourcentEntier(s.pourcent)} ${LIBELLES[s.type].court} (${s.nombre})`)
          .join(' · '),
  );

  /** Ceux qui n'ont pas voté, parmi les députés en mandat (non-votants officiels et absents). */
  protected readonly nonVotants = computed(() => {
    const enMandat = this.enMandat();
    if (enMandat === undefined || enMandat <= 0) return null;
    const nombre = Math.max(0, enMandat - this.votants());
    const pourcent = pourcentPartiel(nombre, enMandat);
    return {
      texte: `${nombre} ${nombre > 1 ? "n'ont" : "n'a"} pas voté sur ${enMandat} en mandat (${pourcent})`,
    };
  });

  /** Description complète de la barre pour les lecteurs d'écran : votants, pourcentages, puis ceux qui n'ont pas voté. */
  protected readonly resume = computed(() => {
    const votants = this.votants();
    const parts =
      votants === 0
        ? ['Aucun vote exprimé']
        : [
            `Sur ${accorder(votants, 'votant', 'votants')} : ` +
              this.segments()
                .map((s) => {
                  const { singulier, pluriel } = LIBELLES[s.type];
                  return `${accorder(s.nombre, singulier, pluriel)} (${pourcentEntier(s.pourcent)})`;
                })
                .join(', '),
          ];
    const nonVotants = this.nonVotants();
    const nonvotant = this.compte().nonvotant;
    if (nonVotants) parts.push(nonVotants.texte);
    else if (nonvotant > 0) parts.push(accorder(nonvotant, 'non-votant', 'non-votants'));
    return parts.join(', ');
  });
}
