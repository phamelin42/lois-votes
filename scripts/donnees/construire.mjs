// Réduction des archives lues (lire.mjs) en fichiers compacts, selon docs/DONNEES.md. Fonction pure : aucune
// lecture ni écriture de fichier. Les garde-fous font échouer le build plutôt que de publier des données fausses.

import { CARACTERES_GROUPE } from '../../src/server/donnees.types.ts';
import { classerTous } from './classer.mjs';

/**
 * Contrôle de l'effectif : pour chaque scrutin, le nombre de députés « en mandat » (cases ≠ `-` de `votes.txt`) est
 * comparé à l'effectif officiel (somme des `nombreMembresGroupe`). Mesuré sur l'archive du 20/10/2026 : l'écart va de
 * -1 à +1 sur les 8 894 scrutins (8 748 exacts), alors que, avant la correction des dates de début de mandat, il allait
 * de 0 à +65.
 *
 * - `tolerance` : un écart d'au plus 3 est normal. Un jour de changement (décès, démission, entrée en fonction), le
 *   décompte officiel varie d'un scrutin à l'autre de la journée alors que nos dates sont des jours entiers : +1 ou -1.
 *   Le 13/11/2025, une trentaine d'entrées et de sorties le même jour ne donnent que ±1, car chaque départ a son
 *   remplaçant ; 3 laisse de la marge sans cacher un vrai défaut.
 * - Au-delà, c'est un **avertissement** (journal et `meta.avertissements`), jamais un échec : une anomalie de la source
 *   bloquerait aussi la mise à jour nocturne.
 * - `grossier` et `partGrossiere` : l'échec est réservé à un défaut systématique. Plus de 1 % des scrutins (89 sur
 *   8 894) avec un écart de plus de 20, ce qui est la signature d'un champ de date disparu ou changé de sens (le défaut
 *   corrigé ici en donnait 6 284, soit 71 %). Quelques journées anormales de l'archive (une soixantaine de scrutins au
 *   plus par jour) ne font donc pas échouer le build.
 */
export const SEUILS_EFFECTIF = { tolerance: 3, grossier: 20, partGrossiere: 0.01 };

/**
 * Seuils du plan : en dessous, l'archive est incomplète ou ce n'est pas la bonne. `effectif` est absent du mini-jeu de
 * fixtures (les listes nominatives y sont réduites à 99 députés : son effectif n'est pas celui de l'Assemblée).
 */
export const SEUILS_OFFICIELS = { scrutins: 8000, deputes: 570, effectif: SEUILS_EFFECTIF };

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

const JOUR = 24 * 60 * 60 * 1000;
/** Jour suivant une date `AAAA-MM-JJ`. */
function lendemain(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + JOUR).toISOString().slice(0, 10);
}

/**
 * Premier jour où un mandat de député compte « en mandat » : la prise de fonction (`mandature.datePriseFonction`) quand
 * elle est postérieure à `dateDebut`, sinon `dateDebut`. L'archive donne à un **remplaçant** (nommé au gouvernement,
 * démissionnaire, décédé, en mission…) la `dateDebut` de l'élection générale (2024-06-30 ou 2024-07-07) au lieu du jour de
 * son arrivée : lu tel quel, il serait compté « en mandat » avec son titulaire pendant des mois, et sa participation
 * s'effondrerait (Pauline Cestrières : 10 % au lieu de 35 %). Voir DONNEES.md, « Effectif en mandat ».
 *
 * @param {{ debut: string, priseFonction?: string | null }} mandat
 */
export function debutEffectif(mandat) {
  return mandat.priseFonction && mandat.priseFonction > mandat.debut
    ? mandat.priseFonction
    : mandat.debut;
}

/**
 * Date de début affichée sur la fiche (`mandat.depuis`). Un député élu garde la `dateDebut` de l'archive (la date de son
 * élection : « 30 juin 2024 ») ; la prise de fonction d'un élu tombe le lendemain, sans intérêt. Un remplaçant, lui,
 * montre sa prise de fonction, puisque la `dateDebut` de l'archive (l'élection de son titulaire) serait fausse.
 *
 * @param {{ debut: string, priseFonction?: string | null }} mandat
 */
export function debutAffiche(mandat) {
  return mandat.priseFonction && mandat.priseFonction > lendemain(mandat.debut)
    ? mandat.priseFonction
    : mandat.debut;
}

