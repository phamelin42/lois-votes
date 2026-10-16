import type { Compte, Groupe, Position, TypeScrutin } from '@contrat';
import {
  classer,
  estAdopte,
  lecture,
  tauxAbstention,
  titreCourt,
  ventilerParGroupe,
} from './classify';

describe('classer', () => {
  const cas: [string, TypeScrutin][] = [
    // votes sur l'ensemble d'un texte
    ["l'ensemble du projet de loi de finances pour 2025 (nouvelle lecture)", 'final'],
    ["l'ensemble de la proposition de loi visant à renforcer la sécurité des élus locaux (première lecture)", 'final'],
    ["l'ensemble du projet de loi relatif à la simplification de la vie économique (lecture définitive)", 'final'],
    ["l'ensemble de la proposition de loi organique visant à garantir le pluralisme (première lecture)", 'final'],
    ["l'ensemble du projet de loi de financement de la sécurité sociale pour 2025 (nouvelle lecture)", 'final'],
    ["l'ensemble du projet de loi constitutionnelle portant sur la Nouvelle-Calédonie (première lecture)", 'final'],
    ["l'ensemble du projet de loi autorisant la ratification de l'accord entre la France et le Canada", 'final'],
    ['l’ensemble de la proposition de loi visant à protéger les abeilles (première lecture)', 'final'],
    ["L'ensemble du projet de loi relatif à la sobriété foncière (première lecture)", 'final'],
    // motions de censure
    ["la motion de censure déposée en application de l'article 49, alinéa 2, de la Constitution par Mme Mathilde Panot et plusieurs de ses collègues", 'motion'],
    ["la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par M. Éric Coquerel", 'motion'],
    // articles
    ["l'article 1er du projet de loi relatif à la sobriété foncière", 'article'],
    ["l'article 3 de la proposition de loi visant à protéger les abeilles", 'article'],
    ["l'article 12 bis du projet de loi de finances pour 2025", 'article'],
    ["l'article unique de la proposition de loi visant à rétablir la confiance", 'article'],
    ["l'article 2 du projet de loi, modifié par le Sénat", 'article'],
    // amendements (même quand le titre mentionne un article)
    ["l'amendement n° 1234 de M. Dupont à l'article 3 du projet de loi relatif à la sobriété foncière", 'amendement'],
    ["l'amendement n° 5 de suppression de l'article 2 de la proposition de loi", 'amendement'],
    ["l'amendement n° 7 de Mme Durand après l'article 4", 'amendement'],
    ["les amendements identiques n° 12 et 45 à l'article 6", 'amendement'],
    ["l'amendement n° 8 rectifié du Gouvernement", 'amendement'],
    ["le sous-amendement n° 33 de M. Martin à l'amendement n° 12 du Gouvernement", 'amendement'],
    ["les amendements n° 101, 102 et 103 après l'article 9", 'amendement'],
    // tout le reste
    ["l'ensemble des crédits de la mission « Défense »", 'autre'],
    ["l'ensemble des articles de la première partie du projet de loi de finances", 'autre'],
    ['la première partie du projet de loi de finances pour 2025', 'autre'],
    ['la déclaration de politique générale du Gouvernement', 'autre'],
    ["la motion de rejet préalable de la proposition de loi visant à protéger les abeilles", 'autre'],
    ["la motion référendaire déposée par M. Untel", 'autre'],
    ["l'exception d'irrecevabilité soulevée sur le projet de loi relatif à la sobriété foncière", 'autre'],
    ["la question préalable opposée au projet de loi de finances", 'autre'],
    ["le passage à la discussion des articles du projet de loi relatif aux jeux", 'autre'],
    ["la demande de constitution d'une commission d'enquête sur les moyens de l'État", 'autre'],
    ['', 'autre'],
  ];

  it.each(cas)('« %s » est %s', (titre, attendu) => {
    expect(classer(titre)).toBe(attendu);
  });

  it('couvre au moins 30 titres réalistes', () => {
    expect(cas.length).toBeGreaterThanOrEqual(30);
  });
});

describe('estAdopte', () => {
  const compte = (pour: number, contre: number, abstention = 0, nonvotant = 0): Compte => ({
    pour,
    contre,
    abstention,
    nonvotant,
  });

  it('adopte quand les pour dépassent les contre', () => {
    expect(estAdopte('final', compte(300, 200))).toBe(true);
    expect(estAdopte('amendement', compte(31, 30))).toBe(true);
    expect(estAdopte('article', compte(10, 4, 100))).toBe(true);
  });

  it("rejette à égalité ou quand les contre l'emportent", () => {
    expect(estAdopte('final', compte(200, 200))).toBe(false);
    expect(estAdopte('final', compte(100, 400))).toBe(false);
  });

  it("n'adopte pas un scrutin sans suffrage exprimé", () => {
    expect(estAdopte('autre', compte(0, 0, 12, 3))).toBe(false);
  });

  it('exige la majorité absolue (289) pour une motion de censure', () => {
    expect(estAdopte('motion', compte(288, 0))).toBe(false);
    expect(estAdopte('motion', compte(289, 100))).toBe(true);
    expect(estAdopte('motion', compte(191, 262))).toBe(false);
  });
});

