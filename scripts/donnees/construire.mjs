// Réduction des archives lues (lire.mjs) en fichiers compacts, selon docs/DONNEES.md. Fonction pure : aucune
// lecture ni écriture de fichier. Les garde-fous font échouer le build plutôt que de publier des données fausses.

import { CARACTERES_GROUPE } from '../../src/server/donnees.types.ts';
import { classerTous } from '../../src/shared/classer.ts';

/** Seuils du plan : en dessous, l'archive est incomplète ou ce n'est pas la bonne. */
export const SEUILS_OFFICIELS = { scrutins: 8000, deputes: 570 };

/** Au plus ce nombre de scrutins dont le nombre de non-votants officiel diffère de la somme des groupes (corrigé). */
export const MAX_NONVOTANTS_CORRIGES = 5;

const POSITIONS = /** @type {const} */ (['pour', 'contre', 'abstention', 'nonvotant']);
const FIN_DES_TEMPS = '9999-12-31';

export class ErreurDonnees extends Error {
  /** @param {string} message */
  constructor(message) {
    super(`garde-fou : ${message}`);
    this.name = 'ErreurDonnees';
  }
}

/** « Prénom Nom » en identifiant d'URL : minuscules, sans accents, tirets pour tout séparateur. */
export function slugifier(texte) {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Position majoritaire d'un groupe, calculée sur ses suffrages exprimés (pour, contre, abstention) :
 * la position en tête, « partage » quand deux positions sont à égalité en tête, « nonvotant » quand personne
 * n'a exprimé de suffrage. On n'utilise pas le champ `positionMajoritaire` de l'archive : il ne suit pas
 * les votes (voir « Écarts constatés » dans DONNEES.md).
 *
 * @param {{ pour: number, contre: number, abstention: number }} compte
 * @returns {'pour' | 'contre' | 'abstention' | 'partage' | 'nonvotant'}
 */
export function positionMajoritaire(compte) {
  const max = Math.max(compte.pour, compte.contre, compte.abstention);
  if (max === 0) return 'nonvotant';
  const tete = /** @type {const} */ (['pour', 'contre', 'abstention']).filter(
    (p) => compte[p] === max,
  );
  return tete.length > 1 ? 'partage' : tete[0];
}

/** @param {import('./lire.mjs').MandatLu[]} mandats */
function actifAu(mandats, date) {
  return mandats.filter((m) => m.debut <= date && (m.fin ?? FIN_DES_TEMPS) >= date);
}

/** Le mandat « en cours » en priorité (le plus récent), sinon le dernier terminé. */
function plusRecent(mandats) {
  const ouverts = mandats.filter((m) => m.fin === null);
  const parDebut = (a, b) => (a.debut < b.debut ? 1 : a.debut > b.debut ? -1 : 0);
  if (ouverts.length) return [...ouverts].sort(parDebut)[0];
  return [...mandats].sort((a, b) =>
    (a.fin ?? '') < (b.fin ?? '') ? 1 : (a.fin ?? '') > (b.fin ?? '') ? -1 : parDebut(a, b),
  )[0];
}

/**
 * @param {object} entree
 * @param {import('./lire.mjs').ScrutinLu[]} entree.scrutins
 * @param {import('./lire.mjs').ActeurLu[]} entree.acteurs
 * @param {import('./lire.mjs').OrganeLu[]} entree.organes
 * @param {{ scrutins: object, acteurs: object }} entree.sources
 * @param {Date} [entree.maintenant]
 * @param {{ scrutins: number, deputes: number }} [entree.seuils]
 */
export function construire({
  scrutins,
  acteurs,
  organes,
  sources,
  maintenant = new Date(),
  seuils = SEUILS_OFFICIELS,
}) {
  if (scrutins.length < seuils.scrutins) {
    throw new ErreurDonnees(
      `${scrutins.length} scrutins lus, au moins ${seuils.scrutins} attendus`,
    );
  }

  // --- Référentiels --------------------------------------------------------------------------------------------
  const organesGp = new Map(
    organes.filter((o) => o.codeType === 'GP' && o.legislature === '17').map((o) => [o.id, o]),
  );
  const fiches = new Map();
  for (const acteur of acteurs) {
    if (fiches.has(acteur.pa))
      throw new ErreurDonnees(`acteur ${acteur.pa} présent deux fois dans l'archive des acteurs`);
    fiches.set(acteur.pa, acteur);
  }
  const numeros = new Set();
  for (const s of scrutins) {
    if (numeros.has(s.numero)) throw new ErreurDonnees(`scrutin ${s.numero} présent deux fois`);
    numeros.add(s.numero);
  }

  const mandatsGp = (pa) =>
    fiches.get(pa).mandats.filter((m) => m.type === 'GP' && m.legislature === '17' && m.organe);
  const mandatsAssemblee = (pa) =>
    fiches.get(pa).mandats.filter((m) => m.type === 'ASSEMBLEE' && m.legislature === '17');
  /** Groupe d'un acteur un jour donné d'après ses mandats, ou `null`. */
  const groupeAu = (pa, date) => {
    const actifs = actifAu(mandatsGp(pa), date);
    return actifs.length ? plusRecent(actifs).organe : null;
  };

  // --- Scrutins : vérifications et groupes ---------------------------------------------------------------------
  let groupesRattaches = 0;
  const nonVotantsCorriges = [];
  const normalises = scrutins.map((s) => {
    if (s.sortCode !== 'adopté' && s.sortCode !== 'rejeté') {
      throw new ErreurDonnees(
        `scrutin ${s.numero} : sort.code « ${s.sortCode} » (adopté ou rejeté attendu)`,
      );
    }
    const entrees = [];
    for (const g of s.groupes) {
      for (const p of POSITIONS) {
        if (g.votants[p].length !== g.compte[p]) {
          throw new ErreurDonnees(
            `scrutin ${s.numero}, groupe ${g.organeRef} : ${g.votants[p].length} « ${p} » nommés pour un décompte de ${g.compte[p]}`,
          );
        }
      }
      for (const pa of POSITIONS.flatMap((p) => g.votants[p])) {
        if (!fiches.has(pa))
          throw new ErreurDonnees(
            `scrutin ${s.numero} : le votant ${pa} n'a pas de fiche dans l'archive des acteurs`,
          );
      }
      let id = g.organeRef;
      if (!organesGp.has(id)) {
        // « PO0 » (146 entrées dans 14 scrutins) ou organe inconnu : le groupe est celui de ses membres ce jour-là.
        const total = POSITIONS.reduce((n, p) => n + g.votants[p].length, 0);
        if (total === 0) continue; // entrée vide : rien à compter, rien à perdre
        const parGroupe = new Map();
        for (const pa of POSITIONS.flatMap((p) => g.votants[p])) {
          const membre = groupeAu(pa, s.date);
          if (membre) parGroupe.set(membre, (parGroupe.get(membre) ?? 0) + 1);
        }
        const [meilleur, nombre] = [...parGroupe].sort(
          (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
        )[0] ?? [null, 0];
        if (!meilleur || nombre * 2 <= total || !organesGp.has(meilleur)) {
          throw new ErreurDonnees(
            `scrutin ${s.numero} : impossible de rattacher l'entrée « ${g.organeRef} » (${total} votants) à un groupe`,
          );
        }
        id = meilleur;
        groupesRattaches++;
      }
      if (entrees.some((e) => e.id === id))
        throw new ErreurDonnees(`scrutin ${s.numero} : deux entrées pour le groupe ${id}`);
      entrees.push({ id, compte: g.compte, votants: g.votants });
    }

    const somme = { pour: 0, contre: 0, abstention: 0, nonvotant: 0 };
    for (const e of entrees) for (const p of POSITIONS) somme[p] += e.compte[p];
    for (const p of /** @type {const} */ (['pour', 'contre', 'abstention'])) {
      if (somme[p] !== s.compte[p]) {
        throw new ErreurDonnees(
          `scrutin ${s.numero} : la somme des groupes donne ${somme[p]} « ${p} », le scrutin en annonce ${s.compte[p]}`,
        );
      }
    }
    let compte = s.compte;
    if (somme.nonvotant !== s.compte.nonvotant) {
      nonVotantsCorriges.push(s.numero);
      if (nonVotantsCorriges.length > MAX_NONVOTANTS_CORRIGES) {
        throw new ErreurDonnees(
          `plus de ${MAX_NONVOTANTS_CORRIGES} scrutins dont les non-votants ne correspondent pas à la somme des groupes (dernier : ${s.numero})`,
        );
      }
      compte = { ...s.compte, nonvotant: somme.nonvotant };
    }
    return { lu: s, entrees, compte };
  });

  // --- Groupes ---------------------------------------------------------------------------------------------------
  const utilises = new Set(normalises.flatMap((s) => s.entrees.map((e) => e.id)));
  const groupes = [...utilises]
    .map((id) => organesGp.get(id))
    .sort(
      (a, b) =>
        a.preseance - b.preseance ||
        (a.debut ?? '').localeCompare(b.debut ?? '') ||
        a.id.localeCompare(b.id),
    )
    .map((o) => ({
      id: o.id,
      abrege: o.abrege,
      libelle: o.libelle,
      couleur: o.couleur,
      debut: o.debut,
      fin: o.fin,
    }));
  if (groupes.length > CARACTERES_GROUPE.length) {
    throw new ErreurDonnees(
      `${groupes.length} groupes, ${CARACTERES_GROUPE.length} au plus (un caractère par groupe)`,
    );
  }
  const indexGroupe = new Map(groupes.map((g, i) => [g.id, i]));

  // --- Députés ---------------------------------------------------------------------------------------------------
  const votants = new Set(
    normalises.flatMap((s) => s.entrees.flatMap((e) => POSITIONS.flatMap((p) => e.votants[p]))),
  );
  const pas = [...votants].sort();
  if (pas.length < seuils.deputes) {
    throw new ErreurDonnees(`${pas.length} députés, au moins ${seuils.deputes} attendus`);
  }

  const vus = new Map();
  const deputes = pas.map((pa) => {
    const fiche = fiches.get(pa);
    const nom = `${fiche.prenom} ${fiche.nom}`.trim();
    const base = slugifier(nom) || pa.toLowerCase();
    const n = (vus.get(base) ?? 0) + 1;
    vus.set(base, n);
    const slug = n === 1 ? base : `${base}-${n}`;

    const assemblee = mandatsAssemblee(pa);
    const mandat = assemblee.length ? plusRecent(assemblee) : null;
    const lieu = mandat?.lieu ?? null;
    const groupe = (() => {
      const connus = mandatsGp(pa).filter((m) => indexGroupe.has(m.organe));
      return connus.length ? plusRecent(connus).organe : null;
    })();
    return {
      pa,
      slug,
      nom,
      nomTri: fiche.nom.replace(/\s*\([^)]*\)\s*$/, '').trim(),
      groupe,
      departement: lieu?.numDepartement ?? null,
      circonscription:
        lieu?.departement && lieu.numCirco ? `${lieu.departement} (${lieu.numCirco})` : null,
      actif: assemblee.some((m) => m.fin === null),
    };
  });
  const slugs = new Set(deputes.map((d) => d.slug));
  if (slugs.size !== deputes.length) throw new ErreurDonnees('deux députés avec le même slug');
  const colonne = new Map(pas.map((pa, i) => [pa, i]));

  // Mandats de député, pour distinguer « absent » (en mandat, dans aucune liste) de « pas en mandat ».
  const intervalles = pas.map((pa) =>
    mandatsAssemblee(pa).map((m) => [m.debut, m.fin ?? FIN_DES_TEMPS]),
  );
  const groupesDesMandats = pas.map((pa) => mandatsGp(pa));

  // --- Scrutins et matrices -------------------------------------------------------------------------------------
  const ordonnes = [...normalises].sort((a, b) => b.lu.numero - a.lu.numero);
  const types = classerTous(
    ordonnes.map((s) => ({ titre: s.lu.titre, typeVote: s.lu.codeTypeVote })),
  );

  const CODE = { pour: 'P', contre: 'C', abstention: 'A', nonvotant: 'N' };
  const lignesVotes = [];
  const lignesGroupes = [];
  const scrutinsFichier = ordonnes.map((s, i) => {
    const votes = new Array(deputes.length).fill('-');
    const parGroupe = new Array(deputes.length).fill('-');
    for (const e of s.entrees) {
      const caractereGroupe = CARACTERES_GROUPE[indexGroupe.get(e.id)];
      for (const p of POSITIONS) {
        for (const pa of e.votants[p]) {
          const c = colonne.get(pa);
          votes[c] = CODE[p];
          parGroupe[c] = caractereGroupe;
        }
      }
    }
    const date = s.lu.date;
    const presents = new Set(s.entrees.map((e) => e.id));
    for (let c = 0; c < deputes.length; c++) {
      if (votes[c] !== '-') continue;
      if (!intervalles[c].some(([debut, fin]) => debut <= date && date <= fin)) continue;
      votes[c] = 'X';
      const actifs = actifAu(groupesDesMandats[c], date);
      const id = actifs.length ? plusRecent(actifs).organe : null;
      if (id && presents.has(id)) parGroupe[c] = CARACTERES_GROUPE[indexGroupe.get(id)];
    }
    lignesVotes.push(votes.join(''));
    lignesGroupes.push(parGroupe.join(''));

    return {
      n: s.lu.numero,
      date,
      titre: s.lu.titre,
      type: types[i],
      adopte: s.lu.sortCode === 'adopté',
      dossier: s.lu.dossier,
      compte: s.compte,
      groupes: s.entrees
        .map((e) => ({
          g: indexGroupe.get(e.id),
          position: positionMajoritaire(e.compte),
          compte: e.compte,
        }))
        .sort((a, b) => a.g - b.g),
    };
  });

  // --- Garde-fous sur les matrices --------------------------------------------------------------------------------
  for (const [nom, lignes] of [
    ['votes.txt', lignesVotes],
    ['groupes-votes.txt', lignesGroupes],
  ]) {
    const faux = lignes.findIndex((ligne) => ligne.length !== deputes.length);
    if (lignes.length !== scrutinsFichier.length || faux !== -1) {
      throw new ErreurDonnees(
        `${nom} : ligne ${faux} de ${lignes[faux]?.length} caractères pour ${deputes.length} députés`,
      );
    }
  }

  const meta = {
    genereLe: maintenant.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    scrutins: scrutinsFichier.length,
    deputes: deputes.length,
    groupes: groupes.length,
    sources,
    statistiques: {
      adoptes: scrutinsFichier.filter((s) => s.adopte).length,
      rejetes: scrutinsFichier.filter((s) => !s.adopte).length,
      sansDossier: scrutinsFichier.filter((s) => s.dossier === null).length,
      misesAuPoint: ordonnes.filter((s) => s.lu.miseAuPoint).length,
      groupesRattaches,
      nonVotantsCorriges,
    },
  };

  const donnees = {
    meta,
    groupes,
    deputes,
    scrutins: scrutinsFichier,
    votes: lignesVotes,
    groupesVotes: lignesGroupes,
  };
  const fichiers = {
    'meta.json': JSON.stringify(meta),
    'groupes.json': JSON.stringify(groupes),
    'deputes.json': JSON.stringify(deputes),
    'scrutins.json': JSON.stringify(scrutinsFichier),
    'votes.txt': lignesVotes.join('\n'),
    'groupes-votes.txt': lignesGroupes.join('\n'),
  };
  return { donnees, fichiers };
}
