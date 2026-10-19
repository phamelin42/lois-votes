import { join } from 'node:path';
import { creerAgregation } from './agregation';
import { chargerDonnees, decrireChargement, dossierDonnees } from './donnees';
import { creerBff, creerBffIndisponible, type Bff, type ReponseBff } from './routes';

export type AppelerBff = (url: string) => Promise<ReponseBff>;

/**
 * Le BFF est partagé par `globalThis` : le build en fait deux copies de ce module (celle de `server.mjs` pour
 * `/api/*`, celle du rendu serveur Angular pour les pages), et chacune relirait `data/` : deux fois la mémoire.
 */
const CLE_BFF = Symbol.for('lois-votes.bff');
const partage = globalThis as typeof globalThis & { [CLE_BFF]?: Bff };

/**
 * Charge `data/` (`DONNEES_DIR`, sinon `data/` à côté de `server/` dans le build) et prépare le BFF. Si les
 * données manquent ou sont invalides, l'erreur est journalisée et toutes les routes `/api/*` répondent 503.
 * Le chargement a lieu une fois, au premier appel ou à `prechargerDonnees()`.
 */
function obtenirBff(): Bff {
  const existant = partage[CLE_BFF];
  if (existant) return existant;
  const dossier = dossierDonnees(process.env, join(import.meta.dirname, '..', 'data'));
  try {
    const donnees = chargerDonnees(dossier);
    console.log(`[donnees] ${dossier} chargé : ${decrireChargement(donnees)}`);
    return (partage[CLE_BFF] = creerBff(creerAgregation(donnees)));
  } catch (erreur) {
    console.error(
      `[donnees] ${dossier} inutilisable, les routes /api répondent 503 : ${(erreur as Error).message}`,
    );
    return (partage[CLE_BFF] = creerBffIndisponible());
  }
}

/** Lit `data/` maintenant plutôt qu'à la première requête (démarrage du serveur). */
export function prechargerDonnees(): void {
  obtenirBff();
}

/** Le BFF de l'application : `/api/*` répond depuis `data/`, en mémoire, sans réseau. */
export const appelerBffActif: AppelerBff = async (url) => {
  const debut = performance.now();
  const reponse = await obtenirBff().appelerBff(url);
  console.log(`[bff] ${url} ${reponse.status} ${Math.round(performance.now() - debut)} ms`);
  return reponse;
};
