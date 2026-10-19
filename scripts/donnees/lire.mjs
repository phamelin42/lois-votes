// Lecture des fichiers bruts des archives officielles : fonctions pures qui les transforment en objets internes.
// Le format de l'Assemblée vient d'un export XML : un élément répété n'est un tableau que s'il apparaît plusieurs
// fois (un seul `votant` donne un objet), un élément vide vaut `null`, et un nombre est une chaîne.

/**
 * @typedef {{ pour: number, contre: number, abstention: number, nonvotant: number }} Compte
 * @typedef {'pour' | 'contre' | 'abstention' | 'nonvotant'} Position
 *
 * @typedef {object} GroupeDuScrutin
 * @property {string} organeRef Identifiant de l'organe du groupe (« PO0 » quand l'archive ne le renseigne pas).
 * @property {number} nombreMembres
 * @property {Position | null} positionOfficielle `positionMajoritaire` de l'archive (non utilisée pour les données : voir DONNEES.md).
 * @property {Compte} compte `decompteVoix`
 * @property {Record<Position, string[]>} votants Numéros d'acteur (`PA…`) par position.
 *
 * @typedef {object} ScrutinLu
 * @property {number} numero
 * @property {string} date `AAAA-MM-JJ`
 * @property {string} titre
 * @property {string | null} codeTypeVote `SPO`, `SPS` ou `MOC`
 * @property {string | null} sortCode `adopté` ou `rejeté`
 * @property {string | null} dossier `dossierRef`, ou `null`
 * @property {Compte} compte `syntheseVote.decompte`
 * @property {boolean} miseAuPoint La section `miseAuPoint` contient au moins un député.
 * @property {GroupeDuScrutin[]} groupes
 *
 * @typedef {object} MandatLu
 * @property {string} uid
 * @property {string} type `typeOrgane` : `GP`, `ASSEMBLEE`…
 * @property {string} legislature
 * @property {string} debut
 * @property {string | null} fin
 * @property {string | null} organe `organes.organeRef`
 * @property {{ departement: string | null, numDepartement: string | null, numCirco: string | null } | null} lieu Circonscription d'un mandat `ASSEMBLEE`.
 *
 * @typedef {object} ActeurLu
 * @property {string} pa
 * @property {string} prenom
 * @property {string} nom
 * @property {MandatLu[]} mandats
 *
 * @typedef {object} OrganeLu
 * @property {string} id
 * @property {string} codeType
 * @property {string | null} legislature
 * @property {string} abrege
 * @property {string} libelle
 * @property {string | null} couleur
 * @property {string | null} debut
 * @property {string | null} fin
 * @property {number} preseance
 */

/** Une liste XML : absente (`null`), réduite à son seul élément (objet) ou complète (tableau). Les `null` sont écartés. */
export function liste(valeur) {
  if (valeur == null) return [];
  return (Array.isArray(valeur) ? valeur : [valeur]).filter((element) => element != null);
}

/** Entier d'une chaîne XML ; 0 quand la valeur est absente. */
export function entier(valeur) {
  if (valeur == null || valeur === '') return 0;
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre)) throw new Error(`entier attendu, reçu ${JSON.stringify(valeur)}`);
  return nombre;
}

/** @returns {Compte} */
function lireDecompte(decompte) {
  return {
    pour: entier(decompte?.pour),
    contre: entier(decompte?.contre),
    abstention: entier(decompte?.abstentions),
    nonvotant: entier(decompte?.nonVotants),
  };
}

const LISTES_NOMINATIVES = /** @type {const} */ ([
  ['pours', 'pour'],
  ['contres', 'contre'],
  ['abstentions', 'abstention'],
  ['nonVotants', 'nonvotant'],
]);

/** Position d'un libellé de l'archive (« pour », « Contre », « abstentions »…), ou `null`. */
export function lirePosition(texte) {
  if (typeof texte !== 'string') return null;
  const minuscules = texte.trim().toLowerCase();
  if (minuscules.startsWith('pour')) return 'pour';
  if (minuscules.startsWith('contre')) return 'contre';
  if (minuscules.startsWith('abstention')) return 'abstention';
  if (minuscules.startsWith('non')) return 'nonvotant';
  return null;
}

/** Un acteur n'est plus que son numéro : `acteurRef` de chaque `votant`. */
function lireVotants(nominatif) {
  /** @type {Record<Position, string[]>} */
  const votants = { pour: [], contre: [], abstention: [], nonvotant: [] };
  for (const [cle, position] of LISTES_NOMINATIVES) {
    for (const votant of liste(nominatif?.[cle]?.votant)) {
      if (typeof votant.acteurRef !== 'string')
        throw new Error(`votant sans acteurRef dans « ${cle} »`);
      votants[position].push(votant.acteurRef);
    }
  }
  return votants;
}

