import type {
  Accueil,
  DeputeDetail,
  DeputeIndex,
  DeputeListe,
  DeputeMini,
  Groupe,
  LoiCarte,
  LoiDetail,
  Position,
  ScrutinDetail,
  ScrutinResume,
  VoteDepute,
  VoteGroupe,
} from '@contrat';
import { lecture, titreCourt } from './classify';
import type { DonneesChargees } from './donnees';

/** Les données de chaque route, déjà agrégées à partir de `data/`. `null` quand l'objet demandé n'existe pas. */
export interface Agregation {
  accueil(page: number): Accueil;
  loi(dossier: string): LoiDetail | null;
  scrutin(numero: number): ScrutinDetail | null;
  deputes(): DeputeListe;
  depute(slug: string): DeputeDetail | null;
}

const TAILLE_PAGE_ACCUEIL = 10;
const NB_DERNIERS_VOTES = 10;
/** Réponses gardées en mémoire (les plus récemment demandées) : la mémoire ne grandit pas avec les visites. */
const TAILLE_MEMO = { accueil: 50, loi: 150, scrutin: 150, depute: 700 };

const URL_SCRUTIN = (numero: number) =>
  `https://www.assemblee-nationale.fr/dyn/17/scrutins/${numero}`;
const URL_FICHE = (pa: string) => `https://www.assemblee-nationale.fr/dyn/deputes/${pa}`;
/** Le fichier de la photo porte le numéro sans le préfixe « PA » (avec : 404). */
const URL_PHOTO = (pa: string) =>
  `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/${pa.replace(/^PA/, '')}.jpg`;

const POSITIONS: readonly Position[] = ['pour', 'contre', 'abstention', 'nonvotant'];
const POSITION_DE_CASE: Record<string, Position | undefined> = {
  P: 'pour',
  C: 'contre',
  A: 'abstention',
  N: 'nonvotant',
};

/** Mémoïsation bornée : la clé la moins récemment demandée sort la première. */
function memoiser<K, V>(taille: number, calculer: (cle: K) => V): (cle: K) => V {
  const valeurs = new Map<K, V>();
  return (cle) => {
    if (valeurs.has(cle)) {
      const valeur = valeurs.get(cle) as V;
      valeurs.delete(cle);
      valeurs.set(cle, valeur);
      return valeur;
    }
    const valeur = calculer(cle);
    valeurs.set(cle, valeur);
    if (valeurs.size > taille) valeurs.delete(valeurs.keys().next().value as K);
    return valeur;
  };
}

/** Nom du texte quand un dossier n'a pas (encore) de vote sur l'ensemble : « … du projet de loi X » donne « Projet de loi X ». */
const TEXTE_DE_LOI = /\b(?:du|de la)\s+(?:projet|proposition) de loi\b.*$/i;
function titreCourtDuTexte(titre: string): string {
  const texte = TEXTE_DE_LOI.exec(titre);
  return titreCourt(texte ? `l'ensemble ${texte[0]}` : titre);
}

