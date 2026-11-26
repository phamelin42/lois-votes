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
 * @property {string | null} seance `seanceRef` : la séance du scrutin, comparée au `reunionRef` d'une décision
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
 * @property {string | null} priseFonction `mandature.datePriseFonction` : le jour où le député entre vraiment en fonction. Pour un député élu, c'est le lendemain de `debut` ; pour un remplaçant (nommé au gouvernement, démissionnaire, décédé…), `debut` est la date de l'élection générale et `priseFonction` celle de son arrivée (voir DONNEES.md, « Effectif en mandat »).
 * @property {string | null} organe `organes.organeRef`
 * @property {string | null} qualite `infosQualite` (version accordée au genre quand elle existe) : « Membre », « Vice-présidente de l'Assemblée nationale ».
 * @property {{ departement: string | null, numDepartement: string | null, numCirco: string | null } | null} lieu Circonscription d'un mandat `ASSEMBLEE`.
 *
 * @typedef {{ siteWeb: string | null, x: string | null, facebook: string | null }} LiensWeb
 *
 * @typedef {object} ActeurLu
 * @property {string} pa
 * @property {string} prenom
 * @property {string} nom
 * @property {{ date: string, lieu: string | null } | null} naissance `AAAA-MM-JJ` et lieu (« Beauvais », « Alger (Algérie) »).
 * @property {string | null} deces `AAAA-MM-JJ`
 * @property {string | null} profession Libellé courant, sans le préfixe de code INSEE.
 * @property {string | null} hatvp Page nominative de la HATVP, seulement quand l'archive en donne une valide.
 * @property {LiensWeb} liens Site, X et Facebook déclarés, seulement quand l'extraction est fiable.
 * @property {MandatLu[]} mandats
 *
 * @typedef {object} DecisionLue Décision de séance de l'Assemblée sur un texte (`Decision_Type`).
 * @property {string} date `AAAA-MM-JJ`
 * @property {string} lecture « première lecture », « nouvelle lecture », « texte de la commission mixte paritaire »…
 * @property {string} statut `statutConclusion.libelle` : « adopté », « rejetée », « considéré comme adopté … 49, alinéa 3 … »
 * @property {string | null} seance `reunionRef`
 * @property {number[]} scrutins Numéros des scrutins de la 17ᵉ législature cités (`voteRefs`).
 * @property {string[]} textes Documents associés (`textesAssocies`), dont le texte adopté.
 *
 * @typedef {object} DossierLu
 * @property {string} uid
 * @property {string | null} titre `titreDossier.titre`
 * @property {string | null} procedure `procedureParlementaire.libelle`
 * @property {boolean} estLoi Projet ou proposition de loi, ou ratification ; pas une résolution.
 * @property {DecisionLue[]} decisions Dans l'ordre de l'archive.
 * @property {number[]} motions Scrutins des motions de censure (`DecisionMotionCensure_Type`).
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
    seance: typeof scrutin.seanceRef === 'string' ? scrutin.seanceRef : null,
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
 * Texte d'un champ de l'archive : une chaîne non vide, ou `null`. Un champ vide n'est pas `null` dans l'archive mais
 * un objet `{ "@xsi:nil": "true" }` (ou `null`) : tout ce qui n'est pas du texte est donc ignoré.
 */
export function chaine(valeur) {
  const brut = typeof valeur === 'object' && valeur !== null ? valeur['#text'] : valeur;
  if (typeof brut !== 'string') return null;
  const texte = brut.trim();
  return texte === '' ? null : texte;
}

