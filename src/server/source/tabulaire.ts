import type { Limiteur } from './limiter';
import { ErreurDebit } from './limiter';

/** Client de l'API tabulaire. Avec colonnes.ts, c'est le seul module qui connaît data.gouv.fr. */

export type Ligne = Record<string, unknown>;
export type Valeur = string | number | boolean;

export interface Filtre {
  colonne: string;
  op: 'exact' | 'in' | 'contains' | 'less' | 'greater';
  /** Liste pour `in` (encodée par virgules), valeur simple sinon. */
  valeur: Valeur | Valeur[];
}

export interface Requete {
  filtres?: Filtre[];
  tri?: { colonne: string; ordre: 'asc' | 'desc' };
}

export interface Page {
  lignes: Ligne[];
  total: number;
  suivante: boolean;
}

export interface Tabulaire {
  /** Une page de lignes (pageSize plafonné à 200). N'écoute pas la limite des listes `in` : voir toutesLesLignes. */
  lignes(
    rid: string,
    requete: Requete,
    options?: { page?: number; pageSize?: number },
  ): Promise<Page>;
  /** Toutes les lignes : pagination en parallèle bornée par le limiteur, listes `in` découpées. */
  toutesLesLignes(rid: string, requete: Requete): Promise<Ligne[]>;
  /** Nombre de lignes (`meta.total`), sans rien télécharger. */
  compter(rid: string, requete: Requete): Promise<number>;
  /** Nombre de requêtes HTTP envoyées à la source depuis la création (journal du BFF). */
  requetesEmises(): number;
}

export interface OptionsTabulaire {
  base: string;
  fetch: typeof fetch;
  limiteur: Limiteur;
  /** Longueur maximale d'une liste `in`, au-delà elle est découpée. Valeur provisoire, à confirmer (prompt 00). */
  maxValeursIn?: number;
  /** Délai maximal d'une requête, en ms. */
  timeoutMs?: number;
}

export const BASE_PAR_DEFAUT = 'https://tabular-api.data.gouv.fr/api';

const TAILLE_PAGE_MAX = 200;
const MAX_VALEURS_IN_PAR_DEFAUT = 100;
const TIMEOUT_PAR_DEFAUT_MS = 8000;

/** Erreur de la source (HTTP, réseau, délai, réponse inattendue). */
export class ErreurSource extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ErreurSource';
  }
}

interface CorpsPage {
  data: Ligne[];
  meta: { total: number };
}

function versCorps(json: unknown): CorpsPage {
  const corps = json as Partial<CorpsPage> | null;
  if (!corps || !Array.isArray(corps.data) || typeof corps.meta?.total !== 'number') {
    throw new ErreurSource('réponse inattendue de la source');
  }
  return corps as CorpsPage;
}

function retryApres(reponse: Response): number | undefined {
  const valeur = Number(reponse.headers.get('retry-after'));
  return Number.isFinite(valeur) && valeur > 0 ? valeur : undefined;
}

function construireUrl(
  base: string,
  rid: string,
  requete: Requete,
  page: number,
  pageSize: number,
): string {
  const url = new URL(`${base}/resources/${encodeURIComponent(rid)}/data/`);
  for (const filtre of requete.filtres ?? []) {
    const valeur = Array.isArray(filtre.valeur) ? filtre.valeur.join(',') : String(filtre.valeur);
    url.searchParams.append(`${filtre.colonne}__${filtre.op}`, valeur);
  }
  if (requete.tri) url.searchParams.set(`${requete.tri.colonne}__sort`, requete.tri.ordre);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(pageSize));
  return url.href;
}

/** Découpe les listes `in` trop longues : une requête par morceau (produit cartésien si plusieurs). */
function decouper(requete: Requete, max: number): Requete[] {
  let variantes: Filtre[][] = [[]];
  for (const filtre of requete.filtres ?? []) {
    if (filtre.op === 'in' && Array.isArray(filtre.valeur) && filtre.valeur.length > max) {
      const morceaux: Filtre[] = [];
      for (let i = 0; i < filtre.valeur.length; i += max) {
        morceaux.push({ ...filtre, valeur: filtre.valeur.slice(i, i + max) });
      }
      variantes = variantes.flatMap((variante) =>
        morceaux.map((morceau) => [...variante, morceau]),
      );
    } else {
      variantes = variantes.map((variante) => [...variante, filtre]);
    }
  }
  return variantes.map((filtres) => ({ ...requete, filtres }));
}

export function creerTabulaire({
  base,
  fetch: fetchSource,
  limiteur,
  maxValeursIn = MAX_VALEURS_IN_PAR_DEFAUT,
  timeoutMs = TIMEOUT_PAR_DEFAUT_MS,
}: OptionsTabulaire): Tabulaire {
  const racine = base.replace(/\/+$/, '');
  let requetes = 0;

  async function appeler(url: string): Promise<CorpsPage> {
    requetes++;
    const controle = new AbortController();
    const minuterie = setTimeout(() => controle.abort(), timeoutMs);
    try {
      let reponse: Response;
      try {
        reponse = await fetchSource(url, {
          signal: controle.signal,
          headers: { accept: 'application/json' },
        });
      } catch (cause) {
        throw new ErreurSource('la source ne répond pas (réseau ou délai)', { cause });
      }
      if (reponse.status === 429 || reponse.status === 503) {
        throw new ErreurDebit(reponse.status, retryApres(reponse));
      }
      if (!reponse.ok) throw new ErreurSource(`la source répond HTTP ${reponse.status}`);
      try {
        return versCorps(await reponse.json());
      } catch (cause) {
        if (cause instanceof ErreurSource) throw cause;
        throw new ErreurSource('réponse illisible de la source', { cause });
      }
    } finally {
      clearTimeout(minuterie);
    }
  }

  /** Passe par le limiteur ; un débit refusé après le nouvel essai devient une ErreurSource. */
  async function lirePage(
    rid: string,
    requete: Requete,
    page: number,
    pageSize: number,
  ): Promise<Page> {
    const url = construireUrl(racine, rid, requete, page, pageSize);
    const corps = await limiteur
      .executer(url, () => appeler(url))
      .catch((erreur: unknown) => {
        if (erreur instanceof ErreurDebit) {
          throw new ErreurSource('la source limite le débit', { cause: erreur });
        }
        throw erreur;
      });
    return {
      lignes: corps.data,
      total: corps.meta.total,
      suivante: page * pageSize < corps.meta.total,
    };
  }

  return {
    lignes(rid, requete, { page = 1, pageSize = TAILLE_PAGE_MAX } = {}) {
      return lirePage(rid, requete, page, Math.min(pageSize, TAILLE_PAGE_MAX));
    },

    async toutesLesLignes(rid, requete) {
      const morceaux = await Promise.all(
        decouper(requete, maxValeursIn).map(async (morceau) => {
          const premiere = await lirePage(rid, morceau, 1, TAILLE_PAGE_MAX);
          const pages = Math.ceil(premiere.total / TAILLE_PAGE_MAX);
          const suivantes = await Promise.all(
            Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
              lirePage(rid, morceau, i + 2, TAILLE_PAGE_MAX),
            ),
          );
          return [premiere, ...suivantes].flatMap((page) => page.lignes);
        }),
      );
      return morceaux.flat();
    },

    async compter(rid, requete) {
      const totaux = await Promise.all(
        decouper(requete, maxValeursIn).map((morceau) =>
          lirePage(rid, morceau, 1, 1).then((page) => page.total),
        ),
      );
      return totaux.reduce((somme, total) => somme + total, 0);
    },

    requetesEmises: () => requetes,
  };
}