export function creerAgregation(donnees: DonneesChargees): Agregation {
  const groupes: Groupe[] = donnees.groupes.map((g) => ({
    id: g.id,
    abrege: g.abrege,
    libelle: g.libelle,
    couleur: g.couleur,
  }));
  const estFinal = (s: number) => donnees.type(s) === 'final';

  function resume(s: number): ScrutinResume {
    return {
      numero: donnees.numero(s),
      date: donnees.date(s),
      titre: donnees.titre(s),
      type: donnees.type(s),
      adopte: donnees.adopte(s),
      compte: donnees.compte(s),
      urlOfficielle: URL_SCRUTIN(donnees.numero(s)),
    };
  }

  /**
   * Les groupes d'un scrutin, du plus nombreux au moins nombreux (puis dans l'ordre officiel des groupes).
   * Un groupe dont aucun député n'est listé (ni pour, ni contre, ni abstention, ni non-votant) n'est pas affiché :
   * une ligne à zéro « non-votant » laisserait croire que ses membres se sont tenus à l'écart du vote.
   */
  function votesDesGroupes(s: number): VoteGroupe[] {
    const taille = (c: VoteGroupe['compte']) => c.pour + c.contre + c.abstention + c.nonvotant;
    return donnees
      .groupesDuScrutin(s)
      .filter(({ compte }) => taille(compte) > 0)
      .sort((a, b) => taille(b.compte) - taille(a.compte) || a.g - b.g)
      .map(({ g, position, compte }) => ({ groupe: groupes[g], position, compte }));
  }

  /** Les votes sur l'ensemble d'un texte, du plus récent au plus ancien (calcul unique). */
  const finaux = donnees.ordreRecent.filter(estFinal);

  /** Une seule carte par texte : le vote final le plus récent de chaque dossier (sans dossier : chacun). */
  const finauxUniques = (() => {
    const vus = new Set<string>();
    return finaux.filter((s) => {
      const dossier = donnees.dossier(s);
      if (dossier === null) return true;
      if (vus.has(dossier)) return false;
      vus.add(dossier);
      return true;
    });
  })();

  /** Titre court d'un dossier : celui de son vote final le plus récent, sinon dérivé du texte cité par ses scrutins. */
  const titreDuDossier = memoiser(1000, (dossier: string): string => {
    const scrutins = donnees.parDossier.get(dossier) ?? [];
    const dernier = scrutins.find(estFinal);
    return dernier !== undefined
      ? titreCourt(donnees.titre(dernier))
      : titreCourtDuTexte(donnees.titre(scrutins[0]));
  });

  function carte(s: number): LoiCarte {
    return {
      dossier: donnees.dossier(s),
      titreCourt: titreCourt(donnees.titre(s)),
      titreOfficiel: donnees.titre(s),
      lecture: lecture(donnees.titre(s)),
      statut: null,
      voteFinal: resume(s),
      groupes: votesDesGroupes(s),
    };
  }

  const accueil = memoiser(TAILLE_MEMO.accueil, (page: number): Accueil => {
    const debut = (page - 1) * TAILLE_PAGE_ACCUEIL;
    return {
      lois: finauxUniques.slice(debut, debut + TAILLE_PAGE_ACCUEIL).map(carte),
      page,
      pageSuivante: debut + TAILLE_PAGE_ACCUEIL < finauxUniques.length,
      miseAJour: donnees.meta.genereLe,
    };
  });

  const loi = memoiser(TAILLE_MEMO.loi, (dossier: string): LoiDetail | null => {
    const scrutins = donnees.parDossier.get(dossier);
    if (!scrutins) return null;
    const votesFinaux = scrutins.filter(estFinal);
    const dernier: number | undefined = votesFinaux[0];
    return {
      dossier,
      titreCourt: titreDuDossier(dossier),
      titreOfficiel: donnees.titre(dernier ?? scrutins[0]),
      lecture: dernier !== undefined ? lecture(donnees.titre(dernier)) : null,
      statut: null,
      urlDossier: null,
      voteFinal:
        dernier !== undefined ? { ...resume(dernier), groupes: votesDesGroupes(dernier) } : null,
      lectures: votesFinaux.slice(1).map(resume),
      scrutins: scrutins.filter((s) => !estFinal(s)).map(resume),
    };
  });

  /** Députés par nom de famille, puis nom complet : l'ordre des listes nominatives et de l'annuaire. */
  const collateur = new Intl.Collator('fr');
  const ordreAlphabetique = donnees.deputes
    .map((_, d) => d)
    .sort(
      (a, b) =>
        collateur.compare(donnees.deputes[a].nomTri, donnees.deputes[b].nomTri) ||
        collateur.compare(donnees.deputes[a].nom, donnees.deputes[b].nom),
    );

  const scrutin = memoiser(TAILLE_MEMO.scrutin, (numero: number): ScrutinDetail | null => {
    const s = donnees.parNumero.get(numero);
    if (s === undefined) return null;

    // Qui a voté quoi : un bloc par groupe (celui du jour du vote) et par position, dans l'ordre des groupes.
    const blocs = new Map<string, DeputeMini[]>();
    for (const d of ordreAlphabetique) {
      const position = POSITION_DE_CASE[donnees.caseVote(s, d)];
      if (!position) continue; // absent (X) ou pas en mandat (-) : aucune liste ne le mentionne
      const g = donnees.groupeAuVote(s, d);
      const cle = `${g}|${position}`;
      const liste = blocs.get(cle) ?? [];
      liste.push({ slug: donnees.deputes[d].slug, nom: donnees.deputes[d].nom });
      blocs.set(cle, liste);
    }
    const nominatif: ScrutinDetail['nominatif'] = [];
    for (const { g } of donnees.groupesDuScrutin(s)) {
      for (const position of POSITIONS) {
        const deputes = blocs.get(`${g}|${position}`);
        if (deputes) nominatif.push({ groupeId: groupes[g].id, position, deputes });
      }
    }

    const dossier = donnees.dossier(s);
    return {
      ...resume(s),
      loi: dossier ? { dossier, titreCourt: titreDuDossier(dossier) } : null,
      groupes: votesDesGroupes(s),
      nominatif,
    };
  });

  function construireListeDeputes(): DeputeListe {
    const actifs = donnees.deputes.filter((d) => d.actif);
    const abregeDe = (id: string | null) => groupes.find((g) => g.id === id)?.abrege ?? null;
    const index: DeputeIndex[] = actifs.map((d) => ({
      slug: d.slug,
      nom: d.nom,
      nomTri: d.nomTri,
      groupe: abregeDe(d.groupe),
      departement: d.departement,
      circonscription: d.circonscription,
    }));
    index.sort((a, b) => collateur.compare(a.nomTri, b.nomTri) || collateur.compare(a.nom, b.nom));
    const idsActuels = new Set(actifs.map((d) => d.groupe));
    return {
      deputes: index,
      groupes: groupes
        .filter((g) => idsActuels.has(g.id))
        .sort((a, b) => collateur.compare(a.abrege, b.abrege) || (a.id < b.id ? -1 : 1)),
      loisRecentes: finauxUniques.flatMap((s) => {
        const dossier = donnees.dossier(s);
        return dossier
          ? [{ dossier, titreCourt: titreCourt(donnees.titre(s)), date: donnees.date(s) }]
          : [];
      }),
    };
  }
  let listeDeputes: DeputeListe | undefined;

  /**
   * Taux d'un député, calculés sur les scrutins où il était en mandat (case ≠ « - ») :
   * participation = (P + C + A) / (P + C + A + N + X) ; abstention = A / (P + C + A) ;
   * loyauté = votes égaux à la position de son groupe ce jour-là / votes exprimés (hors groupe « partagé »).
   */
  function taux(d: number): DeputeDetail['taux'] {
    let enMandat = 0;
    let exprimes = 0;
    let abstentions = 0;
    let comparables = 0;
    let alignes = 0;
    for (let s = 0; s < donnees.nbScrutins; s++) {
      const caseVote = donnees.caseVote(s, d);
      if (caseVote === '-') continue;
      enMandat++;
      if (caseVote !== 'P' && caseVote !== 'C' && caseVote !== 'A') continue;
      exprimes++;
      if (caseVote === 'A') abstentions++;
      const g = donnees.groupeAuVote(s, d);
      const positionGroupe = g >= 0 ? donnees.positionDuGroupe(s, g) : null;
      if (positionGroupe === null || positionGroupe === 'partage' || positionGroupe === 'nonvotant')
        continue;
      comparables++;
      if (positionGroupe === POSITION_DE_CASE[caseVote]) alignes++;
    }
    return {
      participation: enMandat > 0 ? exprimes / enMandat : null,
      abstention: exprimes > 0 ? abstentions / exprimes : null,
      loyaute: comparables > 0 ? alignes / comparables : null,
    };
  }

  /** Ses votes sur les 10 derniers votes finaux où il était en mandat. */
  function derniersVotes(d: number): VoteDepute[] {
    const votes: VoteDepute[] = [];
    for (const s of finaux) {
      if (votes.length === NB_DERNIERS_VOTES) break;
      const caseVote = donnees.caseVote(s, d);
      if (caseVote === '-') continue;
      const g = donnees.groupeAuVote(s, d);
      votes.push({
        loi: { dossier: donnees.dossier(s), titreCourt: titreCourt(donnees.titre(s)) },
        numero: donnees.numero(s),
        date: donnees.date(s),
        position: POSITION_DE_CASE[caseVote] ?? null,
        positionGroupe: g >= 0 ? donnees.positionDuGroupe(s, g) : null,
        adopte: donnees.adopte(s),
      });
    }
    return votes;
  }

  const depute = memoiser(TAILLE_MEMO.depute, (slug: string): DeputeDetail | null => {
    const d = donnees.parSlug.get(slug);
    if (d === undefined) return null;
    const fiche = donnees.deputes[d];
    return {
      slug,
      nom: fiche.nom,
      photo: URL_PHOTO(fiche.pa),
      groupe: groupes.find((g) => g.id === fiche.groupe) ?? null,
      circonscription: fiche.circonscription,
      urlFiche: URL_FICHE(fiche.pa),
      taux: taux(d),
      dernieresLois: derniersVotes(d),
    };
  });

  return {
    accueil,
    loi,
    scrutin,
    deputes: () => (listeDeputes ??= construireListeDeputes()),
    depute,
  };
}
