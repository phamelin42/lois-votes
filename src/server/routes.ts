import { type Agregation } from './agregation';
import { ErreurDonnees } from './donnees';

/** Réponse d'un appel au BFF : c'est la signature de `appelerBff`. */
export interface ReponseBff {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface Bff {
  appelerBff(url: string): Promise<ReponseBff>;
}

// Cache-Control du plan (PLAN.md) : 60 s dans le navigateur, durée du CDN et stale-while-revalidate.
const CACHE_CONTROL = {
  accueil: 'public, max-age=60, s-maxage=1800, stale-while-revalidate=86400',
  loi: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
  scrutin: 'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800',
  deputes: 'public, max-age=60, s-maxage=21600, stale-while-revalidate=86400',
  depute: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
};

const ENTETES_JSON = { 'content-type': 'application/json; charset=utf-8' };
const PAGE_MAX = 50;

function reussite(corps: unknown, cacheControl: string): ReponseBff {
  return { status: 200, headers: { ...ENTETES_JSON, 'cache-control': cacheControl }, body: corps };
}

function echec(status: number, message: string): ReponseBff {
  const headers: Record<string, string> = { ...ENTETES_JSON, 'cache-control': 'no-store' };
  if (status === 503) headers['retry-after'] = '60';
  return { status, headers, body: { erreur: message } };
}

/** Décode un segment d'URL et ne garde que la valeur qui respecte le motif. */
function identifiant(brut: string, motif: RegExp): string | null {
  let valeur: string;
  try {
    valeur = decodeURIComponent(brut);
  } catch {
    return null;
  }
  return motif.test(valeur) ? valeur : null;
}

/** Page de 1 à 50 ; absente, elle vaut 1. Null si invalide. */
function lirePage(brute: string | null): number | null {
  if (brute === null) return 1;
  if (!/^\d+$/.test(brute)) return null;
  const page = Number(brute);
  return page >= 1 && page <= PAGE_MAX ? page : null;
}

function traiter(agregation: Agregation, chemin: string, params: URLSearchParams): ReponseBff {
  if (chemin === '/api/accueil') {
    const page = lirePage(params.get('page'));
    if (page === null) return echec(404, 'Page invalide : de 1 à 50');
    return reussite(agregation.accueil(page), CACHE_CONTROL.accueil);
  }

  const loi = /^\/api\/lois\/([^/]+)$/.exec(chemin);
  if (loi) {
    const dossier = identifiant(loi[1], /^DL[A-Z0-9]+$/);
    const detail = dossier ? agregation.loi(dossier) : null;
    return detail ? reussite(detail, CACHE_CONTROL.loi) : echec(404, 'Loi introuvable');
  }

  const scrutin = /^\/api\/scrutins\/([^/]+)$/.exec(chemin);
  if (scrutin) {
    const numero = identifiant(scrutin[1], /^\d+$/);
    const detail = numero ? agregation.scrutin(Number(numero)) : null;
    return detail ? reussite(detail, CACHE_CONTROL.scrutin) : echec(404, 'Scrutin introuvable');
  }

  if (chemin === '/api/deputes') {
    return reussite(agregation.deputes(), CACHE_CONTROL.deputes);
  }

  const depute = /^\/api\/deputes\/([^/]+)$/.exec(chemin);
  if (depute) {
    const slug = identifiant(depute[1], /^[a-z0-9-]+$/);
    const detail = slug ? agregation.depute(slug) : null;
    return detail ? reussite(detail, CACHE_CONTROL.depute) : echec(404, 'Député introuvable');
  }

  return echec(404, 'Route inconnue');
}

/**
 * Le BFF : une route `/api/*` par fonction de l'agrégation, toutes servies depuis la mémoire. Une erreur
 * de données devient 503, toute autre erreur 500, sans détail vers le navigateur.
 */
export function creerBff(agregation: Agregation): Bff {
  return {
    async appelerBff(url) {
      const adresse = new URL(url, 'http://bff.local');
      try {
        return traiter(agregation, adresse.pathname, adresse.searchParams);
      } catch (erreur) {
        if (erreur instanceof ErreurDonnees) return echec(503, 'Données indisponibles');
        console.error('[bff] erreur inattendue', erreur);
        return echec(500, 'Erreur interne');
      }
    },
  };
}

/** Données absentes ou invalides : toutes les routes `/api/*` répondent 503, jamais un faux contenu. */
export function creerBffIndisponible(): Bff {
  return { appelerBff: async () => echec(503, 'Données indisponibles') };
}
