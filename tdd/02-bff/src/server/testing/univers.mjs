// Jeu de données synthétique mais réaliste (colonnes de NosParlementaires et de Datan), partagé par les specs
// du serveur et par les tests e2e. Tout est déterministe. Les valeurs attendues les plus importantes sont écrites
// en dur dans `ATTENDU` (vérifiées à la main), le reste se déduit des lignes brutes exportées ici.
//
// ⚠ Colonnes de Datan : provisoires (l'API tabulaire n'était pas joignable pour le prompt 00). Elles sont
// regroupées dans `COLONNES_DATAN` ; `src/server/source/` doit les lire à un seul endroit.

import { creerFauxTabulaire } from './faux-tabulaire.mjs';

export const BASE_FAUSSE = 'http://tabulaire.test/api';

export const RIDS = {
  scrutins: 'rid-scrutins',
  votes: 'rid-votes',
  deputes: 'rid-deputes',
  datanDeputes: 'rid-datan-deputes',
};

export const COLONNES_DATAN = {
  id: 'id', // identifiant « PA… »
  prenom: 'prenom',
  nom: 'nom',
  departement: 'departement_code',
  participation: 'participation_score', // 0..1
  loyaute: 'loyaute_score', // 0..1
};

const JOUR = 86_400_000;
const DEBUT = Date.UTC(2025, 0, 1, 22, 0, 0);
/** Date d'un scrutin au format de la source : `2025-01-02T22:00:00+00:00`. */
export function dateScrutin(numero) {
  return new Date(DEBUT + numero * JOUR).toISOString().replace('.000Z', '+00:00');
}

// ───────────────────────────── Députés ─────────────────────────────

const RN = { group_short: 'RN', group_label: 'Rassemblement National' };
const SOC = { group_short: 'SOC', group_label: 'Socialistes et apparentés' };
const LFI = { group_short: 'LFI-NFP', group_label: 'La France insoumise - Nouveau Front Populaire' };

function depute(slug, prenom, nom, groupe, departement, circonscription, active = true) {
  return {
    slug,
    first_name: prenom,
    last_name: nom,
    full_name: `${prenom} ${nom}`,
    group_short: groupe?.group_short ?? null,
    group_label: groupe?.group_label ?? null,
    constituency_label: circonscription,
    department_code: departement,
    active,
  };
}

export const DEPUTES = [
  depute('alice-durand', 'Alice', 'Durand', RN, '69', 'Rhône (7)'),
  depute('bruno-martin', 'Bruno', 'Martin', RN, '13', 'Bouches-du-Rhône (3)'),
  depute('claire-petit', 'Claire', 'Petit', RN, '59', 'Nord (12)'),
  depute('david-moreau', 'David', 'Moreau', RN, '83', 'Var (4)'),
  depute('emilie-laurent', 'Émilie', 'Laurent', SOC, '31', 'Haute-Garonne (2)'),
  depute('francois-simon', 'François', 'Simon', SOC, '33', 'Gironde (5)'),
  depute('gaelle-michel', 'Gaëlle', 'Michel', SOC, '44', 'Loire-Atlantique (1)'),
  depute('hugo-lefebvre', 'Hugo', 'Lefebvre', LFI, '93', 'Seine-Saint-Denis (9)'),
  depute('elodie-roux', 'Élodie', 'Roux', LFI, '75', 'Paris (11)'),
  depute('ibrahim-garnier', 'Ibrahim', 'Garnier', LFI, '13', 'Bouches-du-Rhône (7)'),
  depute('julie-fournier', 'Julie', 'Fournier', null, '69', 'Rhône (1)'), // sans groupe : « NI »
  depute('karim-girard', 'Karim', 'Girard', SOC, '34', 'Hérault (2)', false), // ancien député
];
export const DEPUTES_ACTIFS = DEPUTES.filter((d) => d.active);

/** Slug qui vote mais n'est dans aucune ressource : il tombe dans « NI ». */
export const SLUG_INCONNU = 'inconnu-xyz';

