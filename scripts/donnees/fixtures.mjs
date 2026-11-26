#!/usr/bin/env node
// `node scripts/donnees/fixtures.mjs` : regénère `src/server/fixtures/officiel/` à partir des vraies archives.
//
// Le jeu est un extrait RÉEL et RÉDUIT, au même format que les archives (fichiers JSON non zippés) :
//   json/scrutins/VTANR5L17V<n>.json   scrutins retenus (titres, dates, dossiers, résultats officiels, groupes réels),
//   json/acteur/PA<n>.json             députés retenus (identité, naissance, profession, adresse HATVP, adresses web
//                                      publiables, mandats de député de toutes les législatures, mandats de groupe, de bureau,
//                                      de commission permanente et de parti de la 17ᵉ législature),
//   json/organe/PO<n>.json             groupes politiques de la 17ᵉ législature, et organes cités par ces mandats,
//   wikidata.json                      extrait de la réponse de Wikidata (articles Wikipédia) pour ces députés,
//   json/dossierParlementaire/DL….json dossiers législatifs retenus (voir choisirDossiers), réduits aux actes utiles,
//   json/document/….json               titres des textes adoptés que citent ces dossiers.
// `--dossiers` ne régénère que les dossiers (et la séance des scrutins), sans changer le choix des scrutins.
// Les listes nominatives et les décomptes des scrutins sont réduits aux députés retenus : les effectifs du jeu sont
// donc ceux de l'échantillon, pas les totaux officiels (le résultat « adopté » ou « rejeté » reste l'officiel).

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classerTous } from './classer.mjs';
import { rattacher, textesSansVote } from './dossiers.mjs';
import {
  actes,
  lectureDeCode,
  liste,
  lireActeur,
  lireDocument,
  lireDossier,
  lireOrgane,
  lireScrutin,
  scrutinsCites,
} from './lire.mjs';
import { estDocument, estDossierLegislatif, estOrgane, ouvrirArchives } from './telecharger.mjs';
import { telechargerWikidata } from './wikipedia.mjs';

const DESTINATION = join('src', 'server', 'fixtures', 'officiel');
const POSITIONS = /** @type {const} */ ([
  ['pours', 'pour'],
  ['contres', 'contre'],
  ['abstentions', 'abstention'],
  ['nonVotants', 'nonvotant'],
]);

/**
 * Paires réelles [titulaire, remplaçant] gardées dans le jeu, pour tester l'effectif en mandat (DONNEES.md, « Effectif en
 * mandat ») : le remplaçant a pour `dateDebut` l'élection générale et pour `datePriseFonction` son arrivée.
 * - Fabien Di Filippo → Jérôme End : démission pour incompatibilité le 2026-04-20, remplaçant en fonction le 2026-04-21.
 * - Paul Christophe → Pierre Marle : ministre du 2024-10-22 au 2025-01-23 (Marle le remplace, puis lui rend sa place), puis
 *   démission le 2026-04-06 (Marle revient le 2026-04-07) : deux suspensions du même titulaire par le même remplaçant.
 * Les ministres qui ont repris leur mandat (Laurent Marcangeli le 2025-11-06, Valérie Létard…) sont dans le jeu par le
 * choix des scrutins : leur second mandat porte lui aussi la `dateDebut` de l'élection générale.
 */
export const PAIRES_DE_REMPLACEMENT = [
  ['PA720386', 'PA720390'],
  ['PA642868', 'PA794518'],
];

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
    if (cle.startsWith('@') || ['demandeur', 'sessionRef', 'quantiemeJourSeance'].includes(cle))
      delete s[cle];
  return { scrutin: s };
}

/** Types de mandat gardés pour la 17ᵉ législature (la fiche d'un député s'en sert), en plus des mandats de député. */
const MANDATS_GARDES = new Set(['GP', 'BUREAU', 'COMPER']);

/**
 * Un acteur brut réduit à ce que lit le script : identité, naissance et décès, profession, adresse HATVP, adresses
 * web (site, X, Facebook : jamais téléphone, e-mail ni adresse postale), mandats de député de toutes les législatures,
 * mandats de groupe, de bureau et de commission permanente de la 17ᵉ, parti de rattachement en cours.
 */
