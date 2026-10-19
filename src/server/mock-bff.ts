// BFF factice : sert les fixtures de src/server/fixtures/bff/ à la place du vrai serveur (MOCK_BFF=1).
// Fonction pure, sans Express ni Node : l'application (rendu serveur) comme les tests peuvent l'appeler.
import accueil from './fixtures/bff/accueil.json';
import deputes from './fixtures/bff/deputes.json';
import marineLePen from './fixtures/bff/deputes/marine-le-pen.json';
import mathildePanot from './fixtures/bff/deputes/mathilde-panot.json';
import loi51670 from './fixtures/bff/lois/DLR5L17N51670.json';
import loi54372 from './fixtures/bff/lois/DLR5L17N54372.json';
import scrutin8280 from './fixtures/bff/scrutins/8280.json';
import scrutin8430 from './fixtures/bff/scrutins/8430.json';

export interface ReponseMock {
  statut: number;
  entetes: Record<string, string>;
  corps: unknown;
}

/** Délai simulé du réseau et de la source, en millisecondes. */
export const DELAI_MOCK = 150;

const lois = new Map<string, unknown>([
  ['DLR5L17N51670', loi51670],
  ['DLR5L17N54372', loi54372],
]);
const scrutins = new Map<string, unknown>([
  ['8280', scrutin8280],
  ['8430', scrutin8430],
]);
const fichesDeputes = new Map<string, unknown>([
  ['marine-le-pen', marineLePen],
  ['mathilde-panot', mathildePanot],
]);

/** Cache-Control du plan (docs/PLAN.md, « routes BFF ») : s-maxage / stale-while-revalidate. */
const cache = (sMaxAge: number, perime: number) =>
  `public, s-maxage=${sMaxAge}, stale-while-revalidate=${perime}`;
const MINUTE = 60;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;
const SEMAINE = 7 * JOUR;

const ok = (corps: unknown, cacheControl: string): ReponseMock => ({
  statut: 200,
  entetes: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  corps,
});

const inconnu = (message: string): ReponseMock => ({
  statut: 404,
  entetes: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  corps: { erreur: message },
});

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Répond à une requête `GET /api/...` avec la fixture correspondante.
 * `url` est le chemin avec sa requête (« /api/accueil?page=1 »).
 */
export async function appelerMock(
  url: string,
  options: { delai?: number } = {},
): Promise<ReponseMock> {
  await attendre(options.delai ?? DELAI_MOCK);

  const { pathname, searchParams } = new URL(url, 'http://localhost');
  const chemin = decodeURIComponent(pathname).replace(/\/+$/, '');

  if (chemin === '/api/accueil') {
    const page = Number(searchParams.get('page') ?? '1');
    if (!Number.isInteger(page) || page < 1) {
      return inconnu('Page inconnue.');
    }
    // Une seule page de fixtures : les suivantes sont vides.
    const corps =
      page === 1 ? accueil : { lois: [], page, pageSuivante: false, miseAJour: accueil.miseAJour };
    return ok(corps, cache(30 * MINUTE, JOUR));
  }

  if (chemin === '/api/deputes') {
    return ok(deputes, cache(6 * HEURE, JOUR));
  }

  const [, , ressource, identifiant, ...reste] = chemin.split('/');
  if (identifiant === undefined || reste.length > 0) {
    return inconnu('Ressource inconnue.');
  }

  switch (ressource) {
    case 'lois': {
      const loi = lois.get(identifiant);
      return loi ? ok(loi, cache(HEURE, JOUR)) : inconnu('Loi inconnue.');
    }
    case 'scrutins': {
      const scrutin = scrutins.get(identifiant);
      return scrutin ? ok(scrutin, cache(JOUR, SEMAINE)) : inconnu('Scrutin inconnu.');
    }
    case 'deputes': {
      const depute = fichesDeputes.get(identifiant);
      return depute ? ok(depute, cache(HEURE, JOUR)) : inconnu('Député inconnu.');
    }
    default:
      return inconnu('Ressource inconnue.');
  }
}
