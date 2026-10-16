// Faux serveur HTTP de l'API tabulaire, pour les e2e et les mesures Lighthouse. Sert le jeu de données de test
// (src/server/testing/univers.mjs) avec la même forme de réponse que data.gouv.fr. Sans dépendance.
//
// Usage en ligne de commande : FAUX_PORT=4010 [FAUX_ERREUR=500|429] node e2e/faux-tabulaire.mjs

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { BASE_FAUSSE, creerUnivers } from '../src/server/testing/univers.mjs';

/**
 * Démarre le faux serveur. `port: 0` choisit un port libre ; `erreur` (500 ou 429) répond cette erreur à toutes
 * les requêtes, comme une source en panne ou qui limite le débit.
 * @returns {Promise<{ url: string, fermer: () => Promise<void> }>}
 */
export function demarrer({ port = 0, erreur } = {}) {
  const univers = creerUnivers();
  const serveur = createServer(async (requete, reponse) => {
    if (erreur) {
      const entetes = erreur === 429 ? { 'retry-after': '1' } : {};
      reponse.writeHead(erreur, { 'content-type': 'application/json', ...entetes });
      reponse.end(JSON.stringify({ erreur: `erreur simulée ${erreur}` }));
      return;
    }
    // Le faux serveur attend l'adresse de l'API réelle : on la réécrit sur la base du jeu de données.
    const adresse = new URL(requete.url ?? '/', 'http://localhost');
    const cible = new URL(BASE_FAUSSE);
    const reponseFaussee = await univers.fetch(
      `${cible.origin}${adresse.pathname}${adresse.search}`,
      {},
    );
    reponse.writeHead(reponseFaussee.status, Object.fromEntries(reponseFaussee.headers));
    reponse.end(Buffer.from(await reponseFaussee.arrayBuffer()));
  });

  return new Promise((resoudre, rejeter) => {
    serveur.once('error', rejeter);
    serveur.listen(port, () => {
      const { port: libre } = serveur.address();
      resoudre({
        url: `http://localhost:${libre}`,
        fermer: () => new Promise((fin) => serveur.close(() => fin())),
      });
    });
  });
}

// En ligne de commande : écoute sur FAUX_PORT.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env['FAUX_PORT'] ?? 4010);
  const erreur = process.env['FAUX_ERREUR'] ? Number(process.env['FAUX_ERREUR']) : undefined;
  const { url } = await demarrer({ port, erreur });
  console.log(`Faux serveur tabulaire sur ${url}${erreur ? ` (erreur ${erreur})` : ''}`);
}
