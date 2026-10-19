// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Compte, Position, PositionGroupe, ScrutinDetail } from '@contrat';
import { creerAgregation, type Agregation } from './agregation';
import { GENERE_LE, produireDonneesDeTest, type DonneesDeTest } from './testing/donnees';

const somme = (comptes: Compte[]): Compte =>
  comptes.reduce(
    (t, c) => ({
      pour: t.pour + c.pour,
      contre: t.contre + c.contre,
      abstention: t.abstention + c.abstention,
      nonvotant: t.nonvotant + c.nonvotant,
    }),
    { pour: 0, contre: 0, abstention: 0, nonvotant: 0 },
  );

/** Position majoritaire d'un groupe, recalculée ici de façon indépendante de donnees.ts. */
function positionAttendue(c: Compte): PositionGroupe {
  const exprimes = [
    ['pour', c.pour],
    ['contre', c.contre],
    ['abstention', c.abstention],
  ] as const;
  const max = Math.max(...exprimes.map(([, n]) => n));
  if (max === 0) return 'nonvotant';
  const premiers = exprimes.filter(([, n]) => n === max);
  return premiers.length > 1 ? 'partage' : premiers[0][0];
}

describe('agregation', () => {
  let jeu: DonneesDeTest;
  let agregation: Agregation;
  /** Les fichiers de `data/`, relus ici sans passer par donnees.ts, pour les vérifications croisées. */
  let fichiers: {
    scrutins: { n: number; type: string; dossier: string | null; groupes: { g: number }[] }[];
    deputes: {
      slug: string;
      pa: string;
      nom: string;
      nomTri: string;
      groupe: string | null;
      actif: boolean;
    }[];
    groupes: { id: string; abrege: string }[];
    votes: string[];
    groupesVotes: string[];
  };
  const CODES = '0123456789abcdefghijklmnopqrstuvwxyz';

  beforeAll(async () => {
    jeu = await produireDonneesDeTest();
    agregation = creerAgregation(jeu.donnees);
    const lire = (nom: string) => readFileSync(join(jeu.dossier, nom), 'utf8');
    fichiers = {
      scrutins: JSON.parse(lire('scrutins.json')),
      deputes: JSON.parse(lire('deputes.json')),
      groupes: JSON.parse(lire('groupes.json')),
      votes: lire('votes.txt').split('\n'),
      groupesVotes: lire('groupes-votes.txt').split('\n'),
    };
  });
  afterAll(() => jeu.nettoyer());

  const deputeIndex = (slug: string) => fichiers.deputes.findIndex((d) => d.slug === slug);

  describe('scrutin', () => {
    it('somme les groupes au décompte du scrutin, pour chaque scrutin', () => {
      for (const { n } of fichiers.scrutins) {
        const detail = agregation.scrutin(n) as ScrutinDetail;

        expect(somme(detail.groupes.map((g) => g.compte)), `scrutin ${n}`).toEqual(detail.compte);
      }
    });

    it('calcule la position de chaque groupe sur ses décomptes (pas la positionMajoritaire officielle)', () => {
      for (const { n } of fichiers.scrutins) {
        for (const vote of (agregation.scrutin(n) as ScrutinDetail).groupes) {
          expect(vote.position, `scrutin ${n}, ${vote.groupe.abrege}`).toBe(
            positionAttendue(vote.compte),
          );
        }
      }
    });

    it('identifie un groupe par son organe officiel, affiché par son abrégé', () => {
      const detail = agregation.scrutin(8706) as ScrutinDetail;
      const rn = detail.groupes.find((g) => g.groupe.abrege === 'RN');

      expect(rn?.groupe).toEqual({
        id: 'PO845401',
        abrege: 'RN',
        libelle: 'Rassemblement National',
        couleur: '#313567',
      });
    });

    it("n'affiche pas un groupe dont aucun député n'est listé, mais garde le décompte du scrutin", () => {
      const d = jeu.donnees;
      let avecGroupeVide = 0;
      for (let s = 0; s < d.nbScrutins; s++) {
        const vides = d
          .groupesDuScrutin(s)
          .filter(
            ({ compte }) =>
              compte.pour + compte.contre + compte.abstention + compte.nonvotant === 0,
          );
        const detail = agregation.scrutin(d.numero(s)) as ScrutinDetail;
        expect(detail.groupes).toHaveLength(d.groupesDuScrutin(s).length - vides.length);
        if (vides.length > 0) avecGroupeVide++;
      }

      expect(avecGroupeVide).toBeGreaterThan(0); // le jeu de test contient bien le cas
    });

    it('trie les groupes du plus nombreux au moins nombreux', () => {
      const tailles = (agregation.scrutin(8706) as ScrutinDetail).groupes.map(
        (g) => g.compte.pour + g.compte.contre + g.compte.abstention + g.compte.nonvotant,
      );

      expect(tailles).toEqual([...tailles].sort((a, b) => b - a));
    });

    it('liste, par groupe et par position, exactement les députés du décompte', () => {
      for (const { n } of fichiers.scrutins) {
        const detail = agregation.scrutin(n) as ScrutinDetail;
        const parPosition = (position: Position) =>
          detail.nominatif
            .filter((b) => b.position === position)
            .reduce((total, b) => total + b.deputes.length, 0);

        expect(parPosition('pour'), `scrutin ${n} pour`).toBe(detail.compte.pour);
        expect(parPosition('contre'), `scrutin ${n} contre`).toBe(detail.compte.contre);
        expect(parPosition('abstention'), `scrutin ${n} abstention`).toBe(detail.compte.abstention);
        expect(parPosition('nonvotant'), `scrutin ${n} nonvotant`).toBe(detail.compte.nonvotant);
        const idsGroupes = new Set(detail.groupes.map((g) => g.groupe.id));
        expect(detail.nominatif.every((b) => idsGroupes.has(b.groupeId))).toBe(true);
      }
    });

    it("donne à chaque député de la liste le groupe qu'il avait le jour du vote", () => {
      const detail = agregation.scrutin(881) as ScrutinDetail;
      const udr = detail.nominatif.filter((b) => b.deputes.some((d) => d.slug === 'eric-ciotti'));

      // Le 20 février 2025, Éric Ciotti était dans l'ancien groupe UDR (PO847173), pas dans le nouveau (PO872880).
      expect(udr.map((b) => b.groupeId)).toEqual(['PO847173']);
      // Le 13 octobre 2026, il est dans le groupe recréé en 2025 (PO872880).
      const recent = (agregation.scrutin(8706) as ScrutinDetail).nominatif.filter((b) =>
        b.deputes.some((d) => d.slug === 'eric-ciotti'),
      );
      expect(recent.map((b) => b.groupeId)).toEqual(['PO872880']);
    });

    it('trie les députés de chaque liste par nom de famille', () => {
      const detail = agregation.scrutin(8706) as ScrutinDetail;
      const bloc = detail.nominatif.reduce((plus, b) =>
        b.deputes.length > plus.deputes.length ? b : plus,
      );
      const nomTri = (slug: string) => fichiers.deputes.find((d) => d.slug === slug)!.nomTri;

      expect(bloc.deputes.length).toBeGreaterThan(3);
      const noms = bloc.deputes.map((d) => nomTri(d.slug));
      expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
    });

    it("n'invente pas de scrutin", () => {
      expect(agregation.scrutin(999999)).toBeNull();
    });

    it('rattache un scrutin à sa loi, ou à aucune', () => {
      expect((agregation.scrutin(8278) as ScrutinDetail).loi).toEqual({
        dossier: 'DLR5L17N53980',
        titreCourt: expect.stringMatching(/^Projet de loi visant à offrir/),
      });
      expect((agregation.scrutin(5729) as ScrutinDetail).loi).toBeNull();
    });

    it("renseigne l'URL officielle du scrutin et son résultat officiel", () => {
      const detail = agregation.scrutin(8706) as ScrutinDetail;

      expect(detail.urlOfficielle).toBe('https://www.assemblee-nationale.fr/dyn/17/scrutins/8706');
      expect(detail.adopte).toBe(true);
      expect((agregation.scrutin(7979) as ScrutinDetail).adopte).toBe(false);
    });
  });

  describe('accueil', () => {
    it('liste les votes finaux, une carte par texte, du plus récent au plus ancien', () => {
      const accueil = agregation.accueil(1);

      // 8279 (première lecture du texte n°53980) est écarté : 8433 est le vote final le plus récent du dossier.
      expect(accueil.lois.map((l) => l.voteFinal.numero)).toEqual([
        8706, 8705, 8696, 8695, 8694, 8693, 8433, 5729, 3053, 881,
      ]);
      expect(accueil.lois.every((l) => l.voteFinal.type === 'final')).toBe(true);
      expect(accueil.page).toBe(1);
      expect(accueil.pageSuivante).toBe(false);
      expect(accueil.miseAJour).toBe(GENERE_LE);
    });

    it('renvoie une page vide au-delà de la dernière', () => {
      const accueil = agregation.accueil(2);

      expect(accueil.lois).toEqual([]);
      expect(accueil.pageSuivante).toBe(false);
    });

    it('dérive le titre court et la lecture du titre du scrutin, sans le point final', () => {
      const carte = agregation.accueil(1).lois.find((l) => l.voteFinal.numero === 8433)!;

      expect(carte.titreCourt).toMatch(/^Projet de loi visant à offrir des réponses immédiates/);
      expect(carte.titreCourt.endsWith('.')).toBe(false);
      expect(carte.titreOfficiel.endsWith('.')).toBe(true);
      expect(carte.lecture).toBe('texte de la commission mixte paritaire');
      expect(carte.statut).toBeNull();
      expect(agregation.accueil(1).lois[0].lecture).toBe('première lecture');
    });

    it('garde un vote final sans dossier : il se lie à /scrutins/:numero', () => {
      const sansDossier = agregation.accueil(1).lois.filter((l) => l.dossier === null);

      expect(sansDossier.map((l) => l.voteFinal.numero)).toEqual([5729, 3053, 881]);
    });

    it("affiche la lecture d'un texte de commission mixte paritaire telle quelle", () => {
      const lectures = agregation.accueil(1).lois.map((l) => l.lecture);

      expect(lectures).toContain('texte de la commission mixte paritaire');
      for (const lecture of lectures) {
        expect(lecture === null || /lecture|commission mixte paritaire/i.test(lecture)).toBe(true);
      }
    });

    it('somme les groupes de chaque carte au décompte du vote final', () => {
      for (const loi of agregation.accueil(1).lois) {
        expect(somme(loi.groupes.map((g) => g.compte))).toEqual(loi.voteFinal.compte);
      }
    });
  });

  describe('loi', () => {
    it('regroupe les scrutins du dossier : vote final le plus récent, lectures, autres scrutins', () => {
      const loi = agregation.loi('DLR5L17N53980')!;

      expect(loi.dossier).toBe('DLR5L17N53980');
      expect(loi.voteFinal?.numero).toBe(8433);
      expect(loi.voteFinal?.groupes.length).toBeGreaterThan(5);
      expect(loi.lectures.map((s) => s.numero)).toEqual([8279]);
      expect(loi.scrutins.map((s) => s.numero)).toEqual([8278, 8259]);
      expect(loi.scrutins.map((s) => s.type)).toEqual(['amendement', 'article']);
      expect(loi.lecture).toBe('texte de la commission mixte paritaire');
      expect(loi.titreCourt).toMatch(/^Projet de loi visant à offrir/);
      expect(loi.titreOfficiel).toMatch(/^l'ensemble du projet de loi visant à offrir/);
      expect(loi.statut).toBeNull();
      expect(loi.urlDossier).toBeNull();
    });

    it("n'a pas de vote final tant que le texte n'a pas été voté dans son ensemble", () => {
      const loi = agregation.loi('DLR5L17N54629')!;

      expect(loi.voteFinal).toBeNull();
      expect(loi.lecture).toBeNull();
      expect(loi.lectures).toEqual([]);
      expect(loi.scrutins.map((s) => s.numero)).toEqual([8748]);
      // Le titre est tiré du texte cité par les amendements, pas « L'amendement n° … ».
      expect(loi.titreCourt).toBe('Projet de loi de finances pour 2027');
    });

    it('classe les scrutins du texte du plus récent au plus ancien', () => {
      const loi = agregation.loi('DLR5L17N53980')!;
      const dates = [...loi.lectures, ...loi.scrutins].map((s) => s.date);

      expect(dates).toEqual([...dates].sort().reverse());
    });

    it("n'invente pas de loi", () => {
      expect(agregation.loi('DLR5L17N0')).toBeNull();
    });
  });

  describe('députés', () => {
    it("n'indexe que les députés actifs, triés par nom de famille", () => {
      const liste = agregation.deputes();
      const actifs = fichiers.deputes.filter((d) => d.actif);

      expect(liste.deputes).toHaveLength(actifs.length);
      expect(liste.deputes.some((d) => d.slug === 'nicolas-forissier')).toBe(false);
      const noms = liste.deputes.map((d) => d.nomTri);
      expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
    });

    it("donne l'abrégé du groupe actuel et garde la précision des homonymes", () => {
      const liste = agregation.deputes();
      const martin = liste.deputes.filter((d) => d.nom.startsWith('Alexandra Martin'));

      expect(martin.map((d) => d.nom).sort()).toEqual([
        'Alexandra Martin (Alpes-Maritimes)',
        'Alexandra Martin (Gironde)',
      ]);
      expect(martin.map((d) => d.nomTri)).toEqual(['Martin', 'Martin']);
      expect(martin.map((d) => d.slug).sort()).toEqual([
        'alexandra-martin-alpes-maritimes',
        'alexandra-martin-gironde',
      ]);
      expect(liste.deputes.find((d) => d.slug === 'jerome-guedj')).toMatchObject({
        groupe: 'SOC',
        departement: '91',
        circonscription: 'Essonne (6)',
      });
    });

    it('liste les groupes actuels des députés actifs, et les textes qui ont un dossier', () => {
      const liste = agregation.deputes();

      expect(liste.groupes.map((g) => g.abrege)).toContain('UDR');
      expect(liste.groupes.every((g) => g.id.startsWith('PO'))).toBe(true);
      expect(liste.loisRecentes.map((l) => l.dossier)).toEqual([
        'DLR5L17N54777',
        'DLR5L17N54776',
        'DLR5L17N53095',
        'DLR5L17N54096',
        'DLR5L17N53886',
        'DLR5L17N54445',
        'DLR5L17N53980',
      ]);
      expect(liste.loisRecentes[0]).toEqual({
        dossier: 'DLR5L17N54777',
        titreCourt: expect.stringMatching(/^Proposition de loi organique visant à adapter/),
        date: '2026-10-13',
      });
    });
  });

  describe('député', () => {
    it('construit la fiche : photo sans préfixe PA, fiche avec préfixe, groupe actuel, circonscription', () => {
      const depute = agregation.depute('jerome-guedj')!;
      const pa = fichiers.deputes[deputeIndex('jerome-guedj')].pa;

      expect(depute.nom).toBe('Jérôme Guedj');
      expect(depute.photo).toBe(
        `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/${pa.slice(2)}.jpg`,
      );
      expect(depute.photo).not.toContain('PA');
      expect(depute.urlFiche).toBe(`https://www.assemblee-nationale.fr/dyn/deputes/${pa}`);
      expect(depute.groupe).toMatchObject({ id: 'PO845419', abrege: 'SOC' });
      expect(depute.circonscription).toBe('Essonne (6)');
    });

    it('calcule les taux sur les scrutins où il était en mandat', () => {
      // Guedj : 19 scrutins en mandat, 10 votes exprimés (7 pour, 3 contre), aucune abstention.
      const { taux } = agregation.depute('jerome-guedj')!;
      const cases = fichiers.votes.map((ligne) => ligne[deputeIndex('jerome-guedj')]);

      expect(cases.join('')).toBe('XPPXXPPCCXXXXPCXPXP');
      expect(taux.participation).toBeCloseTo(10 / 19, 10);
      expect(taux.abstention).toBe(0);

      // Loyauté recalculée à la main : vote égal à la position de son groupe ce jour-là, hors « partage ».
      let alignes = 0;
      let comparables = 0;
      fichiers.scrutins.forEach((s, i) => {
        const vote = cases[i];
        if (!'PCA'.includes(vote)) return;
        const g = CODES.indexOf(fichiers.groupesVotes[i][deputeIndex('jerome-guedj')]);
        const groupe = (agregation.scrutin(s.n) as ScrutinDetail).groupes.find(
          (v) => v.groupe.id === fichiers.groupes[g].id,
        )!;
        if (groupe.position === 'partage' || groupe.position === 'nonvotant') return;
        comparables++;
        if (groupe.position === { P: 'pour', C: 'contre', A: 'abstention' }[vote]) alignes++;
      });
      expect(comparables).toBeGreaterThan(0);
      expect(taux.loyaute).toBeCloseTo(alignes / comparables, 10);
    });

    it("compte l'absence (X) dans le dénominateur de la participation", () => {
      // Marine Le Pen : mandat sur les 19 scrutins ; elle n'a voté que 5 fois (X partout ailleurs).
      const cases = fichiers.votes.map((ligne) => ligne[deputeIndex('marine-le-pen')]).join('');
      const { taux } = agregation.depute('marine-le-pen')!;

      expect(cases.replace(/[^PCA]/g, '')).toHaveLength(6);
      expect(taux.participation).toBeCloseTo(6 / cases.replace(/-/g, '').length, 10);
    });

    it('donne null aux taux sans dénominateur', () => {
      const index = deputeIndex('nicolas-forissier');
      const cases = fichiers.votes.map((ligne) => ligne[index]).join('');
      const { taux } = agregation.depute('nicolas-forissier')!;

      expect(cases).not.toMatch(/[PCA]/);
      expect(taux).toEqual({ participation: 0, abstention: null, loyaute: null });
    });

    it('liste ses 10 derniers votes finaux, avec sa position et celle de son groupe', () => {
      const depute = agregation.depute('jerome-guedj')!;

      expect(depute.dernieresLois.map((v) => v.numero)).toEqual([
        8706, 8705, 8696, 8695, 8694, 8693, 8433, 8279, 5729, 3053,
      ]);
      // Guedj : 8706 P, 8705 P, 8696 X, 8695 X, 8694 P, 8693 P, 8433 C, 8279 C, 5729 P, 3053 X.
      expect(depute.dernieresLois.map((v) => v.position)).toEqual([
        'pour',
        'pour',
        null,
        null,
        'pour',
        'pour',
        'contre',
        'contre',
        'pour',
        null,
      ]);
      for (const vote of depute.dernieresLois) {
        const detail = agregation.scrutin(vote.numero) as ScrutinDetail;
        const groupe = detail.groupes.find((g) => g.groupe.abrege === 'SOC')!;

        expect(vote.positionGroupe).toBe(groupe.position);
        expect(vote.adopte).toBe(detail.adopte);
        expect(vote.date).toBe(detail.date);
      }
    });

    it('renvoie ses votes finaux sans dossier avec un dossier nul', () => {
      const depute = agregation.depute('jerome-guedj')!;
      const vote = depute.dernieresLois.find((v) => v.numero === 5729)!;

      expect(vote.loi.dossier).toBeNull();
      expect(vote.loi.titreCourt).toBe("Proposition de loi relative au droit à l'aide à mourir");
    });

    it('prend le groupe du jour du vote pour la position du groupe (changement de groupe)', () => {
      const depute = agregation.depute('eric-ciotti')!;
      const groupeA = (numero: number, id: string) =>
        (agregation.scrutin(numero) as ScrutinDetail).groupes.find((g) => g.groupe.id === id)!;

      expect(depute.groupe?.id).toBe('PO872880');
      const du = (numero: number) => depute.dernieresLois.find((v) => v.numero === numero)!;
      expect(du(8706).positionGroupe).toBe(groupeA(8706, 'PO872880').position);
      expect(du(3053).positionGroupe).toBe(groupeA(3053, 'PO847173').position);
    });

    it("ne compte pas les scrutins où il n'était pas en mandat", () => {
      const depute = agregation.depute('nicolas-forissier')!;

      expect(depute.dernieresLois.map((v) => v.numero)).toEqual([3053, 881]);
      expect(depute.dernieresLois.every((v) => v.position === null)).toBe(true);
    });

    it('sert aussi les anciens députés (liés depuis les listes nominatives)', () => {
      expect(agregation.depute('nicolas-forissier')?.nom).toBe('Nicolas Forissier');
    });

    it("n'invente pas de député", () => {
      expect(agregation.depute('personne')).toBeNull();
    });
  });
});