// Datan : `elodie-roux` est en majuscules (la jointure doit ignorer casse et accents), `gaelle-michel` est absente.
function datan(id, prenom, nom, departement, participation, loyaute) {
  return {
    [COLONNES_DATAN.id]: id,
    [COLONNES_DATAN.prenom]: prenom,
    [COLONNES_DATAN.nom]: nom,
    [COLONNES_DATAN.departement]: departement,
    [COLONNES_DATAN.participation]: participation,
    [COLONNES_DATAN.loyaute]: loyaute,
  };
}
export const DATAN = [
  datan('PA1001', 'Alice', 'Durand', '69', 0.91, 0.99),
  datan('PA1002', 'Bruno', 'Martin', '13', 0.85, 0.97),
  datan('PA1003', 'Claire', 'Petit', '59', 0.78, 0.95),
  datan('PA1004', 'David', 'Moreau', '83', 0.93, 0.88),
  datan('PA2001', 'Émilie', 'Laurent', '31', 0.7, 0.96),
  datan('PA2002', 'François', 'Simon', '33', 0.66, 0.94),
  datan('PA3001', 'Hugo', 'Lefebvre', '93', 0.88, 0.98),
  datan('PA3002', 'ÉLODIE', 'ROUX', '75', 0.9, 0.92),
  datan('PA3003', 'Ibrahim', 'Garnier', '13', 0.81, 0.93),
  datan('PA4001', 'Julie', 'Fournier', '69', 0.75, null),
];

// ───────────────────────────── Scrutins ─────────────────────────────

export const FINAUX = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111];
const DOSSIER_2000 = 'DLR5L17N2000';

const TITRES = {
  50: "la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par M. Jean Dupont et plusieurs de ses collègues",
  90: "l'ensemble de la proposition de loi visant à protéger les abeilles (première lecture)",
  95: "l'ensemble de la proposition de loi visant à protéger les abeilles (nouvelle lecture)",
  98: "l'ensemble de la proposition de loi relative aux sujets sans dossier (première lecture)",
  110: "l'ensemble du projet de loi relatif à la sobriété foncière (première lecture)",
  112: "l'amendement n° 12 de M. Dupont à l'article 3 du projet de loi relatif à la sobriété foncière",
  113: "l'article 3 du projet de loi relatif à la sobriété foncière",
  114: "le sous-amendement n° 7 de Mme Durand à l'amendement n° 12 du Gouvernement",
  115: "l'ensemble des crédits de la mission « Défense »", // contient « l'ensemble » mais n'est PAS un vote final
};
function titre(n) {
  if (TITRES[n]) return TITRES[n];
  const type = n % 2 === 0 ? 'du projet de loi relatif' : 'de la proposition de loi visant à agir sur';
  return `l'ensemble ${type} au sujet n°${n} (première lecture)`;
}
function dossier(n) {
  if (FINAUX.includes(n)) return `DLR5L17N${1000 + n}`;
  if (n === 90 || n === 95) return DOSSIER_2000;
  if (n >= 112 && n <= 114) return 'DLR5L17N1110';
  return null; // 50, 98, 115
}

export const NUMEROS_SCRUTINS = [50, 90, 95, 98, ...FINAUX, 112, 113, 114, 115];

// ───────────────────────────── Votes ─────────────────────────────

const GROUPE_DE = Object.fromEntries(DEPUTES.map((d) => [d.slug, d.group_short]));

function positionGeneree(slug, n) {
  switch (GROUPE_DE[slug]) {
    case 'RN':
      return n % 2 === 0 ? 'pour' : 'contre';
    case 'SOC':
      return n % 2 === 0 ? 'contre' : 'pour';
    case 'LFI-NFP':
      return n % 3 === 0 ? 'abstention' : 'contre';
    default:
      return 'pour'; // julie-fournier
  }
}

// Le scrutin 110 est écrit à la main (voir ATTENDU).
const VOTES_110 = {
  'alice-durand': 'pour',
  'bruno-martin': 'pour',
  'claire-petit': 'pour',
  'david-moreau': 'abstention',
  'emilie-laurent': 'contre',
  'francois-simon': 'contre',
  'gaelle-michel': 'contre',
  'hugo-lefebvre': 'contre',
  'elodie-roux': 'contre',
  'ibrahim-garnier': 'nonvotant',
  'julie-fournier': 'pour',
  [SLUG_INCONNU]: 'abstention',
};

function votesDuScrutin(n) {
  if (n === 110) return Object.entries(VOTES_110);
  const actifs = DEPUTES_ACTIFS.map((d) => [d.slug, positionGeneree(d.slug, n)]);
  return n === 90 ? [...actifs, ['karim-girard', 'pour']] : actifs;
}

const POSITION_SOURCE = { pour: 'POUR', contre: 'CONTRE', abstention: 'ABSTENTION', nonvotant: 'NONVOTANT' };

