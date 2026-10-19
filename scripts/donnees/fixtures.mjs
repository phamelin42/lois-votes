#!/usr/bin/env node
// `node scripts/donnees/fixtures.mjs` : regénère `src/server/fixtures/officiel/` à partir des vraies archives.
//
// Le jeu est un extrait RÉEL et RÉDUIT, au même format que les archives (fichiers JSON non zippés) :
//   json/scrutins/VTANR5L17V<n>.json   scrutins retenus (titres, dates, dossiers, résultats officiels, groupes réels),
//   json/acteur/PA<n>.json             députés retenus (identité et mandats GP et ASSEMBLEE de la 17ᵉ législature),
//   json/organe/PO<n>.json             groupes politiques de la 17ᵉ législature.
// Les listes nominatives et les décomptes des scrutins sont réduits aux députés retenus : les effectifs du jeu sont
// donc ceux de l'échantillon, pas les totaux officiels (le résultat « adopté » ou « rejeté » reste l'officiel).

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classerTous } from '../../src/shared/classer.ts';
import { liste, lireActeur, lireOrgane, lireScrutin } from './lire.mjs';
import { estOrgane, ouvrirArchives } from './telecharger.mjs';

const DESTINATION = join('src', 'server', 'fixtures', 'officiel');
const POSITIONS = /** @type {const} */ ([
  ['pours', 'pour'],
  ['contres', 'contre'],
  ['abstentions', 'abstention'],
  ['nonVotants', 'nonvotant'],
]);

const json = (octets) => JSON.parse(new TextDecoder().decode(octets));
const parNumeroDecroissant = (a, b) => b.numero - a.numero;

// --- Réduction d'un scrutin brut ---------------------------------------------------------------------------------

/** Garde, dans une liste nominative brute, les seuls votants retenus ; `null` quand il n'en reste aucun. */
function filtrerListe(valeur, retenus) {
  const gardes = liste(valeur?.votant).filter((v) => retenus.has(v.acteurRef));
  if (!gardes.length) return null;
  // Comme l'archive : un seul votant est un objet, plusieurs forment un tableau.
  return { votant: gardes.length === 1 ? gardes[0] : gardes };
}

/**
 * Réduit un scrutin brut aux députés retenus : listes nominatives filtrées, décomptes recalculés.
 * @param {any} brut `{ scrutin: … }` tel que dans l'archive.
 * @param {Set<string>} retenus
 */
export function reduireScrutin(brut, retenus) {
  const s = structuredClone(brut.scrutin);
  const total = { pour: 0, contre: 0, abstentions: 0, nonVotants: 0 };
  const sommeNonVotants = liste(s.ventilationVotes?.organe?.groupes?.groupe).reduce(
    (somme, groupe) => somme + Number(groupe.vote?.decompteVoix?.nonVotants ?? 0),
    0,
  );
  for (const groupe of liste(s.ventilationVotes?.organe?.groupes?.groupe)) {
    const vote = groupe.vote;
    const nominatif = {};
    const n = {};
    for (const [cle] of POSITIONS) {
      nominatif[cle] = filtrerListe(vote.decompteNominatif?.[cle], retenus);
      n[cle] = liste(nominatif[cle]?.votant).length;
    }
    vote.decompteNominatif = {
      nonVotants: nominatif.nonVotants,
      pours: nominatif.pours,
      contres: nominatif.contres,
      abstentions: nominatif.abstentions,
    };
    // Dans l'archive, les « non-votants volontaires » d'un groupe sont ses abstentions.
    vote.decompteVoix = {
      nonVotants: String(n.nonVotants),
      pour: String(n.pours),
      contre: String(n.contres),
      abstentions: String(n.abstentions),
      nonVotantsVolontaires: String(n.abstentions),
    };
    total.pour += n.pours;
    total.contre += n.contres;
    total.abstentions += n.abstentions;
    total.nonVotants += n.nonVotants;
  }
  // Une incohérence de l'archive (non-votants du scrutin ≠ somme des groupes) est gardée telle quelle, pour la tester.
  const incoherent = String(sommeNonVotants) !== String(s.syntheseVote?.decompte?.nonVotants);
  s.syntheseVote = {
    ...s.syntheseVote,
    nombreVotants: String(total.pour + total.contre + total.abstentions),
    suffragesExprimes: String(total.pour + total.contre),
    nbrSuffragesRequis: String(Math.floor((total.pour + total.contre) / 2) + 1),
    decompte: {
      nonVotants: incoherent
        ? String(s.syntheseVote.decompte.nonVotants)
        : String(total.nonVotants),
      pour: String(total.pour),
      contre: String(total.contre),
      abstentions: String(total.abstentions),
      nonVotantsVolontaires: '0',
    },
  };
  // La mise au point garde sa forme (listes de `null` quand elle est vide), réduite aux mêmes députés.
  if (s.miseAuPoint) {
    const reduire = (section, vide) => {
      for (const cle of Object.keys(section)) {
        const restants = liste(section[cle])
          .flatMap((element) => liste(element?.votant))
          .filter((v) => retenus.has(v.acteurRef));
        section[cle] = restants.length
          ? { votant: restants.length === 1 ? restants[0] : restants }
          : vide;
      }
    };
    const { dysfonctionnement, ...listes } = s.miseAuPoint;
    reduire(listes, [null, null]);
    if (dysfonctionnement) reduire(dysfonctionnement, null);
    s.miseAuPoint = { ...listes, ...(dysfonctionnement ? { dysfonctionnement } : {}) };
  }
  for (const cle of Object.keys(s))
    if (
      cle.startsWith('@') ||
      ['demandeur', 'seanceRef', 'sessionRef', 'quantiemeJourSeance'].includes(cle)
    )
      delete s[cle];
  return { scrutin: s };
}

