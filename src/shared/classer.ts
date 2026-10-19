import type { TypeScrutin } from '@contrat';

/*
 * Classement des scrutins d'après leur titre officiel. Module sans dépendance, partagé par le script
 * `scripts/donnees/` (qui l'exécute avec Node, donc rien d'autre que du TypeScript « effaçable » : pas
 * d'enum, pas d'import relatif) et par le serveur (`src/server/classify.ts` le réexporte).
 */

/** Code du type de vote d'un scrutin (`typeVote.codeTypeVote`) : SPO ordinaire, SPS solennel, MOC motion de censure. */
export type CodeTypeVote = string | null | undefined;

const APOSTROPHE = /[’']/g;

/**
 * Titre normalisé pour les expressions régulières : apostrophe droite, espaces simples (insécables
 * compris), point final retiré, et la faute « l'ensemble de de la » corrigée (relevée dans l'archive).
 */
export const normaliser = (titre: string): string =>
  titre
    .replace(APOSTROPHE, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '')
    .replace(/^(l'ensemble|l'article unique) de de /i, '$1 de ');

/** Un vote sur l'ensemble d'un texte : « l'ensemble du… », ou le texte sans préfixe (« la proposition de loi… »). */
const ENSEMBLE = /^(?:l'ensemble (?:du|de la)|le|la) (?:projet|proposition) de loi\b/i;
const ARTICLE_UNIQUE = /^l'article unique (?:du|de la) (?:projet|proposition) de loi\b/i;

const MOTIFS: [RegExp, TypeScrutin][] = [
  [/^l'amendement\b|^les amendements\b|^(le|les) sous-amendements?\b/i, 'amendement'],
  [/^la motion de censure\b/i, 'motion'],
  [ENSEMBLE, 'final'],
  [/^l'article\b/i, 'article'],
];

/**
 * Type d'un scrutin d'après son titre officiel et son type de vote. « l'article unique » reste un `article` ici :
 * il devient `final` quand le texte n'a pas d'autre vote (voir {@link classerTous}).
 */
export function classer(titre: string, typeVote?: CodeTypeVote): TypeScrutin {
  if (typeVote === 'MOC') return 'motion';
  const texte = normaliser(titre);
  return MOTIFS.find(([motif]) => motif.test(texte))?.[1] ?? 'autre';
}

/** Parenthèses de fin de titre qui décrivent la procédure et non le texte : lecture, CMP, article de la Constitution. */
const PROCEDURE = /lecture|commission mixte paritaire|^art(?:icle|\.)\s*[\d-]+.*constitution/i;
const PARENTHESE_FINALE = /\s*\(([^()]*)\)$/;

/** Sépare les parenthèses procédurales finales du reste du titre. */
function decouper(titre: string): { texte: string; parentheses: string[] } {
  let texte = normaliser(titre);
  const parentheses: string[] = [];
  for (
    let m = PARENTHESE_FINALE.exec(texte);
    m && PROCEDURE.test(m[1]);
    m = PARENTHESE_FINALE.exec(texte)
  ) {
    parentheses.push(m[1].trim());
    texte = texte.slice(0, m.index);
  }
  return { texte, parentheses };
}

const majuscule = (texte: string): string => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * « première lecture », « lecture définitive », « texte de la commission mixte paritaire » : l'étape de la
 * procédure quand le titre la précise en fin de phrase, sinon `null`.
 */
export function lecture(titre: string): string | null {
  return (
    decouper(titre).parentheses.find((p) => /lecture|commission mixte paritaire/i.test(p)) ?? null
  );
}

const PREFIXE_TEXTE =
  /^(?:l'ensemble|l'article unique) (?:du|de la) (?=(?:projet|proposition) de loi\b)|^(?:le|la) (?=(?:projet|proposition) de loi\b)/i;

/** « l'ensemble du projet de loi X (première lecture). » donne « Projet de loi X ». */
export function titreCourt(titre: string): string {
  return majuscule(decouper(titre).texte.replace(PREFIXE_TEXTE, ''));
}

/** Les trois ensembles d'un texte de loi, pour regrouper les votes d'un même texte (sans lecture, sans casse). */
function cleTexte(titre: string): string | null {
  const { texte, parentheses } = decouper(titre);
  const lect = parentheses.find((p) => /lecture|commission mixte paritaire/i.test(p)) ?? '';
  let nom: string | undefined;
  if (ENSEMBLE.test(texte) || ARTICLE_UNIQUE.test(texte)) {
    nom = texte.replace(PREFIXE_TEXTE, '');
  } else {
    nom = /^l'article\s.+?\s(?:du|de la|de l')\s+((?:projet|proposition) de loi\b.*)$/i.exec(
      texte,
    )?.[1];
  }
  return nom ? `${lect.toLowerCase()}|${nom.toLowerCase().slice(0, 120)}` : null;
}

export interface ScrutinATyper {
  titre: string;
  typeVote?: CodeTypeVote;
}

/**
 * Type de chaque scrutin d'une liste. En plus de {@link classer}, « l'article unique d'un projet ou d'une
 * proposition de loi » compte comme vote final quand le texte (même titre, même lecture) n'a ni vote sur l'ensemble
 * ni vote sur un autre article : le vote sur l'article unique est alors le vote sur le texte entier.
 * Les propositions de résolution ne sont pas des lois : leur article unique reste un article.
 */
export function classerTous(scrutins: ScrutinATyper[]): TypeScrutin[] {
  const types = scrutins.map((s) => classer(s.titre, s.typeVote));
  const occupes = new Set<string>();
  scrutins.forEach((s, i) => {
    const cle = cleTexte(s.titre);
    const autreVote =
      types[i] === 'final' ||
      (types[i] === 'article' && !/^l'article unique\b/i.test(normaliser(s.titre)));
    if (cle && autreVote) occupes.add(cle);
  });
  return types.map((type, i) => {
    if (type !== 'article' || !ARTICLE_UNIQUE.test(normaliser(scrutins[i].titre))) return type;
    const cle = cleTexte(scrutins[i].titre);
    return cle && !occupes.has(cle) ? 'final' : type;
  });
}