const CLES_MISE_AU_POINT = [
  'nonVotants',
  'pours',
  'contres',
  'abstentions',
  'nonVotantsVolontaires',
];
const CLES_DYSFONCTIONNEMENT = [
  'nonVotants',
  'pour',
  'contre',
  'abstentions',
  'nonVotantsVolontaires',
];

/**
 * La section `miseAuPoint` contient-elle un député ? Ses listes sont des tableaux de `null` quand elle est vide ;
 * le sous-élément `dysfonctionnement` (boîtier défaillant) compte aussi : c'est une correction du même ordre.
 */
function aUneMiseAuPoint(miseAuPoint) {
  if (miseAuPoint == null) return false;
  const dysfonctionnement = miseAuPoint.dysfonctionnement;
  return (
    CLES_MISE_AU_POINT.some((cle) => liste(miseAuPoint[cle]).length > 0) ||
    (dysfonctionnement != null &&
      CLES_DYSFONCTIONNEMENT.some((cle) => liste(dysfonctionnement[cle]).length > 0))
  );
}

/**
 * Un scrutin brut (`{ scrutin: … }`) en objet interne.
 * @param {any} brut
 * @returns {ScrutinLu}
 */
export function lireScrutin(brut) {
  const scrutin = brut?.scrutin;
  if (!scrutin) throw new Error('scrutin illisible : clé « scrutin » absente');
  const numero = Number(scrutin.numero);
  if (!Number.isInteger(numero) || numero < 1)
    throw new Error(`numéro de scrutin invalide : ${JSON.stringify(scrutin.numero)}`);
  const date = scrutin.dateScrutin;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`scrutin ${numero} : date invalide ${JSON.stringify(date)}`);
  }

  const groupes = liste(scrutin.ventilationVotes?.organe?.groupes?.groupe).map((groupe) => {
    const vote = groupe.vote ?? {};
    return {
      organeRef: String(groupe.organeRef),
      nombreMembres: entier(groupe.nombreMembresGroupe),
      positionOfficielle: lirePosition(vote.positionMajoritaire),
      compte: lireDecompte(vote.decompteVoix),
      votants: lireVotants(vote.decompteNominatif),
    };
  });

  return {
    numero,
    date,
    titre: typeof scrutin.titre === 'string' ? scrutin.titre : '',
    codeTypeVote: scrutin.typeVote?.codeTypeVote ?? null,
    sortCode: scrutin.sort?.code ?? null,
    dossier: scrutin.objet?.dossierLegislatif?.dossierRef ?? null,
    compte: lireDecompte(scrutin.syntheseVote?.decompte),
    miseAuPoint: aUneMiseAuPoint(scrutin.miseAuPoint),
    groupes,
  };
}

/** Texte d'un élément XML qui porte des attributs : `{ '@xsi:type': …, '#text': 'PA720468' }` ou simplement la chaîne. */
function texte(valeur) {
  if (valeur == null) return null;
  if (typeof valeur === 'string') return valeur;
  return typeof valeur['#text'] === 'string' ? valeur['#text'] : null;
}

/**
 * Un acteur brut (`{ acteur: … }`) en objet interne : identité et mandats.
 * @param {any} brut
 * @returns {ActeurLu}
 */
export function lireActeur(brut) {
  const acteur = brut?.acteur;
  if (!acteur) throw new Error('acteur illisible : clé « acteur » absente');
  const pa = texte(acteur.uid);
  if (!pa) throw new Error('acteur sans identifiant');
  const identite = acteur.etatCivil?.ident ?? {};
  const mandats = liste(acteur.mandats?.mandat).map((mandat) => {
    const lieu = mandat.election?.lieu;
    return {
      uid: String(mandat.uid),
      type: String(mandat.typeOrgane),
      legislature: String(mandat.legislature),
      debut: mandat.dateDebut ?? '',
      fin: mandat.dateFin ?? null,
      organe: texte(mandat.organes?.organeRef),
      lieu: lieu
        ? {
            departement: lieu.departement ?? null,
            numDepartement: lieu.numDepartement ?? null,
            numCirco: lieu.numCirco ?? null,
          }
        : null,
    };
  });
  return {
    pa,
    prenom: String(identite.prenom ?? '').trim(),
    nom: String(identite.nom ?? '').trim(),
    mandats,
  };
}

/**
 * Un organe brut (`{ organe: … }`) en objet interne.
 * @param {any} brut
 * @returns {OrganeLu}
 */
export function lireOrgane(brut) {
  const organe = brut?.organe;
  if (!organe) throw new Error('organe illisible : clé « organe » absente');
  return {
    id: String(organe.uid),
    codeType: String(organe.codeType),
    legislature: organe.legislature ?? null,
    abrege: String(organe.libelleAbrege ?? organe.libelleAbrev ?? organe.libelle ?? '').trim(),
    libelle: String(organe.libelle ?? '').trim(),
    couleur: organe.couleurAssociee ?? null,
    debut: organe.viMoDe?.dateDebut ?? null,
    fin: organe.viMoDe?.dateFin ?? null,
    preseance: Number(organe.preseance) || 999,
  };
}