export function reduireActeur(brut) {
  const a = brut.acteur;
  const garder = (m) =>
    m.typeOrgane === 'ASSEMBLEE' ||
    (m.legislature === '17' && MANDATS_GARDES.has(m.typeOrgane)) ||
    (m.typeOrgane === 'PARPOL' && (m.dateFin ?? null) === null);
  const mandats = liste(a.mandats?.mandat)
    .filter(garder)
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
      // Le jour où le député entre vraiment en fonction : celui d'un remplaçant diffère de sa `dateDebut`.
      if (m.typeOrgane === 'ASSEMBLEE' && m.mandature?.datePriseFonction)
        reduit.mandature = { datePriseFonction: m.mandature.datePriseFonction };
      if (m.infosQualite) {
        const { codeQualite, libQualite, libQualiteSex } = m.infosQualite;
        reduit.infosQualite = { codeQualite, libQualite, libQualiteSex };
      }
      if (m.typeOrgane === 'ASSEMBLEE' && m.election?.lieu) {
        const { departement, numDepartement, numCirco } = m.election.lieu;
        reduit.election = { lieu: { departement, numDepartement, numCirco } };
      }
      return reduit;
    });
  const { civ, prenom, nom, alpha } = a.etatCivil.ident;
  /** @type {any} */
  const reduit = {
    uid: a.uid,
    etatCivil: { ident: { civ, prenom, nom, alpha } },
  };
  if (a.etatCivil.infoNaissance) reduit.etatCivil.infoNaissance = a.etatCivil.infoNaissance;
  if (a.etatCivil.dateDeces) reduit.etatCivil.dateDeces = a.etatCivil.dateDeces;
  if (a.profession) reduit.profession = { libelleCourant: a.profession.libelleCourant };
  if (a.uri_hatvp !== undefined) reduit.uri_hatvp = a.uri_hatvp;
  const web = liste(a.adresses?.adresse)
    .filter((x) => ['Site internet', 'Twitter', 'Facebook'].includes(x.typeLibelle))
    .map(({ uid, typeLibelle, valElec }) => ({ uid, typeLibelle, valElec }));
  if (web.length) reduit.adresses = { adresse: web.length === 1 ? web[0] : web };
  reduit.mandats = { mandat: mandats.length === 1 ? mandats[0] : mandats };
  return { acteur: reduit };
}

/** Identifiants des organes cités par les mandats de bureau, de commission permanente et de parti d'acteurs réduits. */
export function organesCites(acteursReduits) {
  const ids = new Set();
  for (const { acteur } of acteursReduits)
    for (const m of liste(acteur.mandats?.mandat))
      if (['BUREAU', 'COMPER', 'PARPOL'].includes(m.typeOrgane)) {
        const ref = m.organes?.organeRef;
        const id = typeof ref === 'string' ? ref : ref?.['#text'];
        if (id) ids.add(id);
      }
  return ids;
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
  // paires réelles titulaire / remplaçant (effectif en mandat)
  for (const paire of PAIRES_DE_REMPLACEMENT)
    for (const pa of paire) if (fiches.has(pa)) enplus(pa);
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
      organesBruts.set(lireOrgane(brut).id, brut);
    } else {
      acteurs.push(lireActeur(json(octets)));
    }
  }

  const { numeros, deputes } = choisir(scrutins, acteurs);
  const retenus = new Set(deputes);
  journal(`[fixtures] ${numeros.length} scrutins, ${deputes.length} députés`);

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
  const reduits = [];
  for (const [nom, octets] of archives.acteurs()) {
    if (estOrgane(nom)) continue;
    const brut = json(octets);
    const pa = typeof brut.acteur.uid === 'string' ? brut.acteur.uid : brut.acteur.uid['#text'];
    if (!retenus.has(pa)) continue;
    const reduit = reduireActeur(brut);
    reduits.push(reduit);
    ecrire(destination, `json/acteur/${pa}.json`, reduit);
  }
  // Les groupes de la 17ᵉ législature, et les organes (bureau, commissions, partis) cités par les mandats gardés.
  const cites = organesCites(reduits);
  let nbOrganes = 0;
  for (const [id, brut] of organesBruts) {
    const organe = lireOrgane(brut);
    if ((organe.codeType === 'GP' && organe.legislature === '17') || cites.has(id)) {
      ecrire(destination, `json/organe/${id}.json`, reduireOrgane(brut));
      nbOrganes++;
    }
  }
  await ecrireWikidata(destination, retenus, journal);
  ecrireDossiers({ destination, archives, journal });
  journal(`[fixtures] ${nbOrganes} organes, écrit dans ${destination}`);
}

/** `wikidata.json` : la vraie réponse de Wikidata, réduite aux députés retenus (même format SPARQL). */
async function ecrireWikidata(destination, retenus, journal) {
  const liens = await telechargerWikidata({ journal });
  const numeros = new Set([...retenus].map((pa) => pa.replace(/^PA/, '')));
  const bindings = [...liens]
    .filter(([numero]) => numeros.has(numero))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([numero, article]) => ({
      article: { type: 'uri', value: article },
      an: { type: 'literal', value: numero },
    }));
  ecrire(destination, 'wikidata.json', {
    head: { vars: ['an', 'article'] },
    results: { bindings },
  });
  journal(`[fixtures] wikidata.json : ${bindings.length} articles pour ${numeros.size} députés`);
}