/** Un acteur brut réduit à l'identité et aux mandats GP et ASSEMBLEE de la 17ᵉ législature. */
export function reduireActeur(brut) {
  const a = brut.acteur;
  const mandats = liste(a.mandats?.mandat)
    .filter(
      (m) => m.legislature === '17' && (m.typeOrgane === 'GP' || m.typeOrgane === 'ASSEMBLEE'),
    )
    .map((m) => {
      const reduit = {
        uid: m.uid,
        acteurRef: m.acteurRef,
        legislature: m.legislature,
        typeOrgane: m.typeOrgane,
        dateDebut: m.dateDebut,
        dateFin: m.dateFin ?? null,
        organes: { organeRef: m.organes?.organeRef },
      };
      if (m.typeOrgane === 'ASSEMBLEE' && m.election?.lieu) {
        const { departement, numDepartement, numCirco } = m.election.lieu;
        reduit.election = { lieu: { departement, numDepartement, numCirco } };
      }
      return reduit;
    });
  const { civ, prenom, nom, alpha } = a.etatCivil.ident;
  return {
    acteur: {
      uid: a.uid,
      etatCivil: { ident: { civ, prenom, nom, alpha } },
      mandats: { mandat: mandats.length === 1 ? mandats[0] : mandats },
    },
  };
}

/** Un organe brut réduit aux champs lus par le script. */
export function reduireOrgane(brut) {
  const o = brut.organe;
  return {
    organe: {
      uid: o.uid,
      codeType: o.codeType,
      libelle: o.libelle,
      libelleAbrege: o.libelleAbrege,
      libelleAbrev: o.libelleAbrev,
      viMoDe: { dateDebut: o.viMoDe?.dateDebut ?? null, dateFin: o.viMoDe?.dateFin ?? null },
      legislature: o.legislature,
      preseance: o.preseance,
      couleurAssociee: o.couleurAssociee ?? null,
    },
  };
}

// --- Choix des scrutins et des députés ---------------------------------------------------------------------------

/**
 * Choisit les scrutins et les députés du jeu : 12 votes finaux récents (dont une motion de censure, un texte à
 * plusieurs lectures, un « article unique », un vote sans dossier), des amendements et des articles (dont un scrutin
 * dont les groupes sont tous « PO0 » et un autre avec un « PO0 »), les deux organes UDR, des changements de groupe,
 * d'anciens députés, des homonymes.
 *
 * @param {import('./lire.mjs').ScrutinLu[]} scrutins
 * @param {import('./lire.mjs').ActeurLu[]} acteurs
 */
