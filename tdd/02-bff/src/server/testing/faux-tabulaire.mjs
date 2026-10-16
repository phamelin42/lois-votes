// Faux serveur de l'API tabulaire de data.gouv.fr, en mémoire. Utilisé par les specs Vitest (via `fetch`)
// et, enveloppé dans un serveur HTTP, par les tests e2e. JavaScript pur (ESM) pour tourner aussi sous Node seul.
//
// Opérateurs gérés : __exact, __differs, __in, __notin, __contains, __notcontains, __less, __greater,
// __isnull, __isnotnull, __sort=asc|desc. Pagination : page, page_size (20 par défaut, 200 au maximum).
// Réponse : { data, links: { next, prev }, meta: { page, page_size, total } }.

const PAGE_SIZE_DEFAUT = 20;
const PAGE_SIZE_MAX = 200;

/**
 * @typedef {Record<string, string | number | boolean | null>} Ligne
 * @typedef {{ rid: string, lignes: Ligne[] }} Table
 * @typedef {{ url: string, rid: string, params: URLSearchParams }} Requete
 * @typedef {{
 *   base?: string,
 *   maxValeursIn?: number,
 *   avant?: (requete: Requete) => Response | Promise<Response> | undefined,
 * }} OptionsFaux
 */

function reponseJson(corps, status = 200, headers = {}) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function texte(valeur) {
  return valeur === null || valeur === undefined ? '' : String(valeur);
}

function comparer(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== null && b !== null && a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb;
  }
  return texte(a).localeCompare(texte(b), 'fr');
}

/** Applique filtres, tri et pagination à `lignes`. Renvoie `{ erreur }` si un paramètre est invalide. */
export function appliquerRequete(lignes, params, { maxValeursIn = Infinity } = {}) {
  let resultat = lignes;
  let tri = null;
  let page = 1;
  let pageSize = PAGE_SIZE_DEFAUT;
  const colonnes = new Set(lignes.flatMap((ligne) => Object.keys(ligne)));

  for (const [cle, valeur] of params) {
    if (cle === 'page') {
      page = Number(valeur);
      continue;
    }
    if (cle === 'page_size') {
      pageSize = Number(valeur);
      if (!(pageSize >= 1 && pageSize <= PAGE_SIZE_MAX)) {
        return { erreur: `page_size doit être compris entre 1 et ${PAGE_SIZE_MAX}`, status: 400 };
      }
      continue;
    }
    const sep = cle.lastIndexOf('__');
    if (sep < 0) return { erreur: `paramètre inconnu : ${cle}`, status: 400 };
    const colonne = cle.slice(0, sep);
    const op = cle.slice(sep + 2);
    if (!colonnes.has(colonne)) return { erreur: `colonne inconnue : ${colonne}`, status: 400 };

    switch (op) {
      case 'exact':
        resultat = resultat.filter((l) => texte(l[colonne]) === valeur);
        break;
      case 'differs':
        resultat = resultat.filter((l) => texte(l[colonne]) !== valeur);
        break;
      case 'in':
      case 'notin': {
        const valeurs = valeur === '' ? [] : valeur.split(',');
        if (valeurs.length > maxValeursIn) {
          return { erreur: 'liste __in trop longue', status: 414 };
        }
        const dedans = op === 'in';
        resultat = resultat.filter((l) => valeurs.includes(texte(l[colonne])) === dedans);
        break;
      }
      case 'contains':
        resultat = resultat.filter((l) => texte(l[colonne]).toLowerCase().includes(valeur.toLowerCase()));
        break;
      case 'notcontains':
        resultat = resultat.filter((l) => !texte(l[colonne]).toLowerCase().includes(valeur.toLowerCase()));
        break;
      case 'less':
        resultat = resultat.filter((l) => l[colonne] !== null && comparer(l[colonne], valeur) <= 0);
        break;
      case 'greater':
        resultat = resultat.filter((l) => l[colonne] !== null && comparer(l[colonne], valeur) >= 0);
        break;
      case 'isnull':
        resultat = resultat.filter((l) => l[colonne] === null);
        break;
      case 'isnotnull':
        resultat = resultat.filter((l) => l[colonne] !== null);
        break;
      case 'sort':
        if (valeur !== 'asc' && valeur !== 'desc') return { erreur: 'tri invalide', status: 400 };
        tri = { colonne, sens: valeur === 'desc' ? -1 : 1 };
        break;
      default:
        return { erreur: `opérateur inconnu : ${op}`, status: 400 };
    }
  }

  if (tri) {
    resultat = [...resultat].sort((a, b) => tri.sens * comparer(a[tri.colonne], b[tri.colonne]));
  }
  const total = resultat.length;
  const debut = (page - 1) * pageSize;
  return { data: resultat.slice(debut, debut + pageSize), total, page, pageSize };
}

/**
 * Crée le faux serveur. `fetch` imite `globalThis.fetch` ; `requetes` garde l'historique.
 * @param {Table[]} tables
 * @param {OptionsFaux} [options]
 */
export function creerFauxTabulaire(tables, options = {}) {
  const base = options.base ?? 'http://tabulaire.test/api';
  /** @type {Requete[]} */
  const requetes = [];
  let enVol = 0;
  let maxEnVol = 0;

  async function repondre(entree, init) {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const requete = { url: url.href, rid: '', params: url.searchParams };
    requetes.push(requete);
    enVol++;
    maxEnVol = Math.max(maxEnVol, enVol);
    try {
      await Promise.resolve();
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!url.href.startsWith(base + '/')) {
        return reponseJson({ erreur: 'hôte non prévu' }, 404);
      }
      const chemin = url.pathname.slice(new URL(base).pathname.length);
      const m = /^\/resources\/([^/]+)\/data\/?$/.exec(chemin);
      if (!m) return reponseJson({ erreur: 'route inconnue' }, 404);
      requete.rid = m[1];
      const surcharge = await options.avant?.(requete);
      if (surcharge) return surcharge;
      const table = tables.find((t) => t.rid === m[1]);
      if (!table) return reponseJson({ erreur: 'ressource inconnue' }, 404);

      const r = appliquerRequete(table.lignes, url.searchParams, { maxValeursIn: options.maxValeursIn });
      if ('erreur' in r) return reponseJson({ erreur: r.erreur }, r.status);

      const lien = (page) => {
        const copie = new URL(url.href);
        copie.searchParams.set('page', String(page));
        copie.searchParams.set('page_size', String(r.pageSize));
        return copie.href;
      };
      const derniere = Math.max(1, Math.ceil(r.total / r.pageSize));
      return reponseJson({
        data: r.data,
        links: {
          next: r.page < derniere ? lien(r.page + 1) : null,
          prev: r.page > 1 ? lien(r.page - 1) : null,
        },
        meta: { page: r.page, page_size: r.pageSize, total: r.total },
      });
    } finally {
      enVol--;
    }
  }

  return {
    base,
    fetch: repondre,
    requetes,
    get maxSimultanees() {
      return maxEnVol;
    },
    /** Requêtes ayant touché la ressource `rid`. */
    requetesVers: (rid) => requetes.filter((r) => r.rid === rid),
    reinitialiser: () => {
      requetes.length = 0;
      maxEnVol = 0;
    },
  };
}