// --- Dossiers législatifs ----------------------------------------------------------------------------------------

/** Un acte réduit : sans ses sous-actes (on garde une liste plate des actes retenus). */
const sansSousActes = (acte) => ({ ...structuredClone(acte), actesLegislatifs: null });

/**
 * Un dossier brut réduit aux actes que `garder` retient, à plat, et à ce que lit `lireDossier`.
 * @param {any} brut `{ dossierParlementaire: … }`
 * @param {(acte: any) => boolean} garder
 */
export function reduireDossier(brut, garder) {
  const d = brut.dossierParlementaire;
  const gardes = [...actes(d.actesLegislatifs)].filter(garder).map(sansSousActes);
  return {
    dossierParlementaire: {
      '@xsi:type': d['@xsi:type'],
      uid: d.uid,
      legislature: d.legislature,
      titreDossier: { titre: d.titreDossier?.titre ?? null },
      procedureParlementaire: {
        code: d.procedureParlementaire?.code ?? null,
        libelle: d.procedureParlementaire?.libelle ?? null,
      },
      // Comme l'archive : un seul acte est un objet, plusieurs forment un tableau.
      actesLegislatifs: { acteLegislatif: gardes.length === 1 ? gardes[0] : gardes },
    },
  };
}

/** Un document brut réduit à son identifiant et à son titre principal. */
export function reduireDocument(brut) {
  return {
    document: {
      uid: brut.document.uid,
      titres: { titrePrincipal: brut.document.titres?.titrePrincipal ?? null },
    },
  };
}

/**
 * Les dossiers du jeu de test, choisis sur les vraies archives :
 * - le dossier de loi de chaque scrutin du jeu qui n'a pas de dossier propre mais qu'un dossier cite, sauf pour le plus
 *   ancien vote final concerné, qui reste sans dossier (le cas existe toujours : `/scrutins/:numero`) ; on n'en garde que
 *   les décisions et motions qui citent un scrutin du jeu ;
 * - les deux textes les plus récents dont la dernière décision est une adoption à main levée, et le plus récent adopté
 *   par l'article 49.3 ; on n'en garde que cette décision.
 *
 * @param {object} entree
 * @param {import('./lire.mjs').ScrutinLu[]} entree.scrutins Tous les scrutins de l'archive.
 * @param {import('./lire.mjs').DossierLu[]} entree.dossiers Tous les dossiers de l'archive.
 * @param {number[]} entree.numeros Scrutins du jeu.
 * @returns {{ uid: string, scrutins: Set<number>, decision: { date: string, lecture: string } | null }[]}
 */
export function choisirDossiers({ scrutins, dossiers, numeros }) {
  const ordonnes = [...scrutins].sort(parNumeroDecroissant);
  const types = classerTous(ordonnes.map((s) => ({ titre: s.titre, typeVote: s.codeTypeVote })));
  const { dossierDe } = rattacher(ordonnes, dossiers);
  const jeu = new Set(numeros);
  const choix = new Map();

  const rattachables = ordonnes
    .map((s, i) => ({ s, final: types[i] === 'final' }))
    .filter(({ s }) => jeu.has(s.numero) && s.dossier === null && dossierDe.get(s.numero));
  const gardeSansDossier = rattachables.filter(({ final }) => final).at(-1)?.s.numero;
  for (const { s } of rattachables) {
    if (s.numero === gardeSansDossier) continue;
    const uid = dossierDe.get(s.numero);
    const deja = choix.get(uid) ?? { uid, scrutins: new Set(), decision: null };
    deja.scrutins.add(s.numero);
    choix.set(uid, deja);
  }

  const textes = textesSansVote({
    dossiers,
    titres: new Map(),
    scrutins: ordonnes.map((s, i) => ({
      numero: s.numero,
      date: s.date,
      seance: s.seance,
      final: types[i] === 'final',
    })),
    dossierDe,
  });
  const parUid = new Map(dossiers.map((d) => [d.uid, d]));
  // La décision sans vote doit être la dernière de l'Assemblée sur le texte : c'est elle qui fait sa carte.
  const derniere = (t) =>
    parUid.get(t.id).decisions.every((x) => x.date <= t.decisions[0].date) && !choix.has(t.id);
  const retenus = [
    ...textes.filter((t) => t.decisions[0].mode === 'mainLevee' && derniere(t)).slice(0, 2),
    ...textes.filter((t) => t.decisions[0].mode === 'article49-3' && derniere(t)).slice(0, 1),
  ];
  for (const t of retenus)
    choix.set(t.id, {
      uid: t.id,
      scrutins: new Set(),
      decision: { date: t.decisions[0].date, lecture: t.decisions[0].lecture },
    });
  return [...choix.values()].sort((a, b) => (a.uid < b.uid ? -1 : 1));
}

