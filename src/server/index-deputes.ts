import type { Groupe } from '@contrat';
import type { Cache } from './cache';
import { groupeParAbrege } from './groupes';
import { COLONNES_DEPUTES, type DatanDepute, versDatan, versDepute } from './source/colonnes';
import type { Rids } from './source/ressources';
import type { Tabulaire } from './source/tabulaire';

export interface DeputeActif {
  slug: string;
  /** Nom complet, « Élodie Roux ». */
  nom: string;
  /** Nom de famille, pour le tri. */
  nomTri: string;
  groupe: Groupe | null;
  departement: string | null;
  circonscription: string | null;
  /** Données Datan jointes ; null si la jointure échoue. */
  datan: DatanDepute | null;
}

export interface IndexDeputes {
  deputes: DeputeActif[];
  parSlug: Map<string, DeputeActif>;
}

const TTL_S = 21600; // 6 h
const STALE_S = 86400;

const normaliser = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\s-]+/g, ' ')
    .trim();

/** Clé de jointure NosParlementaires ↔ Datan : nom, prénom et département, sans casse ni accents. */
const cleDeJointure = (prenom: string, nom: string, departement: string | null): string =>
  `${normaliser(nom)}|${normaliser(prenom)}|${departement ?? ''}`;

/** Groupe officiel d'après son abrégé ; un abrégé inconnu garde le libellé de la source. */
function groupeDeLaSource(abrege: string | null, libelle: string | null): Groupe | null {
  if (!abrege) return null;
  return (
    groupeParAbrege(abrege) ?? { id: abrege, abrege, libelle: libelle ?? abrege, couleur: null }
  );
}

/** Index des députés actifs, joints à Datan. Mis en mémoire 6 h. */
export function creerIndexDeputes({
  tabulaire,
  cache,
  rids,
}: {
  tabulaire: Tabulaire;
  cache: Cache;
  rids: Rids;
}): () => Promise<IndexDeputes> {
  async function charger(): Promise<IndexDeputes> {
    const [lignesDeputes, lignesDatan] = await Promise.all([
      tabulaire.toutesLesLignes(rids.deputes, {
        filtres: [{ colonne: COLONNES_DEPUTES.actif, op: 'exact', valeur: true }],
      }),
      tabulaire.toutesLesLignes(rids.datanDeputes, {}),
    ]);

    const datan = new Map<string, DatanDepute>();
    for (const ligne of lignesDatan) {
      const depute = versDatan(ligne);
      if (!depute) continue;
      const cle = cleDeJointure(depute.prenom, depute.nom, depute.departement);
      if (!datan.has(cle)) datan.set(cle, depute);
    }

    const deputes: DeputeActif[] = [];
    for (const ligne of lignesDeputes) {
      const source = versDepute(ligne);
      if (!source) continue;
      deputes.push({
        slug: source.slug,
        nom: `${source.prenom} ${source.nom}`.trim(),
        nomTri: source.nom,
        groupe: groupeDeLaSource(source.groupeAbrege, source.groupeLibelle),
        departement: source.departement,
        circonscription: source.circonscription,
        datan: datan.get(cleDeJointure(source.prenom, source.nom, source.departement)) ?? null,
      });
    }
    return { deputes, parSlug: new Map(deputes.map((d) => [d.slug, d])) };
  }

  return () => cache.memo('index-deputes', TTL_S, STALE_S, charger);
}
