// Dossiers législatifs : rattachement des scrutins à leur dossier, et textes adoptés sans vote nominatif (à main levée
// ou par l'article 49, alinéa 3). Fonctions pures, appelées par construire.mjs. Décisions et mesures : PLAN.md
// (« Textes adoptés sans vote nominatif ») et DONNEES.md (« dossiers.json »).

/** Premier jour de la 17ᵉ législature : les décisions d'avant appartiennent à la 16ᵉ. */
export const DEBUT_LEGISLATURE = '2024-07-18';

/**
 * Le dossier de chaque scrutin : celui que le scrutin indique, sinon le seul dossier de loi qui le cite (décision ou
 * motion de censure). Un scrutin que citent plusieurs dossiers de loi reste sans dossier : on ne choisit pas au hasard.
 * Les dossiers qui ne sont pas des lois (« Engagement de la responsabilité du Gouvernement… », résolutions) citent aussi
 * les motions de censure ; ils ne comptent pas.
 *
 * @param {{ numero: number, dossier: string | null }[]} scrutins
 * @param {import('./lire.mjs').DossierLu[]} dossiers
 */
export function rattacher(scrutins, dossiers) {
  /** @type {Map<number, Set<string>>} */
  const citeurs = new Map();
  for (const d of dossiers) {
    if (!d.estLoi) continue;
    for (const n of [...d.decisions.flatMap((x) => x.scrutins), ...d.motions]) {
      const deja = citeurs.get(n) ?? new Set();
      deja.add(d.uid);
      citeurs.set(n, deja);
    }
  }
  /** @type {Map<number, string | null>} */
  const dossierDe = new Map();
  let rattaches = 0;
  let ambigus = 0;
  for (const s of scrutins) {
    const cites = citeurs.get(s.numero);
    if (s.dossier !== null) dossierDe.set(s.numero, s.dossier);
    else if (cites?.size === 1) {
      dossierDe.set(s.numero, [...cites][0]);
      rattaches++;
    } else {
      dossierDe.set(s.numero, null);
      if (cites && cites.size > 1) ambigus++;
    }
  }
  return { dossierDe, rattaches, ambigus };
}

const NOMME_UN_TEXTE = /^(?:projet|proposition) de loi\b/i;
const ARTICLE_49_3 = /\barticle 49,? alinéa 3\b/i;
/** « adopté », « adoptée sans modification », « adoptée, dans les conditions prévues à l'article 45, alinéa 3… »
 * (texte de CMP), « modifiée » (adoptée avec des modifications), « considéré comme adopté … 49, alinéa 3 ». */
const ADOPTE = /^(?:adopt|modifi)|^considérée? comme adoptée?(?!\p{L})/iu;

/**
 * Comment l'Assemblée a adopté un texte sans vote nominatif, ou `null` : décision qui n'est pas une adoption, qui cite un
 * scrutin, ou dont la séance a un vote sur l'ensemble d'un texte qui pourrait être le sien (rattaché à aucun dossier ou
 * au même). L'archive des dossiers omet parfois la référence d'un scrutin qui existe : dans le doute, on ne dit pas
 * « à main levée ».
 *
 * @param {import('./lire.mjs').DecisionLue} decision
 * @param {{ dossier: string, scrutins: { numero: number, date: string, seance: string | null, final: boolean }[], dossierDe: Map<number, string | null> }} contexte
 * @returns {'mainLevee' | 'article49-3' | null}
 */
export function modeSansVote(decision, { dossier, scrutins, dossierDe }) {
  if (!ADOPTE.test(decision.statut)) return null;
  if (ARTICLE_49_3.test(decision.statut)) return 'article49-3';
  if (decision.scrutins.length) return null;
  const memeMoment = (s) =>
    decision.seance !== null ? s.seance === decision.seance : s.date === decision.date;
  const peutEtreLeSien = scrutins.some((s) => {
    if (!s.final || !memeMoment(s)) return false;
    const d = dossierDe.get(s.numero) ?? null;
    return d === null || d === dossier;
  });
  return peutEtreLeSien ? null : 'mainLevee';
}

/**
 * Les textes de loi que l'Assemblée a adoptés au moins une fois sans vote nominatif pendant la 17ᵉ législature, du plus
 * récent au plus ancien : identifiant, titre (celui du dossier s'il nomme le texte de loi, sinon celui du texte adopté le
 * plus récent, sinon celui du dossier) et ces
 * décisions, de la plus récente à la plus ancienne.
 *
 * @param {object} entree
 * @param {import('./lire.mjs').DossierLu[]} entree.dossiers
 * @param {Map<string, string | null>} entree.titres Titre principal de chaque document (`lireDocument`).
 * @param {{ numero: number, date: string, seance: string | null, final: boolean }[]} entree.scrutins
 * @param {Map<number, string | null>} entree.dossierDe Résultat de {@link rattacher}.
 */
export function textesSansVote({ dossiers, titres, scrutins, dossierDe }) {
  const textes = [];
  for (const d of dossiers) {
    if (!d.estLoi) continue;
    const decisions = d.decisions
      .filter((x) => x.date >= DEBUT_LEGISLATURE)
      .map((x) => ({ x, mode: modeSansVote(x, { dossier: d.uid, scrutins, dossierDe }) }))
      .filter(({ mode }) => mode !== null)
      .sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : 0));
    if (!decisions.length) continue;
    // Le titre du dossier quand il nomme le texte (« Projet de loi de finances pour 2026 » : le texte adopté, lui, s'intitule
    // « projet de loi de finances de finances pour 2026 ») ; sinon celui du texte adopté, car le dossier d'une proposition de
    // loi porte souvent un titre court à l'infinitif (« Rétablir le droit commun de la prescription… »).
    const titre =
      (d.titre && NOMME_UN_TEXTE.test(d.titre) ? d.titre : null) ??
      decisions[0].x.textes.map((t) => titres.get(t) ?? null).find((t) => t !== null) ??
      d.titre;
    textes.push({
      id: d.uid,
      titre,
      decisions: decisions.map(({ x, mode }) => ({ date: x.date, lecture: x.lecture, mode })),
    });
  }
  return textes.sort((a, b) =>
    a.decisions[0].date < b.decisions[0].date
      ? 1
      : a.decisions[0].date > b.decisions[0].date
        ? -1
        : a.id < b.id
          ? -1
          : 1,
  );
}