describe('titreCourt et lecture', () => {
  const cas: [string, string, string | null][] = [
    [
      "l'ensemble du projet de loi relatif à la sobriété foncière (première lecture)",
      'Projet de loi relatif à la sobriété foncière',
      'première lecture',
    ],
    [
      "l'ensemble de la proposition de loi visant à protéger les abeilles (nouvelle lecture)",
      'Proposition de loi visant à protéger les abeilles',
      'nouvelle lecture',
    ],
    [
      "l'ensemble du projet de loi de finances pour 2025 (lecture définitive)",
      'Projet de loi de finances pour 2025',
      'lecture définitive',
    ],
    [
      "l'ensemble de la proposition de loi organique visant à garantir le pluralisme",
      'Proposition de loi organique visant à garantir le pluralisme',
      null,
    ],
    [
      "l'ensemble du projet de loi relatif aux jeux (JOP 2024) (première lecture)",
      'Projet de loi relatif aux jeux (JOP 2024)',
      'première lecture',
    ],
    [
      'l’ensemble de la proposition de loi visant à protéger les abeilles (première lecture)',
      'Proposition de loi visant à protéger les abeilles',
      'première lecture',
    ],
  ];

  it.each(cas)('« %s »', (titre, court, lect) => {
    expect(titreCourt(titre)).toBe(court);
    expect(lecture(titre)).toBe(lect);
  });

  it("met une majuscule à un titre qui n'est pas un vote sur l'ensemble", () => {
    expect(titreCourt("l'article 3 du projet de loi relatif à la sobriété foncière")).toBe(
      "L'article 3 du projet de loi relatif à la sobriété foncière",
    );
    expect(lecture("l'article 3 du projet de loi relatif à la sobriété foncière")).toBeNull();
  });
});

describe('ventilerParGroupe', () => {
  const rn: Groupe = { id: 'RN', abrege: 'RN', libelle: 'Rassemblement National', couleur: '#1b3a8a' };
  const soc: Groupe = { id: 'SOC', abrege: 'SOC', libelle: 'Socialistes et apparentés', couleur: '#e4002b' };
  const lfi: Groupe = { id: 'LFI-NFP', abrege: 'LFI-NFP', libelle: 'La France insoumise', couleur: '#c4001d' };
  const groupes: Record<string, Groupe> = { a1: rn, a2: rn, a3: rn, s1: soc, s2: soc, l1: lfi, l2: lfi, l3: lfi };
  const groupeDe = (slug: string) => groupes[slug];
  const v = (slug: string, position: Position) => ({ slug, position });

  it('donne la position majoritaire de chaque groupe et son décompte', () => {
    const resultat = ventilerParGroupe(
      [v('a1', 'pour'), v('a2', 'pour'), v('a3', 'abstention'), v('s1', 'contre'), v('s2', 'contre')],
      groupeDe,
    );
    expect(resultat.map((g) => [g.groupe.id, g.position, g.compte])).toEqual([
      ['RN', 'pour', { pour: 2, contre: 0, abstention: 1, nonvotant: 0 }],
      ['SOC', 'contre', { pour: 0, contre: 2, abstention: 0, nonvotant: 0 }],
    ]);
  });

  it('range les députés sans groupe connu dans « NI »', () => {
    const resultat = ventilerParGroupe([v('a1', 'pour'), v('inconnu', 'abstention')], groupeDe);
    const ni = resultat.find((g) => g.groupe.id === 'NI');
    expect(ni?.groupe).toEqual({ id: 'NI', abrege: 'NI', libelle: 'Non inscrits', couleur: null });
    expect(ni?.compte).toEqual({ pour: 0, contre: 0, abstention: 1, nonvotant: 0 });
  });

  it('renvoie « partage » quand deux positions sont à égalité en tête', () => {
    const resultat = ventilerParGroupe([v('a1', 'pour'), v('a2', 'contre'), v('a3', 'nonvotant')], groupeDe);
    expect(resultat[0].position).toBe('partage');
  });

  it('peut avoir « nonvotant » pour position majoritaire', () => {
    const resultat = ventilerParGroupe([v('l1', 'contre'), v('l2', 'nonvotant'), v('l3', 'nonvotant')], groupeDe);
    expect(resultat[0].position).toBe('nonvotant');
  });

  it("trie par nombre d'élus décroissant, puis par abrégé", () => {
    const resultat = ventilerParGroupe(
      [v('s1', 'pour'), v('l1', 'pour'), v('a1', 'pour'), v('a2', 'pour'), v('a3', 'pour'), v('s2', 'pour'), v('l2', 'pour')],
      groupeDe,
    );
    expect(resultat.map((g) => g.groupe.id)).toEqual(['RN', 'LFI-NFP', 'SOC']);
  });

  it('conserve le total : la somme des groupes égale le nombre de votes', () => {
    const votes = [v('a1', 'pour'), v('s1', 'contre'), v('l1', 'abstention'), v('x', 'nonvotant'), v('y', 'pour')];
    const resultat = ventilerParGroupe(votes, groupeDe);
    const somme = resultat.reduce(
      (total, g) => total + g.compte.pour + g.compte.contre + g.compte.abstention + g.compte.nonvotant,
      0,
    );
    expect(somme).toBe(votes.length);
  });

  it('renvoie une liste vide sans vote', () => {
    expect(ventilerParGroupe([], groupeDe)).toEqual([]);
  });
});

describe('tauxAbstention', () => {
  it('divise les abstentions par les suffrages (pour + contre + abstention)', () => {
    expect(tauxAbstention(5, 20)).toBe(0.25);
    expect(tauxAbstention(0, 40)).toBe(0);
  });

  it('renvoie null sans aucun suffrage', () => {
    expect(tauxAbstention(0, 0)).toBeNull();
  });
});