/**
 * Compare, pour chaque scrutin, les députés en mandat à l'effectif officiel (voir `SEUILS_EFFECTIF`).
 *
 * @param {{ numero: number, enMandat: number, officiel: number }[]} scrutins
 * @param {{ tolerance: number, grossier: number, partGrossiere: number }} seuils
 * @returns {{ ecartMax: number, repartition: Record<string, number>, horsTolerance: number[] }}
 * @throws {ErreurDonnees} quand plus de `partGrossiere` des scrutins ont un écart de plus de `grossier`.
 */
export function controlerEffectif(scrutins, seuils) {
  /** @type {Map<number, number>} */
  const histogramme = new Map();
  /** @type {{ numero: number, enMandat: number, officiel: number, ecart: number } | null} */
  let pire = null;
  const horsTolerance = [];
  let grossiers = 0;
  for (const s of scrutins) {
    const ecart = s.enMandat - s.officiel;
    histogramme.set(ecart, (histogramme.get(ecart) ?? 0) + 1);
    if (pire === null || Math.abs(ecart) > Math.abs(pire.ecart)) pire = { ...s, ecart };
    if (Math.abs(ecart) > seuils.tolerance) horsTolerance.push(s.numero);
    if (Math.abs(ecart) > seuils.grossier) grossiers++;
  }
  if (pire && grossiers > Math.floor(scrutins.length * seuils.partGrossiere)) {
    throw new ErreurDonnees(
      `effectif : ${grossiers} scrutins sur ${scrutins.length} ont plus de ${seuils.grossier} députés d'écart entre ` +
        `« en mandat » et l'effectif officiel (le pire : scrutin ${pire.numero}, ${pire.enMandat} en mandat pour ` +
        `${pire.officiel} officiels) : les dates de mandat sont sans doute fausses`,
    );
  }
  return {
    ecartMax: pire ? Math.abs(pire.ecart) : 0,
    repartition: Object.fromEntries(
      [...histogramme]
        .sort((a, b) => a[0] - b[0])
        .map(([ecart, nombre]) => [String(ecart), nombre]),
    ),
    horsTolerance: horsTolerance.sort((a, b) => a - b),
  };
}

/**
 * Périodes d'appartenance à un groupe d'après les mandats `GP`, de la plus ancienne à la plus récente. Les mandats
 * en double (une même appartenance déclarée sous deux qualités) sont écartés, et les périodes qui se suivent sans
 * trou dans un même groupe n'en font qu'une (un seul groupe, deux mandats).
 *
 * @param {import('./lire.mjs').MandatLu[]} mandats
 * @returns {{ id: string, debut: string, fin: string | null }[]}
 */
