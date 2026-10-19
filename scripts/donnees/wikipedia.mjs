// Liens vers les articles Wikipédia des députés. Ils ne sont pas dans les archives officielles : on les lit dans
// Wikidata (base communautaire, CC0), où la propriété P4123 est l'identifiant « Assemblée nationale » d'une personne
// (le numéro du PA sans préfixe : `PA720468` donne `720468`). Une seule requête SPARQL les donne tous.
//
// Source non officielle et non indispensable : si Wikidata ne répond pas, le build continue sans ces liens
// (avertissement dans le journal et dans `meta.json`). Rien n'est jamais deviné : un député absent de la réponse n'a
// pas de lien Wikipédia.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const URL_WIKIDATA = 'https://query.wikidata.org/sparql';

export const REQUETE_WIKIDATA = `SELECT ?an ?article WHERE {
  ?item wdt:P4123 ?an .
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> }
}`;

/** Wikidata exige un `User-Agent` qui identifie le site et qui le contacter (ASCII seulement : c'est un en-tête HTTP). */
export const USER_AGENT =
  'quiavotequoi.phamelin.fr (open data Assemblee nationale; https://github.com/phamelin42/lois-votes)';

/** Pauses entre deux tentatives (ms) : une première tentative, puis jusqu'à trois nouveaux essais. */
export const PAUSES_WIKIDATA = [2000, 4000, 8000];
/** Délai maximal d'une requête (ms). */
export const DELAI_MAX_WIKIDATA = 60_000;
/** Une réponse plus courte n'est pas la liste complète (observé : 2 460 lignes) : on l'écarte. */
export const LIGNES_MINIMALES = 1000;
/** Seules les adresses de Wikipédia en français sont retenues. */
export const PREFIXE_WIKIPEDIA = 'https://fr.wikipedia.org/wiki/';

const attendreMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Liens Wikipédia d'une réponse SPARQL (`application/sparql-results+json`).
 *
 * @param {any} reponse
 * @param {{ lignesMinimales?: number }} [options]
 * @returns {Map<string, string>} Numéro de l'acteur (sans préfixe « PA ») vers l'adresse de l'article.
 */
export function lireWikidata(reponse, { lignesMinimales = LIGNES_MINIMALES } = {}) {
  const lignes = reponse?.results?.bindings;
  if (!Array.isArray(lignes))
    throw new Error('réponse Wikidata illisible : results.bindings absent');
  if (lignes.length < lignesMinimales) {
    throw new Error(
      `réponse Wikidata incomplète : ${lignes.length} lignes, au moins ${lignesMinimales} attendues`,
    );
  }
  /** @type {Map<string, string>} */
  const liens = new Map();
  const ambigus = new Set();
  for (const ligne of lignes) {
    const numero = ligne?.an?.value;
    const article = ligne?.article?.value;
    if (typeof numero !== 'string' || !/^\d{1,7}$/.test(numero)) continue;
    if (typeof article !== 'string' || !article.startsWith(PREFIXE_WIKIPEDIA)) continue;
    if (/\s/.test(article)) continue;
    // Deux articles différents pour un même numéro : on ne sait pas lequel est le bon, donc aucun.
    if (liens.has(numero) && liens.get(numero) !== article) ambigus.add(numero);
    liens.set(numero, article);
  }
  for (const numero of ambigus) liens.delete(numero);
  return liens;
}

/**
 * Interroge Wikidata : une tentative, puis jusqu'à trois nouveaux essais (pauses de 2, 4 et 8 s) quand le réseau coupe,
 * que la requête dépasse 60 s ou que le serveur répond 5xx, 408 ou 429. Les autres statuts échouent tout de suite.
 *
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number[]} [options.pauses]
 * @param {number} [options.delaiMax]
 * @param {number} [options.lignesMinimales]
 * @param {(ms: number) => Promise<void>} [options.attendre]
 * @param {(message: string) => void} [options.journal]
 * @returns {Promise<Map<string, string>>}
 */
export async function telechargerWikidata({
  fetch: requete = globalThis.fetch,
  pauses = PAUSES_WIKIDATA,
  delaiMax = DELAI_MAX_WIKIDATA,
  lignesMinimales = LIGNES_MINIMALES,
  attendre = attendreMs,
  journal = () => {},
} = {}) {
  const url = `${URL_WIKIDATA}?${new URLSearchParams({ query: REQUETE_WIKIDATA })}`;
  let derniereErreur;
  for (let essai = 0; essai <= pauses.length; essai++) {
    if (essai > 0) {
      journal(
        `Wikidata : nouvel essai dans ${pauses[essai - 1] / 1000} s (${derniereErreur.message})`,
      );
      await attendre(pauses[essai - 1]);
    }
    try {
      const reponse = await requete(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(delaiMax),
      });
      if (reponse.status !== 200) {
        const erreur = new Error(`statut ${reponse.status} au lieu de 200`);
        if (reponse.status >= 500 || reponse.status === 408 || reponse.status === 429) throw erreur;
        erreur.definitive = true;
        throw erreur;
      }
      return lireWikidata(await reponse.json(), { lignesMinimales });
    } catch (erreur) {
      derniereErreur = erreur;
      if (erreur.definitive) break;
    }
  }
  throw new Error(`Wikidata : ${derniereErreur.message}`, { cause: derniereErreur });
}

/**
 * Les liens Wikipédia selon la source choisie. Ne lève jamais d'erreur : si Wikidata est injoignable ou répond de
 * travers, le résultat est `{ liens: null, avertissements: ['wikipedia'] }` et le journal dit pourquoi.
 *
 * - `officiel` : une requête à Wikidata ;
 * - `fixtures` : le fichier `wikidata.json` du dossier des fixtures (extrait réel de la même réponse), sans réseau.
 *
 * @param {object} options
 * @param {'officiel' | 'fixtures'} options.depuis
 * @param {string} options.fixtures Dossier des fixtures.
 * @param {typeof fetch} [options.fetch]
 * @param {number[]} [options.pauses]
 * @param {number} [options.delaiMax]
 * @param {(ms: number) => Promise<void>} [options.attendre]
 * @param {(message: string) => void} [options.journal]
 * @returns {Promise<{ liens: Map<string, string> | null, avertissements: string[] }>}
 */
export async function chargerWikipedia({
  depuis,
  fixtures,
  fetch: requete,
  pauses,
  delaiMax,
  attendre,
  journal = () => {},
}) {
  try {
    if (depuis === 'fixtures') {
      const chemin = join(fixtures, 'wikidata.json');
      if (!existsSync(chemin)) throw new Error(`fixtures introuvables : ${chemin}`);
      return {
        liens: lireWikidata(JSON.parse(readFileSync(chemin, 'utf8')), { lignesMinimales: 1 }),
        avertissements: [],
      };
    }
    const liens = await telechargerWikidata({
      fetch: requete,
      pauses,
      delaiMax,
      attendre,
      journal,
    });
    journal(`Wikidata : ${liens.size} articles Wikipédia en français`);
    return { liens, avertissements: [] };
  } catch (erreur) {
    journal(
      `AVERTISSEMENT : liens Wikipédia indisponibles, le site sera construit sans eux (${erreur.message})`,
    );
    return { liens: null, avertissements: ['wikipedia'] };
  }
}
