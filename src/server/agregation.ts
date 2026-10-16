import type {
  Accueil,
  DeputeDetail,
  DeputeListe,
  DeputeMini,
  LoiCarte,
  LoiDetail,
  Position,
  ScrutinDetail,
  ScrutinResume,
  VoteDepute,
} from '@contrat';
import type { Cache } from './cache';
import {
  classer,
  estAdopte,
  lecture,
  tauxAbstention,
  titreCourt,
  ventilerParGroupe,
} from './classify';
import { creerIndexDeputes, type DeputeActif, type IndexDeputes } from './index-deputes';
import { GROUPE_NI } from './groupes';
import {
  COLONNES_SCRUTINS,
  COLONNES_VOTES,
  POSITION_SOURCE,
  type ScrutinSource,
  type VoteSource,
  identifiantScrutin,
  versScrutin,
  versVote,
} from './source/colonnes';
import type { Rids } from './source/ressources';
import type { Tabulaire } from './source/tabulaire';

export interface Dependances {
  tabulaire: Tabulaire;
  cache: Cache;
  rids: Rids;
  maintenant: () => number;
}

/** Les données de chaque route, déjà agrégées. null quand l'objet demandé n'existe pas. */
export interface Agregation {
  accueil(page: number): Promise<Accueil>;
  loi(dossier: string): Promise<LoiDetail | null>;
  scrutin(numero: number): Promise<ScrutinDetail | null>;
  deputes(): Promise<DeputeListe>;
  depute(slug: string): Promise<DeputeDetail | null>;
}

const TAILLE_PAGE_ACCUEIL = 10;
const NB_DERNIERS_VOTES = 10;
const URL_SCRUTIN = (numero: number) =>
  `https://www.assemblee-nationale.fr/dyn/17/scrutins/${numero}`;

// Durées du cache mémoire, en secondes. Les votes d'un scrutin ne changent pas : ils tiennent plus longtemps.
const CACHE = {
  finaux: { ttl: 1800, stale: 86400 },
  accueil: { ttl: 1800, stale: 86400 },
  loi: { ttl: 3600, stale: 86400 },
  scrutin: { ttl: 3600, stale: 86400 },
  depute: { ttl: 3600, stale: 86400 },
  deputes: { ttl: 21600, stale: 86400 },
  votes: { ttl: 86400, stale: 604800 },
};

const parDateDesc = (a: ScrutinSource, b: ScrutinSource) => Date.parse(b.date) - Date.parse(a.date);
const estFinal = (scrutin: ScrutinSource) => classer(scrutin.titre) === 'final';
const photoDe = (pa: string) =>
  `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/${pa.replace(/^PA/, '')}.jpg`;

