#!/usr/bin/env node
// Dernière étape de `npm run build` : copie `data/` (produit par `npm run donnees`) vers `dist/lois-votes/data/`,
// à côté de `server/` et `browser/`. Le serveur y lit ses données au démarrage, et la fonction Vercel les embarque
// avec le reste de `dist/lois-votes/**`. `data/` n'est jamais copié dans `browser/` : il ne doit pas être public.

import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FICHIERS = [
  'meta.json',
  'groupes.json',
  'deputes.json',
  'scrutins.json',
  'votes.txt',
  'groupes-votes.txt',
];

/**
 * @param {object} [options]
 * @param {string} [options.depuis] Dossier des données préparées.
 * @param {string} [options.vers] Dossier de destination, dans le build.
 * @param {string} [options.build] Dossier du build, qui doit exister.
 */
export function copier({
  depuis = 'data',
  vers = join('dist', 'lois-votes', 'data'),
  build = join('dist', 'lois-votes'),
} = {}) {
  if (!existsSync(build)) throw new Error(`build introuvable : ${build} (lancer ng build d'abord)`);
  const manquants = FICHIERS.filter((nom) => !existsSync(join(depuis, nom)));
  if (manquants.length > 0)
    throw new Error(
      `${depuis}/ incomplet, il manque : ${manquants.join(', ')} (lancer npm run donnees)`,
    );
  rmSync(vers, { recursive: true, force: true });
  cpSync(depuis, vers, { recursive: true });
  return vers;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(`[build] données copiées vers ${copier()}/`);
  } catch (erreur) {
    console.error(`[build] ÉCHEC : ${erreur.message}`);
    process.exit(1);
  }
}