export const VOTES = NUMEROS_SCRUTINS.flatMap((n) =>
  votesDuScrutin(n).map(([slug, position]) => ({
    scrutin_id: `VTANR5L17V${n}`,
    deputy_slug: slug,
    position: POSITION_SOURCE[position],
  })),
);

function compter(n) {
  const compte = { pour: 0, contre: 0, abstention: 0, nonvotant: 0 };
  for (const [, position] of votesDuScrutin(n)) compte[position]++;
  return compte;
}

export const SCRUTINS = NUMEROS_SCRUTINS.map((n) => ({
  id: `VTANR5L17V${n}`,
  date: dateScrutin(n),
  title: titre(n),
  dossier_ref: dossier(n),
  ...compter(n),
}));

// ───────────────────────────── Attendus écrits à la main ─────────────────────────────

export const ATTENDU = {
  /** Scrutin 110 : 4 pour (3 RN + julie), 5 contre (3 SOC + 2 LFI), 2 abst. (david + inconnu), 1 non-votant. */
  scrutin110: {
    numero: 110,
    dossier: 'DLR5L17N1110',
    titreOfficiel: TITRES[110],
    titreCourt: 'Projet de loi relatif à la sobriété foncière',
    lecture: 'première lecture',
    compte: { pour: 4, contre: 5, abstention: 2, nonvotant: 1 },
    adopte: false,
    urlOfficielle: 'https://www.assemblee-nationale.fr/dyn/17/scrutins/110',
    /** Dans l'ordre attendu : taille décroissante, puis abrégé croissant. */
    groupes: [
      { id: 'RN', position: 'pour', compte: { pour: 3, contre: 0, abstention: 1, nonvotant: 0 } },
      { id: 'LFI-NFP', position: 'contre', compte: { pour: 0, contre: 2, abstention: 0, nonvotant: 1 } },
      { id: 'SOC', position: 'contre', compte: { pour: 0, contre: 3, abstention: 0, nonvotant: 0 } },
      { id: 'NI', position: 'partage', compte: { pour: 1, contre: 0, abstention: 1, nonvotant: 0 } },
    ],
  },
  /** Scrutin 102 (pair) : RN pour (4), SOC contre (3), LFI abstention (3, car 102 % 3 = 0), julie pour. */
  scrutin102: {
    compte: { pour: 5, contre: 3, abstention: 3, nonvotant: 0 },
    adopte: true,
  },
  /** 12 votes finaux + 3 textes sans collision = 14 cartes (95 remplace 90 ; 98 n'a pas de dossier ; 115 n'est pas final). */
  accueil: {
    page1: [111, 110, 109, 108, 107, 106, 105, 104, 103, 102],
    page2: [101, 100, 98, 95],
  },
  dossier2000: { voteFinal: 95, lectures: [90], titreCourt: 'Proposition de loi visant à protéger les abeilles', lecture: 'nouvelle lecture' },
  dossier1110: { voteFinal: 110, autresScrutins: [114, 113, 112], types: { 112: 'amendement', 113: 'article', 114: 'amendement' } },
  loisRecentes: 13, // 12 dossiers DLR5L17N11xx + DLR5L17N2000
  deputeDavid: {
    slug: 'david-moreau',
    photo: /^https:\/\/www\.assemblee-nationale\.fr\/dyn\/static\/tribun\/17\/photos\/carre\/\d+\.jpg$/,
    participation: 0.93,
    loyaute: 0.88,
    sur110: { position: 'abstention', positionGroupe: 'pour', adopte: false },
  },
  deputeSansDatan: 'gaelle-michel',
  /** Joint malgré la casse et les accents. */
  deputeJointureAccents: { slug: 'elodie-roux', participation: 0.9 },
};

/** Lignes brutes d'une ressource, pour les assertions « calculées » des specs. */
export function votesDe(slug) {
  return VOTES.filter((v) => v.deputy_slug === slug);
}

export function tables() {
  return [
    { rid: RIDS.scrutins, lignes: SCRUTINS },
    { rid: RIDS.votes, lignes: VOTES },
    { rid: RIDS.deputes, lignes: DEPUTES },
    { rid: RIDS.datanDeputes, lignes: DATAN },
  ];
}

/** Faux serveur prêt à l'emploi sur l'univers. */
export function creerUnivers(options = {}) {
  return creerFauxTabulaire(tables(), { base: BASE_FAUSSE, ...options });
}
