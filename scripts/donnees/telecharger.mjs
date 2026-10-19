// Téléchargement des deux archives officielles de l'Assemblée nationale (cache et ETag), dézippage en mémoire
// avec fflate, ou lecture des fixtures (mode `DONNEES_DEPUIS=fixtures`). Aucune clé, aucune base.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { unzipSync } from 'fflate';

const RACINE = 'https://data.assemblee-nationale.fr/static/openData/repository/17';

export const URL_SCRUTINS = `${RACINE}/loi/scrutins/Scrutins.json.zip`;
export const URL_ACTEURS = `${RACINE}/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`;

/** En dessous, l'archive est tronquée ou n'est pas l'archive (page d'erreur) : on échoue. */
export const TAILLE_MINIMALE = 1024 * 1024;

/** Pauses entre deux tentatives (ms) quand le réseau coupe ou que le serveur répond 5xx. */
export const PAUSES_PAR_DEFAUT = [2000, 4000, 8000, 16000];

const attendreMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Erreur qui ne se résout pas en réessayant (statut 4xx, archive trop petite). */
class ErreurDefinitive extends Error {}

/**
 * @typedef {{ url: string, lastModified: string | null, etag: string | null }} SourceArchive
 * @typedef {{ octets: Uint8Array, source: SourceArchive, depuisCache: boolean }} Archive
 */

function lireCache(dossier, url) {
  const zip = join(dossier, 'archive.zip');
  const metaChemin = join(dossier, 'meta.json');
  if (!existsSync(zip) || !existsSync(metaChemin)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaChemin, 'utf8'));
    if (meta.url !== url || !meta.etag || statSync(zip).size !== meta.taille) return null;
    return { zip, meta };
  } catch {
    return null;
  }
}

function ecrireCache(dossier, octets, source) {
  mkdirSync(dossier, { recursive: true });
  const zip = join(dossier, 'archive.zip');
  // Archive d'abord, métadonnées ensuite : sans meta.json valide, le cache est ignoré.
  writeFileSync(`${zip}.tmp`, octets);
  renameSync(`${zip}.tmp`, zip);
  const meta = { ...source, taille: octets.length };
  writeFileSync(join(dossier, 'meta.json.tmp'), JSON.stringify(meta));
  renameSync(join(dossier, 'meta.json.tmp'), join(dossier, 'meta.json'));
}

/**
 * Télécharge une archive. Avec un cache valide, envoie `If-None-Match` et réutilise le fichier sur 304.
 * Échoue clairement si le statut n'est pas 200, si le corps est incomplet ou si la taille est inférieure à 1 Mo.
 *
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.dossier Dossier de cache, propre à cette archive (créé au besoin).
 * @param {typeof fetch} [options.fetch]
 * @param {number[]} [options.pauses]
 * @param {(ms: number) => Promise<void>} [options.attendre]
 * @param {(message: string) => void} [options.journal]
 * @returns {Promise<Archive>}
 */
export async function telecharger({
  url,
  dossier,
  fetch: requete = globalThis.fetch,
  pauses = PAUSES_PAR_DEFAUT,
  attendre = attendreMs,
  journal = () => {},
}) {
  const cache = lireCache(dossier, url);
  let derniereErreur;
  for (let essai = 0; essai <= pauses.length; essai++) {
    if (essai > 0) {
      journal(`nouvel essai dans ${pauses[essai - 1] / 1000} s (${derniereErreur.message})`);
      await attendre(pauses[essai - 1]);
    }
    try {
      return await essayer({ url, dossier, cache, requete, journal });
    } catch (erreur) {
      if (erreur instanceof ErreurDefinitive) throw erreur;
      derniereErreur = erreur;
    }
  }
  throw new Error(
    `${url} : téléchargement impossible après ${pauses.length + 1} essais (${derniereErreur.message})`,
    {
      cause: derniereErreur,
    },
  );
}

async function essayer({ url, dossier, cache, requete, journal }) {
  const entetes = cache ? { 'If-None-Match': cache.meta.etag } : {};
  const reponse = await requete(url, { headers: entetes });

  if (reponse.status === 304) {
    if (!cache) throw new ErreurDefinitive(`${url} : réponse 304 sans cache local`);
    const octets = new Uint8Array(readFileSync(cache.zip));
    verifierTaille(url, octets.length);
    journal(`${url} : inchangée (ETag ${cache.meta.etag}), cache utilisé`);
    const { url: u, lastModified, etag } = cache.meta;
    return { octets, source: { url: u, lastModified, etag }, depuisCache: true };
  }
  if (reponse.status !== 200) {
    const message = `${url} : statut ${reponse.status} au lieu de 200`;
    // 5xx, 408 et 429 passent peut-être au prochain essai ; les autres statuts non.
    if (reponse.status >= 500 || reponse.status === 408 || reponse.status === 429)
      throw new Error(message);
    throw new ErreurDefinitive(message);
  }

  const octets = new Uint8Array(await reponse.arrayBuffer());
  const annonce = reponse.headers.get('content-length');
  if (annonce !== null && Number(annonce) !== octets.length) {
    throw new Error(`${url} : corps incomplet (${octets.length} octets reçus sur ${annonce})`);
  }
  verifierTaille(url, octets.length);

  const source = {
    url,
    lastModified: reponse.headers.get('last-modified'),
    etag: reponse.headers.get('etag'),
  };
  if (source.etag) ecrireCache(dossier, octets, source);
  journal(`${url} : ${(octets.length / 1e6).toFixed(1)} Mo téléchargés`);
  return { octets, source, depuisCache: false };
}