export function choisir(scrutins, acteurs) {
  const ordonnes = [...scrutins].sort(parNumeroDecroissant);
  const types = classerTous(ordonnes.map((s) => ({ titre: s.titre, typeVote: s.codeTypeVote })));
  const type = new Map(ordonnes.map((s, i) => [s.numero, types[i]]));
  const parType = (t, filtre = () => true) =>
    ordonnes.filter((s) => type.get(s.numero) === t && filtre(s));
  const finals = parType('final');

  const choisis = new Map();
  const ajouter = (s) => s && choisis.set(s.numero, s);

  // Votes finaux
  ajouter(parType('motion')[0]); // la plus récente
  const dossiers = new Map();
  for (const s of finals.filter((f) => f.dossier))
    dossiers.set(s.dossier, [...(dossiers.get(s.dossier) ?? []), s]);
  const plusieursLectures = [...dossiers.values()].find((l) => l.length >= 2); // le plus récent d'abord
  for (const s of plusieursLectures ?? []) ajouter(s);
  ajouter(finals.find((s) => /^l'article unique\b/i.test(s.titre.replace(/’/g, "'"))));
  ajouter(
    finals.find(
      (s) => s.dossier === null && !/^l'article unique\b/i.test(s.titre.replace(/’/g, "'")),
    ),
  );
  ajouter(finals.find((s) => s.date >= '2025-06-01' && s.date < '2025-09-05')); // l'ancien groupe UDR
  ajouter(finals.find((s) => s.date >= '2024-11-01' && s.date < '2025-03-01')); // d'anciens députés
  for (const s of finals)
    if (
      [...choisis.values()].filter(
        (c) => type.get(c.numero) === 'final' || type.get(c.numero) === 'motion',
      ).length < 12
    )
      ajouter(s);

  // Amendements et articles
  const dossierLectures = plusieursLectures?.[0].dossier;
  ajouter(
    ordonnes.find((s) => s.groupes.some((g) => g.organeRef === 'PO0') && s.date >= '2026-01-01'),
  ); // un seul PO0
  ajouter(ordonnes.find((s) => s.groupes.filter((g) => g.organeRef === 'PO0').length >= 10)); // tous PO0
  ajouter(
    parType('article', (s) => s.dossier === dossierLectures)[0] ??
      parType('article', (s) => s.dossier)[0],
  );
  ajouter(
    parType(
      'amendement',
      (s) => s.dossier === dossierLectures && !/^le sous-amendement/i.test(s.titre),
    )[0],
  );
  ajouter(parType('amendement', (s) => /^le sous-amendement/i.test(s.titre) && s.dossier)[0]);
  ajouter(parType('amendement', (s) => s.date >= '2025-09-05').at(-1)); // le premier après la création du nouveau groupe UDR
  ajouter(ordonnes.find((s) => s.numero === 1)); // la première motion de censure : non-votants incohérents dans l'archive

  // Députés
  const fiches = new Map(acteurs.map((a) => [a.pa, a]));
  const listes = (s) =>
    s.groupes.flatMap((g) =>
      Object.values(g.votants)
        .flat()
        .map((pa) => [pa, g.organeRef]),
    );
  const retenus = new Set();
  const enplus = (pa) => retenus.add(pa);

  const groupesParDepute = new Map();
  const vusParDepute = new Map();
  for (const s of choisis.values()) {
    for (const [pa, organe] of listes(s)) {
      // « PO0 » est un identifiant manquant de l'archive, pas un groupe : il ne compte pas comme un changement.
      if (organe !== 'PO0')
        groupesParDepute.set(pa, new Set([...(groupesParDepute.get(pa) ?? []), organe]));
      vusParDepute.set(pa, (vusParDepute.get(pa) ?? 0) + 1);
    }
  }
  const candidats = [...vusParDepute.keys()].sort();
  const actif = (pa) =>
    fiches
      .get(pa)
      .mandats.some((m) => m.type === 'ASSEMBLEE' && m.legislature === '17' && m.fin === null);

  // homonymes et noms particuliers
  const parNom = new Map();
  for (const pa of candidats) {
    const f = fiches.get(pa);
    const cle = `${f.prenom} ${f.nom.replace(/\s*\([^)]*\)$/, '')}`;
    parNom.set(cle, [...(parNom.get(cle) ?? []), pa]);
  }
  for (const pas of parNom.values()) if (pas.length > 1) pas.forEach(enplus);
  candidats
    .filter((pa) => /[^\p{L}\s'’-]/u.test(fiches.get(pa).nom.replace(/\s*\([^)]*\)$/, '')))
    .slice(0, 2)
    .forEach(enplus);
  // changements de groupe entre les scrutins retenus
  candidats
    .filter((pa) => (groupesParDepute.get(pa)?.size ?? 0) > 1)
    .slice(0, 8)
    .forEach(enplus);
  // anciens députés, et députés qui ont eu plusieurs mandats dans la législature
  candidats
    .filter((pa) => !actif(pa))
    .slice(0, 5)
    .forEach(enplus);
  candidats
    .filter(
      (pa) =>
        fiches.get(pa).mandats.filter((m) => m.type === 'ASSEMBLEE' && m.legislature === '17')
          .length > 1,
    )
    .slice(0, 2)
    .forEach(enplus);
  // quelques députés par groupe, dans le scrutin final le plus récent
  const dernier = finals[0];
  const parGroupe = new Map();
  for (const [pa, organe] of listes(dernier))
    parGroupe.set(organe, [...(parGroupe.get(organe) ?? []), pa]);
  for (const pas of parGroupe.values()) pas.sort().slice(0, 4).forEach(enplus);
  // et dans les autres scrutins, pour que chaque groupe y soit représenté
  for (const s of choisis.values()) {
    const vus = new Map();
    for (const [pa, organe] of listes(s)) vus.set(organe, [...(vus.get(organe) ?? []), pa]);
    for (const [organe, pas] of vus)
      if (organe !== 'PO0' && !pas.some((pa) => retenus.has(pa))) enplus(pas.sort()[0]);
  }
  return { numeros: [...choisis.keys()].sort((a, b) => b - a), deputes: [...retenus].sort() };
}

// --- Écriture ----------------------------------------------------------------------------------------------------

function ecrire(destination, chemin, objet) {
  const complet = join(destination, chemin);
  mkdirSync(join(complet, '..'), { recursive: true });
  writeFileSync(complet, JSON.stringify(objet));
}

/**
 * @param {object} [options]
 * @param {string} [options.destination]
 * @param {string} [options.cache]
 * @param {(message: string) => void} [options.journal]
 */
export async function genererFixtures({
  destination = DESTINATION,
  cache,
  journal = console.log,
} = {}) {
  const archives = await ouvrirArchives({ depuis: 'officiel', cache, journal });

  const scrutins = [];
  for (const [, octets] of archives.scrutins()) scrutins.push(lireScrutin(json(octets)));
  const acteurs = [];
  const organesBruts = new Map();
  for (const [nom, octets] of archives.acteurs()) {
    if (estOrgane(nom)) {
      const brut = json(octets);
      const organe = lireOrgane(brut);
      if (organe.codeType === 'GP' && organe.legislature === '17')
        organesBruts.set(organe.id, brut);
    } else {
      acteurs.push(lireActeur(json(octets)));
    }
  }

  const { numeros, deputes } = choisir(scrutins, acteurs);
  const retenus = new Set(deputes);
  journal(
    `[fixtures] ${numeros.length} scrutins, ${deputes.length} députés, ${organesBruts.size} groupes`,
  );

  rmSync(destination, { recursive: true, force: true });
  const voulus = new Set(numeros);
  for (const [, octets] of archives.scrutins()) {
    const brut = json(octets);
    if (!voulus.has(Number(brut.scrutin.numero))) continue;
    ecrire(
      destination,
      `json/scrutins/VTANR5L17V${brut.scrutin.numero}.json`,
      reduireScrutin(brut, retenus),
    );
  }
  for (const [nom, octets] of archives.acteurs()) {
    if (estOrgane(nom)) continue;
    const brut = json(octets);
    const pa = typeof brut.acteur.uid === 'string' ? brut.acteur.uid : brut.acteur.uid['#text'];
    if (retenus.has(pa)) ecrire(destination, `json/acteur/${pa}.json`, reduireActeur(brut));
  }
  for (const [id, brut] of organesBruts)
    ecrire(destination, `json/organe/${id}.json`, reduireOrgane(brut));
  journal(`[fixtures] écrit dans ${destination}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  genererFixtures().catch((erreur) => {
    console.error(`[fixtures] ÉCHEC : ${erreur.message}`);
    process.exit(1);
  });
}
