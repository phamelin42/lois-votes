import { creerBff, type ReponseBff } from './routes';
import { creerCache } from './cache';
import { appelerMock } from './mock-bff';
import { creerLimiteur } from './source/limiter';
import { BASE_PAR_DEFAUT, creerTabulaire } from './source/tabulaire';

export type AppelerBff = (url: string) => Promise<ReponseBff>;

/** BFF réel : l'API tabulaire, avec son cache et son limiteur partagés par toutes les requêtes. */
function creerBffReel(): AppelerBff {
  const tabulaire = creerTabulaire({
    base: process.env['TABULAR_API_BASE'] || BASE_PAR_DEFAUT,
    fetch: globalThis.fetch,
    limiteur: creerLimiteur(),
  });
  const bff = creerBff({ tabulaire, cache: creerCache() });
  return async (url) => {
    const debut = performance.now();
    const avant = tabulaire.requetesEmises();
    const reponse = await bff.appelerBff(url);
    // Approximatif quand plusieurs requêtes s'exécutent en même temps : le compteur est global.
    const requetes = tabulaire.requetesEmises() - avant;
    const duree = Math.round(performance.now() - debut);
    console.log(
      `[bff] ${url} ${reponse.status} ${duree} ms, ${requetes} requête(s) à la source (cache: ${requetes > 0 ? 'miss' : 'hit'})`,
    );
    return reponse;
  };
}

/** `MOCK_BFF=1` : les fixtures du BFF factice ; sinon le BFF réel. */
export const appelerBffActif: AppelerBff =
  process.env['MOCK_BFF'] === '1' ? (url) => appelerMock(url) : creerBffReel();