function verifierTaille(url, taille) {
  if (taille < TAILLE_MINIMALE) {
    throw new ErreurDefinitive(
      `${url} : archive de ${taille} octets, inférieure au minimum de ${TAILLE_MINIMALE} octets`,
    );
  }
}

/**
 * Entrées d'un zip dont le nom est accepté, décompressées par lots : on ne garde jamais plus d'un lot en mémoire
 * (l'archive des scrutins pèse 190 Mo décompressée).
 *
 * @param {Uint8Array} zip
 * @param {(nom: string) => boolean} accepte
 * @param {number} [tailleLot]
 * @returns {Generator<[string, Uint8Array]>}
 */
export function* entreesZip(zip, accepte, tailleLot = 400) {
  const noms = [];
  // Premier passage : le filtre voit chaque entrée du répertoire central, sans rien décompresser.
  unzipSync(zip, {
    filter: ({ name }) => {
      if (accepte(name)) noms.push(name);
      return false;
    },
  });
  for (let debut = 0; debut < noms.length; debut += tailleLot) {
    const lot = new Set(noms.slice(debut, debut + tailleLot));
    const fichiers = unzipSync(zip, { filter: ({ name }) => lot.has(name) });
    for (const nom of lot) yield [nom, fichiers[nom]];
  }
}

/**
 * Fichiers d'un dossier de fixtures (récursif), avec des noms relatifs en `/` comme dans un zip.
 *
 * @param {string} racine
 * @param {(nom: string) => boolean} accepte
 * @returns {Generator<[string, Uint8Array]>}
 */
export function* entreesDossier(racine, accepte) {
  const parcourir = function* (dossier) {
    for (const element of readdirSync(dossier, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const chemin = join(dossier, element.name);
      if (element.isDirectory()) yield* parcourir(chemin);
      else yield chemin;
    }
  };
  for (const chemin of parcourir(racine)) {
    const nom = relative(racine, chemin).split(sep).join('/');
    if (accepte(nom)) yield [nom, new Uint8Array(readFileSync(chemin))];
  }
}

export const estScrutin = (nom) => /(^|\/)VTANR5L17V\d+\.json$/.test(nom);
export const estActeur = (nom) => /(^|\/)acteur\/PA\d+\.json$/.test(nom);
export const estOrgane = (nom) => /(^|\/)organe\/PO\d+\.json$/.test(nom);

/**
 * Ouvre les archives de la source choisie. Le résultat est le même pour les deux sources : les `sources`
 * (pour `meta.json`) et deux itérateurs de fichiers JSON bruts.
 *
 * @param {object} options
 * @param {'officiel' | 'fixtures'} [options.depuis]
 * @param {string} [options.cache] Dossier de cache (`.cache/officiel`).
 * @param {string} [options.fixtures] Dossier des fixtures.
 * @param {typeof fetch} [options.fetch]
 * @param {(message: string) => void} [options.journal]
 * @param {number[]} [options.pauses]
 * @returns {Promise<{ sources: { scrutins: SourceArchive, acteurs: SourceArchive }, scrutins: () => Iterable<[string, Uint8Array]>, acteurs: () => Iterable<[string, Uint8Array]> }>}
 */
export async function ouvrirArchives({
  depuis = 'officiel',
  cache = join('.cache', 'officiel'),
  fixtures = join('src', 'server', 'fixtures', 'officiel'),
  fetch: requete,
  journal = () => {},
  pauses,
}) {
  if (depuis === 'fixtures') {
    if (!existsSync(fixtures)) throw new Error(`fixtures introuvables : ${fixtures}`);
    const source = { url: fixtures.split(sep).join('/'), lastModified: null, etag: null };
    return {
      sources: { scrutins: source, acteurs: source },
      scrutins: () => entreesDossier(fixtures, estScrutin),
      acteurs: () => entreesDossier(fixtures, (nom) => estActeur(nom) || estOrgane(nom)),
    };
  }
  if (depuis !== 'officiel')
    throw new Error(`source inconnue : « ${depuis} » (officiel ou fixtures)`);

  // Chaque archive a son propre dossier de cache, et personne ne lance rien depuis ces dossiers.
  const options = { fetch: requete, journal, pauses };
  const [scrutins, acteurs] = await Promise.all([
    telecharger({ url: URL_SCRUTINS, dossier: join(cache, 'scrutins'), ...options }),
    telecharger({ url: URL_ACTEURS, dossier: join(cache, 'acteurs'), ...options }),
  ]);
  return {
    sources: { scrutins: scrutins.source, acteurs: acteurs.source },
    scrutins: () => entreesZip(scrutins.octets, estScrutin),
    acteurs: () => entreesZip(acteurs.octets, (nom) => estActeur(nom) || estOrgane(nom)),
  };
}
