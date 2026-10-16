import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Réponse du BFF factice : même forme que celle de appelerBff (statut, en-têtes, corps JSON). */
export interface ReponseMock {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface OptionsMock {
  /** Délai simulé, en ms. */
  delai?: number;
  /** Racine du projet, où se trouve src/server/fixtures/bff. */
  racine?: string;
}

interface Cible {
  fichier: string;
  cache: string;
}

const DELAI_PAR_DEFAUT = 150;
const DOSSIER_FIXTURES = join('src', 'server', 'fixtures', 'bff');

// Cache-Control du plan (PLAN.md, « Architecture ») : max-age court pour le navigateur, s-maxage pour le CDN.
const CACHE = {
  accueil: 'public, max-age=60, s-maxage=1800, stale-while-revalidate=86400',
  loi: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
  scrutin: 'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800',
  deputes: 'public, max-age=60, s-maxage=21600, stale-while-revalidate=86400',
  depute: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
};

/** Décode un segment d'URL et ne garde que les identifiants bien formés (pas de « .. », pas de « / »). */
function identifiant(brut: string, motif: RegExp): string | null {
  let valeur: string;
  try {
    valeur = decodeURIComponent(brut);
  } catch {
    return null;
  }
  return motif.test(valeur) ? valeur : null;
}

const ROUTES: [RegExp, (m: RegExpMatchArray) => Cible | null][] = [
  [/^\/api\/accueil$/, () => ({ fichier: 'accueil.json', cache: CACHE.accueil })],
  [
    /^\/api\/lois\/([^/]+)$/,
    (m) => {
      const id = identifiant(m[1], /^DLR5L17N\d+$/);
      return id ? { fichier: `lois/${id}.json`, cache: CACHE.loi } : null;
    },
  ],
  [
    /^\/api\/scrutins\/([^/]+)$/,
    (m) => {
      const id = identifiant(m[1], /^\d+$/);
      return id ? { fichier: `scrutins/${id}.json`, cache: CACHE.scrutin } : null;
    },
  ],
  [/^\/api\/deputes$/, () => ({ fichier: 'deputes.json', cache: CACHE.deputes })],
  [
    /^\/api\/deputes\/([^/]+)$/,
    (m) => {
      const id = identifiant(m[1], /^[a-z0-9-]+$/);
      return id ? { fichier: `deputes/${id}.json`, cache: CACHE.depute } : null;
    },
  ],
];

function trouver(url: string, racine: string): Cible | null {
  const { pathname } = new URL(url, 'http://bff.local');
  for (const [motif, resoudre] of ROUTES) {
    const m = motif.exec(pathname);
    if (!m) continue;
    const cible = resoudre(m);
    if (cible && existsSync(join(racine, DOSSIER_FIXTURES, cible.fichier))) return cible;
    return null;
  }
  return null;
}

/**
 * Sert une route /api/* à partir des fixtures du BFF factice (MOCK_BFF=1), après un délai simulé.
 * Même forme de réponse que le vrai BFF, pour que l'application n'ait rien à savoir de la différence.
 */
export async function appelerMock(
  url: string,
  { delai = DELAI_PAR_DEFAUT, racine = process.cwd() }: OptionsMock = {},
): Promise<ReponseMock> {
  const cible = trouver(url, racine);
  await new Promise((resolve) => setTimeout(resolve, delai));
  if (!cible) {
    return {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: { erreur: 'Objet introuvable' },
    };
  }
  const contenu = readFileSync(join(racine, DOSSIER_FIXTURES, cible.fichier), 'utf8');
  return {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cible.cache },
    body: JSON.parse(contenu) as unknown,
  };
}