export function periodesDeGroupe(mandats) {
  const triees = mandats
    .filter((m) => m.organe)
    .map((m) => ({ id: /** @type {string} */ (m.organe), debut: m.debut, fin: m.fin }))
    .sort(
      (a, b) =>
        (a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0) ||
        (a.fin ?? FIN_DES_TEMPS).localeCompare(b.fin ?? FIN_DES_TEMPS) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  /** @type {{ id: string, debut: string, fin: string | null }[]} */
  const periodes = [];
  for (const periode of triees) {
    const derniere = periodes.at(-1);
    if (
      derniere &&
      derniere.id === periode.id &&
      (derniere.fin === null || lendemain(derniere.fin) >= periode.debut)
    ) {
      if (derniere.fin !== null && (periode.fin === null || periode.fin > derniere.fin))
        derniere.fin = periode.fin;
    } else {
      periodes.push({ ...periode });
    }
  }
  return periodes;
}

/**
 * Fonctions en cours à l'Assemblée : le bureau (« Vice-président de l'Assemblée nationale ») puis la commission
 * permanente (« Membre » de la « Commission des affaires étrangères »), dans la 17ᵉ législature.
 *
 * @param {import('./lire.mjs').MandatLu[]} mandats
 * @param {Map<string, import('./lire.mjs').OrganeLu>} organes
 * @returns {{ organe: string, qualite: string, depuis: string }[]}
 */
export function fonctionsEnCours(mandats, organes) {
  const rang = { BUREAU: 0, COMPER: 1 };
  const trouvees = mandats
    .filter((m) => m.legislature === '17' && m.fin === null && m.type in rang && m.organe)
    .flatMap((m) => {
      const organe = organes.get(/** @type {string} */ (m.organe));
      return organe?.libelle
        ? [
            {
              rang: rang[m.type],
              organe: organe.libelle,
              qualite: m.qualite ?? 'Membre',
              depuis: m.debut,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        a.rang - b.rang ||
        (a.depuis < b.depuis ? -1 : a.depuis > b.depuis ? 1 : 0) ||
        a.organe.localeCompare(b.organe, 'fr') ||
        a.qualite.localeCompare(b.qualite, 'fr'),
    );
  const vues = new Set();
  return trouvees
    .filter((f) => {
      const cle = `${f.organe}|${f.qualite}|${f.depuis}`;
      return vues.has(cle) ? false : (vues.add(cle), true);
    })
    .map(({ organe, qualite, depuis }) => ({ organe, qualite, depuis }));
}

/** Numéros de législature des mandats de député, sans doublon, du plus ancien au plus récent. */
export function legislaturesDeDepute(mandats) {
  const numeros = mandats
    .filter((m) => m.type === 'ASSEMBLEE' && /^\d{1,2}$/.test(m.legislature))
    .map((m) => Number(m.legislature));
  return [...new Set(numeros)].sort((a, b) => a - b);
}

/**
 * Parts de députés qui ont chaque information : pour juger de la couverture des sources, sur les députés en mandat
 * puis sur tous.
 * @param {Array<{ naissance: unknown, profession: unknown, liens: Record<string, string | null> }>} deputes
 */
export function couverture(deputes) {
  const compter = (liste) => ({
    deputes: liste.length,
    wikipedia: liste.filter((d) => d.liens.wikipedia).length,
    hatvp: liste.filter((d) => d.liens.hatvp).length,
    profession: liste.filter((d) => d.profession).length,
    naissance: liste.filter((d) => d.naissance).length,
    siteWeb: liste.filter((d) => d.liens.siteWeb).length,
    x: liste.filter((d) => d.liens.x).length,
    facebook: liste.filter((d) => d.liens.facebook).length,
  });
  return { actifs: compter(deputes.filter((d) => d.actif)), tous: compter(deputes) };
}

/**
 * @param {object} entree
 * @param {import('./lire.mjs').ScrutinLu[]} entree.scrutins
 * @param {import('./lire.mjs').ActeurLu[]} entree.acteurs
 * @param {import('./lire.mjs').OrganeLu[]} entree.organes
 * @param {{ scrutins: object, acteurs: object }} entree.sources
 * @param {Map<string, string> | null} [entree.wikipedia] Articles Wikipédia par numéro d'acteur sans « PA » ; `null` quand Wikidata est indisponible.
 * @param {string[]} [entree.avertissements] Sources facultatives manquantes (`wikipedia`), recopiées dans `meta.json`.
 * @param {Date} [entree.maintenant]
 * @param {{ scrutins: number, deputes: number, effectif?: typeof SEUILS_EFFECTIF }} [entree.seuils] `effectif` absent : pas de contrôle de l'effectif (fixtures, tests).
 */
export function construire({
  scrutins,
  acteurs,
  organes,
  sources,
  wikipedia = null,
  avertissements = [],
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
  const organesParId = new Map(organes.map((o) => [o.id, o]));
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
  /** Groupes de l'historique des députés qu'aucun scrutin ne liste (« AD ») : ils n'ont pas d'index dans les matrices. */
  const groupesHorsScrutins = new Set();
  const deputes = pas.map((pa) => {
    const fiche = fiches.get(pa);
    const nom = `${fiche.prenom} ${fiche.nom}`.trim();
    const base = slugifier(nom) || pa.toLowerCase();
    const n = (vus.get(base) ?? 0) + 1;
    vus.set(base, n);
    const slug = n === 1 ? base : `${base}-${n}`;

    // Le mandat en cours se choisit sur son début effectif : un remplaçant qui revient a deux mandats de même `dateDebut`.
    const assemblee = mandatsAssemblee(pa).map((m) => ({
      ...m,
      debut: debutEffectif(m),
      depuis: debutAffiche(m),
    }));
    const mandat = assemblee.length ? plusRecent(assemblee) : null;
    const lieu = mandat?.lieu ?? null;
    const groupe = (() => {
      const connus = mandatsGp(pa).filter((m) => indexGroupe.has(m.organe));
      return connus.length ? plusRecent(connus).organe : null;
    })();
    const actif = assemblee.some((m) => m.fin === null);
    // Les groupes de l'historique : ceux dont l'organe est connu (même s'ils n'apparaissent dans aucun scrutin).
    const periodes = periodesDeGroupe(mandatsGp(pa)).filter((p) => organesGp.has(p.id));
    for (const p of periodes) if (!indexGroupe.has(p.id)) groupesHorsScrutins.add(p.id);
    const parti = actif
      ? fiche.mandats
          .filter(
            (m) => m.type === 'PARPOL' && m.fin === null && m.organe && organesParId.has(m.organe),
          )
          .sort((a, b) => (a.debut < b.debut ? 1 : a.debut > b.debut ? -1 : 0))[0]
      : undefined;
    return {
      pa,
      slug,
      nom,
      nomTri: fiche.nom.replace(/\s*\([^)]*\)\s*$/, '').trim(),
      groupe,
      departement: lieu?.numDepartement ?? null,
      circonscription:
        lieu?.departement && lieu.numCirco ? `${lieu.departement} (${lieu.numCirco})` : null,
      actif,
      naissance: fiche.naissance,
      deces: fiche.deces,
      profession: fiche.profession,
      mandat: mandat
        ? {
            depuis: mandat.depuis,
            fin: mandat.fin,
            legislatures: legislaturesDeDepute(fiche.mandats),
          }
        : null,
      groupes: periodes,
      fonctions: actif ? fonctionsEnCours(fiche.mandats, organesParId) : [],
      parti: parti
        ? (organesParId.get(/** @type {string} */ (parti.organe))?.libelle ?? null)
        : null,
      liens: {
        hatvp: fiche.hatvp,
        wikipedia: wikipedia?.get(pa.replace(/^PA/, '')) ?? null,
        siteWeb: fiche.liens.siteWeb,
        x: fiche.liens.x,
        facebook: fiche.liens.facebook,
      },
    };
  });
  const autresGroupes = [...groupesHorsScrutins]
    .map((id) => organesGp.get(id))
    .sort((a, b) => (a.debut ?? '').localeCompare(b.debut ?? '') || a.id.localeCompare(b.id))
    .map((o) => ({
      id: o.id,
      abrege: o.abrege,
      libelle: o.libelle,
      couleur: o.couleur,
      debut: o.debut,
      fin: o.fin,
    }));
  const slugs = new Set(deputes.map((d) => d.slug));
  if (slugs.size !== deputes.length) throw new ErreurDonnees('deux députés avec le même slug');
  const colonne = new Map(pas.map((pa, i) => [pa, i]));

  // Mandats de député, pour distinguer « absent » (en mandat, dans aucune liste) de « pas en mandat ». Un mandat compte
  // du jour de la prise de fonction au jour de `dateFin`, bornes comprises (`debutEffectif`) : un remplaçant n'est pas
  // « en mandat » pendant que son titulaire siège. Le jour d'un changement, titulaire et remplaçant seraient tous deux
  // « en mandat » s'ils se chevauchaient ; l'archive donne la prise de fonction du remplaçant le lendemain du dernier
  // jour du titulaire (aucun chevauchement sur les 75 sièges concernés), donc pas de règle de départage à ajouter.
  const intervalles = pas.map((pa) =>
    mandatsAssemblee(pa).map((m) => [debutEffectif(m), m.fin ?? FIN_DES_TEMPS]),
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
  /** Députés en mandat et effectif officiel de chaque scrutin, pour le contrôle de l'effectif. */
  const effectifs = [];
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
    effectifs.push({
      numero: s.lu.numero,
      enMandat: votes.reduce((n, c) => (c === '-' ? n : n + 1), 0),
      // Toutes les entrées de groupe de l'archive, y compris celles écartées faute de député listé.
      officiel: s.lu.groupes.reduce((n, g) => n + g.nombreMembres, 0),
    });

    return {
      n: s.lu.numero,
      date,
      titre: s.lu.titre,
      type: types[i],
      adopte: s.lu.sortCode === 'adopté',
      solennel: s.lu.codeTypeVote === 'SPS',
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

  // --- Garde-fou sur l'effectif en mandat -------------------------------------------------------------------------
  const effectif = seuils.effectif ? controlerEffectif(effectifs, seuils.effectif) : null;
  const avertissementsFinaux = [...avertissements];
  if (effectif?.horsTolerance.length) avertissementsFinaux.push('effectif');

  const meta = {
    genereLe: maintenant.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    scrutins: scrutinsFichier.length,
    deputes: deputes.length,
    groupes: groupes.length,
    autresGroupes,
    avertissements: avertissementsFinaux,
    sources,
    statistiques: {
      adoptes: scrutinsFichier.filter((s) => s.adopte).length,
      rejetes: scrutinsFichier.filter((s) => !s.adopte).length,
      sansDossier: scrutinsFichier.filter((s) => s.dossier === null).length,
      misesAuPoint: ordonnes.filter((s) => s.lu.miseAuPoint).length,
      groupesRattaches,
      nonVotantsCorriges,
      effectif,
      couverture: couverture(deputes),
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
