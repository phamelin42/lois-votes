import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Compte, PositionGroupe, TypeScrutin } from '@contrat';
import {
  CARACTERES_GROUPE,
  type DeputeFichier,
  type DonneesMeta,
  type GroupeFichier,
  type ScrutinFichier,
} from './donnees.types';

/*
 * Chargement de `data/` (voir docs/DONNEES.md) : les six fichiers sont lus une fois au démarrage, validés,
 * puis gardés en mémoire sous une forme compacte. Aucun appel réseau, aucun accès disque après le chargement.
 *  - `scrutins.json` (12 Mo de JSON) est réduit à des tableaux typés : ni objet par scrutin, ni objet par groupe ;
 *    les groupes d'un scrutin sont relus à la demande ;
 *  - les deux matrices restent des tampons d'octets (5,8 Mo chacune), indexés par ligne de longueur fixe.
 */

/** Données absentes ou invalides : le serveur répond 503 sur `/api/*` plutôt que de servir un faux contenu. */
export class ErreurDonnees extends Error {
  override readonly name = 'ErreurDonnees';
}

export const POSITIONS_GROUPE: readonly PositionGroupe[] = [
  'pour',
  'contre',
  'abstention',
  'nonvotant',
  'partage',
];
const TYPES: readonly TypeScrutin[] = ['final', 'motion', 'article', 'amendement', 'autre'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Valeurs par entrée de groupe : index du groupe, position, puis les quatre décomptes. */
const LARGEUR_ENTREE = 6;
const NEWLINE = 0x0a;
const CODES_VOTE = new Set([...'PCANX-'].map((c) => c.charCodeAt(0)));
const CODE_TIRET = '-'.charCodeAt(0);
const VOTE_EXPRIME_OU_NON_VOTANT = new Set([...'PCAN'].map((c) => c.charCodeAt(0)));

/** Une entrée de groupe d'un scrutin, relue depuis les tableaux compacts. */
export interface GroupeDuScrutin {
  /** Index dans `groupes.json`. */
  g: number;
  position: PositionGroupe;
  compte: Compte;
}

export interface Mesures {
  /** Durée du chargement (lecture, analyse, validation), en millisecondes. */
  dureeMs: number;
  /** Mémoire du processus juste après le chargement, en octets. */
  heapUtilise: number;
  rss: number;
  externe: number;
  /** Octets lus sur le disque. */
  octetsLus: number;
}

function lireTexte(dossier: string, nom: string): Buffer {
  try {
    return readFileSync(join(dossier, nom));
  } catch (erreur) {
    const code = (erreur as NodeJS.ErrnoException).code;
    throw new ErreurDonnees(
      code === 'ENOENT'
        ? `fichier manquant : ${join(dossier, nom)}`
        : `fichier illisible : ${join(dossier, nom)} (${(erreur as Error).message})`,
      { cause: erreur },
    );
  }
}

function lireJson<T>(dossier: string, nom: string): { valeur: T; octets: number } {
  const tampon = lireTexte(dossier, nom);
  try {
    return { valeur: JSON.parse(tampon.toString('utf8')) as T, octets: tampon.length };
  } catch (erreur) {
    throw new ErreurDonnees(`${nom} : JSON invalide (${(erreur as Error).message})`, {
      cause: erreur,
    });
  }
}

function verifier(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ErreurDonnees(message);
}

const entierPositif = (x: unknown): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0;

function verifierCompte(compte: Compte, contexte: string): void {
  for (const cle of ['pour', 'contre', 'abstention', 'nonvotant'] as const) {
    verifier(
      entierPositif(compte?.[cle]) && compte[cle] <= 0xffff,
      `${contexte} : compte.${cle} invalide`,
    );
  }
}

/** Données de `data/` en mémoire, sous forme compacte, avec des accès typés. */
export class DonneesChargees {
  readonly meta: DonneesMeta;
  readonly groupes: readonly GroupeFichier[];
  readonly deputes: readonly DeputeFichier[];
  readonly nbScrutins: number;
  readonly nbDeputes: number;
  /** Indice d'un scrutin par son numéro. */
  readonly parNumero: ReadonlyMap<number, number>;
  /** Indices des scrutins d'un dossier, du plus récent au plus ancien (date, puis numéro). */
  readonly parDossier: ReadonlyMap<string, readonly number[]>;
  /** Indice d'un député par son slug. */
  readonly parSlug: ReadonlyMap<string, number>;
  /** Indices de tous les scrutins, du plus récent au plus ancien (date, puis numéro). */
  readonly ordreRecent: readonly number[];
  readonly mesures: Mesures;

  private readonly numeros: Int32Array;
  private readonly dates: string[];
  private readonly titres: string[];
  private readonly types: Uint8Array;
  private readonly adoptes: Uint8Array;
  private readonly dossiers: (string | null)[];
  private readonly comptes: Uint16Array;
  /** Députés en mandat à chaque scrutin (cases ≠ « - » de la matrice), calculés une fois au chargement. */
  private readonly enMandats: Uint16Array;
  private readonly debutGroupes: Uint32Array;
  private readonly entrees: Uint16Array;
  private readonly votes: Uint8Array;
  private readonly groupesVotes: Uint8Array;
  /** Longueur d'une ligne des matrices, saut de ligne compris. */
  private readonly pas: number;

  constructor(dossier: string) {
    const debut = performance.now();
    const meta = lireJson<DonneesMeta>(dossier, 'meta.json');
    const groupes = lireJson<GroupeFichier[]>(dossier, 'groupes.json');
    const deputes = lireJson<DeputeFichier[]>(dossier, 'deputes.json');
    const scrutins = lireJson<ScrutinFichier[]>(dossier, 'scrutins.json');
    const votes = lireTexte(dossier, 'votes.txt');
    const groupesVotes = lireTexte(dossier, 'groupes-votes.txt');
    const octetsLus = meta.octets + groupes.octets + deputes.octets + scrutins.octets;

    this.meta = meta.valeur;
    this.groupes = groupes.valeur;
    this.deputes = deputes.valeur;
    verifier(this.meta && typeof this.meta.genereLe === 'string', 'meta.json : genereLe manquant');
    verifier(Array.isArray(this.groupes) && Array.isArray(this.deputes), 'tableaux attendus');
    verifier(Array.isArray(scrutins.valeur), 'scrutins.json : tableau attendu');

    const nbScrutins = scrutins.valeur.length;
    const nbDeputes = this.deputes.length;
    this.nbScrutins = nbScrutins;
    this.nbDeputes = nbDeputes;
    verifier(nbScrutins > 0 && nbDeputes > 0, 'aucun scrutin ou aucun député');
    verifier(
      this.groupes.length > 0 && this.groupes.length <= CARACTERES_GROUPE.length,
      `groupes.json : 1 à ${CARACTERES_GROUPE.length} groupes attendus`,
    );
    verifier(
      this.meta.scrutins === nbScrutins &&
        this.meta.deputes === nbDeputes &&
        this.meta.groupes === this.groupes.length,
      'meta.json : effectifs différents des fichiers',
    );

    // Groupes et députés.
    const idsGroupes = new Set<string>();
    for (const g of this.groupes) {
      verifier(typeof g?.id === 'string' && typeof g.abrege === 'string', 'groupes.json : entrée');
      verifier(!idsGroupes.has(g.id), `groupes.json : ${g.id} en double`);
      idsGroupes.add(g.id);
    }
    const parSlug = new Map<string, number>();
    this.deputes.forEach((d, i) => {
      verifier(
        typeof d?.pa === 'string' && typeof d.slug === 'string' && typeof d.nom === 'string',
        `deputes.json : entrée ${i}`,
      );
      verifier(!parSlug.has(d.slug), `deputes.json : slug ${d.slug} en double`);
      verifier(d.groupe === null || idsGroupes.has(d.groupe), `deputes.json : groupe de ${d.slug}`);
      parSlug.set(d.slug, i);
    });
    this.parSlug = parSlug;

    // Matrices : une ligne par scrutin, un octet par député, lignes séparées par « \n ».
    this.pas = nbDeputes + 1;
    for (const [nom, matrice] of [
      ['votes.txt', votes],
      ['groupes-votes.txt', groupesVotes],
    ] as const) {
      verifier(
        matrice.length === nbScrutins * this.pas - 1,
        `${nom} : ${matrice.length} octets pour ${nbScrutins} scrutins × ${nbDeputes} députés (${nbScrutins * this.pas - 1} attendus)`,
      );
      for (let s = 1; s < nbScrutins; s++) {
        verifier(
          matrice[s * this.pas - 1] === NEWLINE,
          `${nom} : la ligne ${s} n'a pas ${nbDeputes} caractères`,
        );
      }
    }
    this.votes = votes;
    this.groupesVotes = groupesVotes;
    this.verifierMatrices();
    this.enMandats = this.compterEnMandat();

    // Scrutins.
    const numeros = new Int32Array(nbScrutins);
    const dates = new Array<string>(nbScrutins);
    const titres = new Array<string>(nbScrutins);
    const types = new Uint8Array(nbScrutins);
    const adoptes = new Uint8Array(nbScrutins);
    const dossiers = new Array<string | null>(nbScrutins);
    const comptes = new Uint16Array(nbScrutins * 4);
    const debutGroupes = new Uint32Array(nbScrutins + 1);
    let nbEntrees = 0;
    for (const s of scrutins.valeur) nbEntrees += Array.isArray(s?.groupes) ? s.groupes.length : 0;
    const entrees = new Uint16Array(nbEntrees * LARGEUR_ENTREE);
    const parNumero = new Map<number, number>();
    const parDossier = new Map<string, number[]>();
    const internes = new Map<string, string>();

    let e = 0;
    scrutins.valeur.forEach((s, i) => {
      const ctx = `scrutins.json : scrutin ${s?.n}`;
      verifier(
        entierPositif(s?.n) && s.n <= 0x7fffffff,
        `scrutins.json : numéro de l'élément ${i}`,
      );
      verifier(
        i === 0 || numeros[i - 1] > s.n,
        `${ctx} : ordre décroissant des numéros non respecté`,
      );
      verifier(typeof s.date === 'string' && DATE.test(s.date), `${ctx} : date`);
      verifier(typeof s.titre === 'string', `${ctx} : titre`);
      const type = TYPES.indexOf(s.type);
      verifier(type >= 0, `${ctx} : type ${s.type}`);
      verifier(typeof s.adopte === 'boolean', `${ctx} : adopte`);
      verifier(s.dossier === null || typeof s.dossier === 'string', `${ctx} : dossier`);
      verifierCompte(s.compte, ctx);
      verifier(Array.isArray(s.groupes), `${ctx} : groupes`);

      numeros[i] = s.n;
      dates[i] = s.date;
      titres[i] = s.titre;
      types[i] = type;
      adoptes[i] = s.adopte ? 1 : 0;
      let dossierInterne: string | null = null;
      if (s.dossier !== null) {
        dossierInterne = internes.get(s.dossier) ?? s.dossier;
        internes.set(dossierInterne, dossierInterne);
        const liste = parDossier.get(dossierInterne) ?? [];
        liste.push(i);
        parDossier.set(dossierInterne, liste);
      }
      dossiers[i] = dossierInterne;
      comptes.set([s.compte.pour, s.compte.contre, s.compte.abstention, s.compte.nonvotant], i * 4);
      parNumero.set(s.n, i);

      debutGroupes[i] = e / LARGEUR_ENTREE;
      const somme = [0, 0, 0, 0];
      const vus = new Set<number>();
      for (const g of s.groupes) {
        verifier(
          entierPositif(g?.g) && g.g < this.groupes.length && !vus.has(g.g),
          `${ctx} : groupe ${g?.g}`,
        );
        vus.add(g.g);
        const position = POSITIONS_GROUPE.indexOf(g.position);
        verifier(position >= 0, `${ctx} : position ${g.position}`);
        verifierCompte(g.compte, `${ctx}, groupe ${g.g}`);
        entrees.set(
          [g.g, position, g.compte.pour, g.compte.contre, g.compte.abstention, g.compte.nonvotant],
          e,
        );
        e += LARGEUR_ENTREE;
        somme[0] += g.compte.pour;
        somme[1] += g.compte.contre;
        somme[2] += g.compte.abstention;
        somme[3] += g.compte.nonvotant;
      }
      verifier(
        somme[0] === s.compte.pour &&
          somme[1] === s.compte.contre &&
          somme[2] === s.compte.abstention &&
          somme[3] === s.compte.nonvotant,
        `${ctx} : la somme des groupes diffère du décompte`,
      );
    });
    debutGroupes[nbScrutins] = e / LARGEUR_ENTREE;

    this.numeros = numeros;
    this.dates = dates;
    this.titres = titres;
    this.types = types;
    this.adoptes = adoptes;
    this.dossiers = dossiers;
    this.comptes = comptes;
    this.debutGroupes = debutGroupes;
    this.entrees = entrees;
    this.parNumero = parNumero;

    // Du plus récent au plus ancien : par date, puis par numéro (déterministe).
    const ordre = Array.from({ length: nbScrutins }, (_, i) => i).sort(
      (a, b) => (dates[a] < dates[b] ? 1 : dates[a] > dates[b] ? -1 : 0) || numeros[b] - numeros[a],
    );
    this.ordreRecent = ordre;
    const rang = new Int32Array(nbScrutins);
    ordre.forEach((s, r) => (rang[s] = r));
    for (const liste of parDossier.values()) liste.sort((a, b) => rang[a] - rang[b]);
    this.parDossier = parDossier;

    const memoire = process.memoryUsage();
    this.mesures = {
      dureeMs: performance.now() - debut,
      heapUtilise: memoire.heapUsed,
      rss: memoire.rss,
      externe: memoire.external,
      octetsLus: octetsLus + votes.length + groupesVotes.length,
    };
  }

  /** Contrôle chaque case des deux matrices : caractères connus, groupe valide pour une case listée. */
  private verifierMatrices(): void {
    const { votes, groupesVotes, nbGroupesMax } = {
      votes: this.votes,
      groupesVotes: this.groupesVotes,
      nbGroupesMax: this.groupes.length,
    };
    const codesGroupes = new Map<number, number>();
    for (let g = 0; g < nbGroupesMax; g++) codesGroupes.set(CARACTERES_GROUPE.charCodeAt(g), g);
    for (let i = 0; i < votes.length; i++) {
      const v = votes[i];
      const g = groupesVotes[i];
      if (v === NEWLINE) {
        verifier(g === NEWLINE, 'groupes-votes.txt : lignes différentes de votes.txt');
        continue;
      }
      verifier(CODES_VOTE.has(v), `votes.txt : caractère inconnu à l'octet ${i}`);
      if (VOTE_EXPRIME_OU_NON_VOTANT.has(v)) {
        verifier(codesGroupes.has(g), `groupes-votes.txt : groupe inconnu à l'octet ${i}`);
      } else if (g !== CODE_TIRET) {
        verifier(codesGroupes.has(g), `groupes-votes.txt : groupe inconnu à l'octet ${i}`);
        verifier(
          v === 'X'.charCodeAt(0),
          `groupes-votes.txt : groupe pour une case « - » à l'octet ${i}`,
        );
      }
    }
  }

  /** Compte, par scrutin, les cases ≠ « - » : les députés en mandat ce jour-là (au plus 0xffff : une ligne tient dans `Uint16Array` car il y a moins de 65 536 députés). */
  private compterEnMandat(): Uint16Array {
    verifier(this.nbDeputes <= 0xffff, `deputes.json : ${this.nbDeputes} députés (65 535 au plus)`);
    const enMandats = new Uint16Array(this.nbScrutins);
    for (let s = 0; s < this.nbScrutins; s++) {
      const debut = s * this.pas;
      let n = 0;
      for (let d = 0; d < this.nbDeputes; d++) if (this.votes[debut + d] !== CODE_TIRET) n++;
      enMandats[s] = n;
    }
    return enMandats;
  }

  numero(s: number): number {
    return this.numeros[s];
  }
  date(s: number): string {
    return this.dates[s];
  }
  titre(s: number): string {
    return this.titres[s];
  }
  type(s: number): TypeScrutin {
    return TYPES[this.types[s]];
  }
  adopte(s: number): boolean {
    return this.adoptes[s] === 1;
  }
  dossier(s: number): string | null {
    return this.dossiers[s];
  }
  /** Nombre de députés en mandat au scrutin `s` (voir `ScrutinResume.enMandat`). */
  enMandat(s: number): number {
    return this.enMandats[s];
  }
  compte(s: number): Compte {
    const c = this.comptes;
    return {
      pour: c[s * 4],
      contre: c[s * 4 + 1],
      abstention: c[s * 4 + 2],
      nonvotant: c[s * 4 + 3],
    };
  }

  /** Les groupes d'un scrutin, dans l'ordre de `groupes.json`. */
  groupesDuScrutin(s: number): GroupeDuScrutin[] {
    const resultat: GroupeDuScrutin[] = [];
    for (let e = this.debutGroupes[s]; e < this.debutGroupes[s + 1]; e++) {
      const x = e * LARGEUR_ENTREE;
      const v = this.entrees;
      resultat.push({
        g: v[x],
        position: POSITIONS_GROUPE[v[x + 1]],
        compte: { pour: v[x + 2], contre: v[x + 3], abstention: v[x + 4], nonvotant: v[x + 5] },
      });
    }
    return resultat;
  }

  /** Position du groupe `g` au scrutin `s`, ou `null` si ce groupe n'y figure pas. */
  positionDuGroupe(s: number, g: number): PositionGroupe | null {
    for (let e = this.debutGroupes[s]; e < this.debutGroupes[s + 1]; e++) {
      if (this.entrees[e * LARGEUR_ENTREE] === g)
        return POSITIONS_GROUPE[this.entrees[e * LARGEUR_ENTREE + 1]];
    }
    return null;
  }

  /** Case du député `d` au scrutin `s` : `P`, `C`, `A`, `N`, `X` ou `-` (voir docs/DONNEES.md). */
  caseVote(s: number, d: number): string {
    return String.fromCharCode(this.votes[s * this.pas + d]);
  }

  /** Index du groupe du député au jour du scrutin, ou -1 (case `-`, ou absent dont le groupe n'est pas dans le scrutin). */
  groupeAuVote(s: number, d: number): number {
    const code = this.groupesVotes[s * this.pas + d];
    return code === CODE_TIRET ? -1 : CARACTERES_GROUPE.indexOf(String.fromCharCode(code));
  }
}

/** Dossier de `data/` : `DONNEES_DIR`, sinon `defaut`. */
export function dossierDonnees(env: Record<string, string | undefined>, defaut: string): string {
  return env['DONNEES_DIR'] || defaut;
}

/**
 * Charge et valide `data/`. Lève une {@link ErreurDonnees} (message clair, en français) si un fichier manque,
 * est illisible, ou si les fichiers sont incohérents entre eux.
 */
export function chargerDonnees(dossier: string): DonneesChargees {
  return new DonneesChargees(dossier);
}

const mo = (octets: number) => `${(octets / 1024 / 1024).toFixed(1)} Mo`;

/** Ligne de journal du chargement : durée et mémoire. */
export function decrireChargement(donnees: DonneesChargees): string {
  const m = donnees.mesures;
  return (
    `${donnees.nbScrutins} scrutins, ${donnees.nbDeputes} députés, ${donnees.groupes.length} groupes ` +
    `(${mo(m.octetsLus)} lus) en ${Math.round(m.dureeMs)} ms ; mémoire : tas ${mo(m.heapUtilise)}, ` +
    `tampons ${mo(m.externe)}, rss ${mo(m.rss)} ; données du ${donnees.meta.genereLe}`
  );
}