/** Retient un acte brut d'après un choix de {@link choisirDossiers}. */
function acteRetenu(choix) {
  return (acte) => {
    const type = acte['@xsi:type'];
    if (type === 'DecisionMotionCensure_Type')
      return scrutinsCites(acte.voteRefs).some((n) => choix.scrutins.has(n));
    if (type !== 'Decision_Type') return false;
    if (scrutinsCites(acte.voteRefs).some((n) => choix.scrutins.has(n))) return true;
    const date = typeof acte.dateActe === 'string' ? acte.dateActe.slice(0, 10) : null;
    return (
      choix.decision !== null &&
      date === choix.decision.date &&
      lectureDeCode(acte.codeActe) === choix.decision.lecture
    );
  };
}

/**
 * Écrit les dossiers (et les titres de leurs textes) du jeu, et ajoute la séance réelle aux scrutins du jeu déjà écrits.
 * @param {object} entree
 * @param {string} entree.destination
 * @param {Awaited<ReturnType<typeof ouvrirArchives>>} entree.archives Archives officielles ouvertes.
 * @param {(message: string) => void} entree.journal
 */
export function ecrireDossiers({ destination, archives, journal }) {
  const scrutins = [];
  for (const [, octets] of archives.scrutins()) scrutins.push(lireScrutin(json(octets)));
  const dossiers = [];
  for (const [nom, octets] of archives.dossiers())
    if (estDossierLegislatif(nom)) dossiers.push(lireDossier(json(octets)));
  const dossierScrutins = join(destination, 'json', 'scrutins');
  const numeros = readdirSync(dossierScrutins).map((f) => Number(/V(\d+)\.json$/.exec(f)[1]));
  const choix = new Map(choisirDossiers({ scrutins, dossiers, numeros }).map((c) => [c.uid, c]));

  rmSync(join(destination, 'json', 'dossierParlementaire'), { recursive: true, force: true });
  rmSync(join(destination, 'json', 'document'), { recursive: true, force: true });
  const textes = new Set();
  for (const [nom, octets] of archives.dossiers()) {
    if (!estDossierLegislatif(nom)) continue;
    const brut = json(octets);
    const c = choix.get(brut.dossierParlementaire.uid);
    if (!c) continue;
    const reduit = reduireDossier(brut, acteRetenu(c));
    for (const d of lireDossier(reduit).decisions) d.textes.forEach((t) => textes.add(t));
    ecrire(destination, `json/dossierParlementaire/${c.uid}.json`, reduit);
  }
  for (const [nom, octets] of archives.dossiers()) {
    if (!estDocument(nom)) continue;
    const brut = json(octets);
    if (!textes.has(lireDocument(brut).uid)) continue;
    ecrire(destination, `json/document/${brut.document.uid}.json`, reduireDocument(brut));
  }

  // La séance de chaque scrutin du jeu, que le jeu n'avait pas avant les dossiers.
  const seances = new Map(scrutins.map((s) => [s.numero, s.seance]));
  for (const f of readdirSync(dossierScrutins)) {
    const chemin = join(dossierScrutins, f);
    const brut = JSON.parse(readFileSync(chemin, 'utf8'));
    const seance = seances.get(Number(brut.scrutin.numero)) ?? null;
    if (seance) brut.scrutin.seanceRef = seance;
    writeFileSync(chemin, JSON.stringify(brut));
  }
  journal(
    `[fixtures] ${choix.size} dossiers et ${textes.size} textes cités, séance ajoutée aux scrutins`,
  );
}

/**
 * Régénère seulement les dossiers du jeu (`--dossiers`), sans toucher au choix des scrutins ni des députés.
 * @param {{ destination?: string, cache?: string, journal?: (message: string) => void }} [options]
 */
export async function genererDossiers({
  destination = DESTINATION,
  cache,
  journal = console.log,
} = {}) {
  const archives = await ouvrirArchives({ depuis: 'officiel', cache, journal });
  ecrireDossiers({ destination, archives, journal });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (process.argv.includes('--dossiers') ? genererDossiers() : genererFixtures()).catch((erreur) => {
    console.error(`[fixtures] ÉCHEC : ${erreur.message}`);
    process.exit(1);
  });
}