export function creerAgregation({ tabulaire, cache, rids, maintenant }: Dependances): Agregation {
  const index = creerIndexDeputes({ tabulaire, cache, rids });

  /**
   * Tous les votes sur l'ensemble d'un texte, du plus récent au plus ancien, avec la date de leur chargement
   * (c'est la date des données affichée : elle reste juste quand on sert une valeur périmée).
   */
  const finaux = () =>
    cache.memo('finaux', CACHE.finaux.ttl, CACHE.finaux.stale, async () => {
      const lignes = await tabulaire.toutesLesLignes(rids.scrutins, {
        filtres: [{ colonne: COLONNES_SCRUTINS.titre, op: 'contains', valeur: "l'ensemble" }],
        tri: { colonne: COLONNES_SCRUTINS.date, ordre: 'desc' },
      });
      const scrutins = lignes.flatMap((ligne) => {
        const scrutin = versScrutin(ligne);
        return scrutin && estFinal(scrutin) ? [scrutin] : [];
      });
      return { scrutins, chargeLe: maintenant() };
    });

  /** Une seule carte par texte : le vote final le plus récent de chaque dossier (sans dossier : chacun). */
  async function finauxUniques(): Promise<{ scrutins: ScrutinSource[]; chargeLe: number }> {
    const { scrutins: tous, chargeLe } = await finaux();
    const vus = new Set<string>();
    const uniques: ScrutinSource[] = [];
    for (const scrutin of tous) {
      if (scrutin.dossier !== null) {
        if (vus.has(scrutin.dossier)) continue;
        vus.add(scrutin.dossier);
      }
      uniques.push(scrutin);
    }
    return { scrutins: uniques, chargeLe };
  }

  /** Votes de plusieurs scrutins, demandés par paquets `scrutin_id__in`, groupés par scrutin. */
  async function votesDes(ids: string[]): Promise<Map<string, VoteSource[]>> {
    const parScrutin = new Map<string, VoteSource[]>();
    if (ids.length === 0) return parScrutin;
    const votes = await cache.memo(
      `votes:${ids.join(',')}`,
      CACHE.votes.ttl,
      CACHE.votes.stale,
      async () => {
        const lignes = await tabulaire.toutesLesLignes(rids.votes, {
          filtres: [{ colonne: COLONNES_VOTES.scrutin, op: 'in', valeur: ids }],
        });
        return lignes.flatMap((ligne) => {
          const vote = versVote(ligne);
          return vote ? [vote] : [];
        });
      },
    );
    for (const vote of votes) {
      const liste = parScrutin.get(vote.scrutinId) ?? [];
      liste.push(vote);
      parScrutin.set(vote.scrutinId, liste);
    }
    return parScrutin;
  }

  const groupeDe = (idx: IndexDeputes) => (slug: string) =>
    idx.parSlug.get(slug)?.groupe ?? undefined;

  const loiMemo = (dossier: string) =>
    cache.memo(`loi:${dossier}`, CACHE.loi.ttl, CACHE.loi.stale, () => chargerLoi(dossier));

  function resume(scrutin: ScrutinSource): ScrutinResume {
    const type = classer(scrutin.titre);
    return {
      numero: scrutin.numero,
      date: scrutin.date,
      titre: scrutin.titre,
      type,
      adopte: estAdopte(type, scrutin.compte),
      compte: scrutin.compte,
      urlOfficielle: URL_SCRUTIN(scrutin.numero),
    };
  }

  function carte(scrutin: ScrutinSource, votes: VoteSource[], idx: IndexDeputes): LoiCarte {
    return {
      dossier: scrutin.dossier,
      titreCourt: titreCourt(scrutin.titre),
      titreOfficiel: scrutin.titre,
      lecture: lecture(scrutin.titre),
      statut: null,
      voteFinal: resume(scrutin),
      groupes: ventilerParGroupe(votes, groupeDe(idx)),
    };
  }

  async function chargerLoi(dossier: string): Promise<LoiDetail | null> {
    const lignes = await tabulaire.toutesLesLignes(rids.scrutins, {
      filtres: [{ colonne: COLONNES_SCRUTINS.dossier, op: 'exact', valeur: dossier }],
      tri: { colonne: COLONNES_SCRUTINS.date, ordre: 'desc' },
    });
    const scrutins = lignes.flatMap((ligne) => {
      const scrutin = versScrutin(ligne);
      return scrutin ? [scrutin] : [];
    });
    scrutins.sort(parDateDesc);
    if (scrutins.length === 0) return null;

    const votesFinaux = scrutins.filter(estFinal);
    const dernier: ScrutinSource | undefined = votesFinaux[0];
    const reference = dernier ?? scrutins[0];
    let voteFinal: LoiDetail['voteFinal'] = null;
    if (dernier) {
      const [votes, idx] = await Promise.all([votesDes([dernier.id]), index()]);
      voteFinal = {
        ...resume(dernier),
        groupes: ventilerParGroupe(votes.get(dernier.id) ?? [], groupeDe(idx)),
      };
    }
    return {
      dossier,
      titreCourt: titreCourt(reference.titre),
      titreOfficiel: reference.titre,
      lecture: dernier ? lecture(dernier.titre) : null,
      statut: null,
      urlDossier: null,
      voteFinal,
      lectures: votesFinaux.slice(1).map(resume),
      scrutins: scrutins.filter((scrutin) => !estFinal(scrutin)).map(resume),
    };
  }

  async function chargerScrutin(numero: number): Promise<ScrutinDetail | null> {
    const lignes = await tabulaire.toutesLesLignes(rids.scrutins, {
      filtres: [{ colonne: COLONNES_SCRUTINS.id, op: 'exact', valeur: identifiantScrutin(numero) }],
    });
    const scrutin: ScrutinSource | undefined = lignes.flatMap((ligne) => {
      const trouve = versScrutin(ligne);
      return trouve ? [trouve] : [];
    })[0];
    if (!scrutin) return null;

    const [votes, idx] = await Promise.all([
      votesDes([scrutin.id]).then((m) => m.get(scrutin.id) ?? []),
      index(),
    ]);
    const loiDuScrutin = scrutin.dossier ? await loiMemo(scrutin.dossier) : null;
    const nominatif = new Map<
      string,
      { groupeId: string; position: Position; deputes: DeputeMini[] }
    >();
    for (const vote of votes) {
      const groupeId = (groupeDe(idx)(vote.slug) ?? GROUPE_NI).id;
      const cle = `${groupeId}|${vote.position}`;
      const entree = nominatif.get(cle) ?? { groupeId, position: vote.position, deputes: [] };
      entree.deputes.push({ slug: vote.slug, nom: idx.parSlug.get(vote.slug)?.nom ?? vote.slug });
      nominatif.set(cle, entree);
    }
    return {
      ...resume(scrutin),
      loi: scrutin.dossier
        ? {
            dossier: scrutin.dossier,
            titreCourt: loiDuScrutin?.titreCourt ?? titreCourt(scrutin.titre),
          }
        : null,
      groupes: ventilerParGroupe(votes, groupeDe(idx)),
      nominatif: [...nominatif.values()],
    };
  }

  async function chargerDepute(slug: string): Promise<DeputeDetail | null> {
    const idx = await index();
    const depute: DeputeActif | undefined = idx.parSlug.get(slug);
    if (!depute) return null;

    const derniers = (await finauxUniques()).scrutins.slice(0, NB_DERNIERS_VOTES);
    const pourSlug = { colonne: COLONNES_VOTES.depute, op: 'exact' as const, valeur: slug };
    const [votes, suffrages, abstentions] = await Promise.all([
      votesDes(derniers.map((s) => s.id)),
      tabulaire.compter(rids.votes, {
        filtres: [
          pourSlug,
          {
            colonne: COLONNES_VOTES.position,
            op: 'in',
            valeur: [POSITION_SOURCE.pour, POSITION_SOURCE.contre, POSITION_SOURCE.abstention],
          },
        ],
      }),
      tabulaire.compter(rids.votes, {
        filtres: [
          pourSlug,
          { colonne: COLONNES_VOTES.position, op: 'exact', valeur: POSITION_SOURCE.abstention },
        ],
      }),
    ]);

    const groupeId = (depute.groupe ?? GROUPE_NI).id;
    const dernieresLois: VoteDepute[] = derniers.map((scrutin) => {
      const votesDuScrutin = votes.get(scrutin.id) ?? [];
      const sonVote = votesDuScrutin.find((vote) => vote.slug === slug);
      const positionGroupe =
        ventilerParGroupe(votesDuScrutin, groupeDe(idx)).find((g) => g.groupe.id === groupeId)
          ?.position ?? null;
      return {
        loi: { dossier: scrutin.dossier, titreCourt: titreCourt(scrutin.titre) },
        numero: scrutin.numero,
        date: scrutin.date,
        position: sonVote?.position ?? null,
        positionGroupe,
        adopte: estAdopte(classer(scrutin.titre), scrutin.compte),
      };
    });

    const photo = depute.datan ? photoDe(depute.datan.pa) : null;
    return {
      slug,
      nom: depute.nom,
      photo,
      groupe: depute.groupe ?? GROUPE_NI,
      circonscription: depute.circonscription,
      urlFiche: depute.datan
        ? `https://www.assemblee-nationale.fr/dyn/17/deputes/${depute.datan.pa}`
        : `https://nosparlementaires.fr/${slug}`,
      taux: {
        participation: depute.datan?.participation ?? null,
        abstention: tauxAbstention(abstentions, suffrages),
        loyaute: depute.datan?.loyaute ?? null,
      },
      dernieresLois,
    };
  }

  return {
    accueil: (page) =>
      cache.memo(`accueil:${page}`, CACHE.accueil.ttl, CACHE.accueil.stale, async () => {
        const { scrutins: liste, chargeLe } = await finauxUniques();
        const debut = (page - 1) * TAILLE_PAGE_ACCUEIL;
        const tranche = liste.slice(debut, debut + TAILLE_PAGE_ACCUEIL);
        const [votes, idx] = await Promise.all([votesDes(tranche.map((s) => s.id)), index()]);
        return {
          lois: tranche.map((scrutin) => carte(scrutin, votes.get(scrutin.id) ?? [], idx)),
          page,
          pageSuivante: debut + TAILLE_PAGE_ACCUEIL < liste.length,
          miseAJour: new Date(chargeLe).toISOString(),
        };
      }),

    loi: loiMemo,

    scrutin: (numero) =>
      cache.memo(`scrutin:${numero}`, CACHE.scrutin.ttl, CACHE.scrutin.stale, () =>
        chargerScrutin(numero),
      ),

    deputes: () =>
      cache.memo('deputes', CACHE.deputes.ttl, CACHE.deputes.stale, async () => {
        const idx = await index();
        const deputes = idx.deputes
          .map((d) => ({
            slug: d.slug,
            nom: d.nom,
            nomTri: d.nomTri,
            groupe: d.groupe?.abrege ?? null,
            departement: d.departement,
            circonscription: d.circonscription,
          }))
          .sort(
            (a, b) => a.nomTri.localeCompare(b.nomTri, 'fr') || a.nom.localeCompare(b.nom, 'fr'),
          );
        const groupes = new Map(
          idx.deputes.map((d) => [d.groupe?.id ?? GROUPE_NI.id, d.groupe ?? GROUPE_NI]),
        );
        const loisRecentes = (await finauxUniques()).scrutins.flatMap((scrutin) =>
          scrutin.dossier
            ? [
                {
                  dossier: scrutin.dossier,
                  titreCourt: titreCourt(scrutin.titre),
                  date: scrutin.date,
                },
              ]
            : [],
        );
        return {
          deputes,
          groupes: [...groupes.values()].sort((a, b) => a.abrege.localeCompare(b.abrege, 'fr')),
          loisRecentes,
        };
      }),

    depute: (slug) =>
      cache.memo(`depute:${slug}`, CACHE.depute.ttl, CACHE.depute.stale, () => chargerDepute(slug)),
  };
}