/** Date `AAAA-MM-JJ` qui existe au calendrier, sinon `null`. */
export function dateIso(valeur) {
  const texte = chaine(valeur);
  if (!texte || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return null;
  const date = new Date(`${texte}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(texte) ? texte : null;
}

/**
 * Naissance d'un acteur (`etatCivil.infoNaissance`) : la date, et le lieu quand la ville est connue (suivie du pays
 * entre parenthèses s'il n'est pas la France). `null` sans date valide.
 * @param {any} etatCivil
 * @returns {{ date: string, lieu: string | null } | null}
 */
export function lireNaissance(etatCivil) {
  const info = etatCivil?.infoNaissance;
  const date = dateIso(info?.dateNais);
  if (!date) return null;
  const ville = chaine(info?.villeNais);
  const pays = chaine(info?.paysNais);
  return { date, lieu: ville ? (pays && pays !== 'France' ? `${ville} (${pays})` : ville) : null };
}

/** Profession courante, sans le code INSEE que l'archive met parfois devant (« (33) - Cadre de la fonction publique »). */
export function lireProfession(profession) {
  const libelle = chaine(profession?.libelleCourant)
    ?.replace(/^\(\d+\)\s*-\s*/, '')
    .trim();
  return libelle || null;
}

/** Le nom d'une page de la HATVP : des mots en minuscules sans accent, séparés par des tirets (« chenu-sebastien », « martin-alexandra-26044 »). */
const MOTIF_HATVP = /^https:\/\/www\.hatvp\.fr\/pages_nominatives\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Page nominative de la HATVP : uniquement une adresse de ce site, de la forme que le site lui-même produit, jamais
 * une adresse reconstruite. Sur les 568 adresses de l'archive du 19/10/2026, 565 ont cette forme ; les trois autres
 * (deux noms avec des parenthèses, « martin-(gironde)-alexandra-26044 », et un accent, « echaniz-iñaki-24343 »)
 * répondent 404 sur le site de la HATVP : on ne publie pas un lien qu'on sait mort.
 */
export function lireHatvp(uri) {
  const adresse = chaine(uri);
  return adresse && MOTIF_HATVP.test(adresse) ? adresse : null;
}

/** Compte X : un identifiant (« @sebchenu », « sebchenu ») ou une adresse de x.com ou twitter.com. */
export function lireX(valeur) {
  const texte = chaine(valeur);
  if (!texte) return null;
  const adresse = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([^/?#]+)\/?$/i.exec(texte);
  const compte = (adresse ? adresse[1] : texte).replace(/^@/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(compte) ? `https://x.com/${compte}` : null;
}

/** Page Facebook : un nom de page (« nicolas.forissier ») ou `people/<nom>/<numéro>`, nu ou dans une adresse facebook.com. */
export function lireFacebook(valeur) {
  const texte = chaine(valeur);
  if (!texte) return null;
  const adresse = /^https?:\/\/(?:www\.|m\.|fr-fr\.)?facebook\.com\/([^?#]+?)\/?(?:[?#].*)?$/i.exec(
    texte,
  );
  const chemin = (adresse ? adresse[1] : texte).replace(/^\/+/, '');
  const nom = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{3,78})[A-Za-z0-9]$/.test(chemin);
  const personne = /^people\/[A-Za-z0-9%_-]+\/\d{6,20}$/.test(chemin);
  return nom || personne ? `https://www.facebook.com/${chemin}` : null;
}

/**
 * Site web déclaré : une adresse https valide, ou un nom de domaine nu (« www.darmanin.fr », « jerome-guedj.fr/ »,
 * parfois précédé d'une barre oblique) auquel on ajoute `https://`. Rien d'autre : pas d'adresse avec identifiants,
 * pas de port, pas de texte libre, pas de domaine sans point.
 */
export function lireSiteWeb(valeur) {
  const texte = chaine(valeur);
  if (!texte) return null;
  const nu = texte.replace(/^\/+/, '');
  const adresse = /^https:\/\//i.test(nu)
    ? nu
    : /^[a-z0-9]/i.test(nu) && !/^[a-z]+:/i.test(nu)
      ? `https://${nu}`
      : null;
  if (!adresse || /\s/.test(adresse)) return null;
  let url;
  try {
    url = new URL(adresse);
  } catch {
    return null;
  }
  const domaine = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  return domaine.test(url.hostname) ? url.href : null;
}

/**
 * Les seules adresses publiées : site internet, X (Twitter) et Facebook. Téléphone, e-mail, adresse postale et
 * autres réseaux ne sont jamais lus. Si une même rubrique apparaît plusieurs fois, la première valide est retenue.
 * @param {any} adresses `acteur.adresses`
 * @returns {LiensWeb}
 */
export function lireLiensWeb(adresses) {
  /** @type {LiensWeb} */
  const liens = { siteWeb: null, x: null, facebook: null };
  for (const adresse of liste(adresses?.adresse)) {
    const valeur = adresse.valElec;
    if (adresse.typeLibelle === 'Site internet') liens.siteWeb ??= lireSiteWeb(valeur);
    else if (adresse.typeLibelle === 'Twitter') liens.x ??= lireX(valeur);
    else if (adresse.typeLibelle === 'Facebook') liens.facebook ??= lireFacebook(valeur);
  }
  return liens;
}

/**
 * Un acteur brut (`{ acteur: … }`) en objet interne : identité, état civil, profession, liens et mandats.
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
      priseFonction: dateIso(mandat.mandature?.datePriseFonction),
      organe: texte(mandat.organes?.organeRef),
      qualite:
        chaine(mandat.infosQualite?.libQualiteSex) ?? chaine(mandat.infosQualite?.libQualite),
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
    naissance: lireNaissance(acteur.etatCivil),
    deces: dateIso(acteur.etatCivil?.dateDeces),
    profession: lireProfession(acteur.profession),
    hatvp: lireHatvp(acteur.uri_hatvp),
    liens: lireLiensWeb(acteur.adresses),
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

/** Lecture d'une décision de séance d'après le début de son `codeActe` ; les autres codes ne sont pas des séances de l'Assemblée. */
const LECTURES = [
  [/^AN1-DEBATS-DEC$/, 'première lecture'],
  [/^AN2-DEBATS-DEC$/, 'deuxième lecture'],
  [/^AN3-DEBATS-DEC$/, 'troisième lecture'],
  [/^ANNLEC-DEBATS-DEC$/, 'nouvelle lecture'],
  [/^ANLDEF-DEBATS-DEC$/, 'lecture définitive'],
  [/^ANLUNI-DEBATS-DEC$/, 'lecture unique'],
  [/^CMP-DEBATS-AN-DEC$/, 'texte de la commission mixte paritaire'],
];

/** Numéros des scrutins de la 17ᵉ législature cités par `voteRefs` (une chaîne ou une liste). */
function scrutinsCites(voteRefs) {
  return liste(voteRefs?.voteRef)
    .map((ref) => /^VTANR5L17V(\d+)$/.exec(String(ref))?.[1])
    .filter((n) => n !== undefined)
    .map(Number);
}

/** Tous les actes d'un dossier, en profondeur et dans l'ordre de l'archive. */
function* actes(conteneur) {
  for (const acte of liste(conteneur?.acteLegislatif)) {
    yield acte;
    yield* actes(acte.actesLegislatifs);
  }
}

/**
 * Un dossier législatif (`dossierParlementaire`) : ses décisions de séance à l'Assemblée et les scrutins qu'il cite.
 * @param {any} brut
 * @returns {DossierLu}
 */
export function lireDossier(brut) {
  const dossier = brut?.dossierParlementaire;
  if (!dossier) throw new Error('dossier illisible : clé « dossierParlementaire » absente');
  if (typeof dossier.uid !== 'string' || !/^DL[A-Z0-9]+$/.test(dossier.uid))
    throw new Error(`identifiant de dossier invalide : ${JSON.stringify(dossier.uid)}`);
  const procedure = chaine(dossier.procedureParlementaire?.libelle);
  const decisions = [];
  const motions = [];
  for (const acte of actes(dossier.actesLegislatifs)) {
    if (acte['@xsi:type'] === 'DecisionMotionCensure_Type') {
      motions.push(...scrutinsCites(acte.voteRefs));
      continue;
    }
    if (acte['@xsi:type'] !== 'Decision_Type') continue;
    const lecture = LECTURES.find(([code]) => code.test(String(acte.codeActe)))?.[1];
    // « 2025-11-21T00:00:00.000+01:00 » : les dix premiers caractères sont le jour à Paris.
    const date = dateIso(typeof acte.dateActe === 'string' ? acte.dateActe.slice(0, 10) : null);
    if (!lecture || !date) continue;
    decisions.push({
      date,
      lecture,
      statut: chaine(acte.statutConclusion?.libelle) ?? '',
      seance: chaine(acte.reunionRef),
      scrutins: scrutinsCites(acte.voteRefs),
      textes: liste(acte.textesAssocies?.texteAssocie)
        .map((t) => chaine(t?.refTexteAssocie))
        .filter((t) => t !== null),
    });
  }
  return {
    uid: dossier.uid,
    titre: chaine(dossier.titreDossier?.titre),
    procedure,
    // « Projet ou proposition de loi … », « … de loi de finances … », ratification des traités ; pas les résolutions.
    estLoi: procedure !== null && /\bloi\b|ratification/i.test(procedure),
    decisions,
    motions,
  };
}

/**
 * Un document (texte déposé ou adopté) : seulement son titre principal, pour nommer un texte qui n'a pas de scrutin.
 * @param {any} brut
 * @returns {{ uid: string, titre: string | null }}
 */
export function lireDocument(brut) {
  const document = brut?.document;
  if (!document || typeof document.uid !== 'string')
    throw new Error('document illisible : identifiant absent');
  return { uid: document.uid, titre: chaine(document.titres?.titrePrincipal) };
}
