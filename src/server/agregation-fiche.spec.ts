// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeputeDetail } from '@contrat';
import { ageAu, creerAgregation, jourAParis, type Agregation } from './agregation';
import { produireDonneesDeTest, type DonneesDeTest } from './testing/donnees';

// La fiche d'un député : état civil, mandat, groupes, fonctions, parti et liens, d'après les fixtures.
// Les fixtures sont d'abord copiées puis altérées (un décès, une naissance dans le futur, des liens) pour les cas limites.

const WIKI = 'https://fr.wikipedia.org/wiki/';

/** Ce que les tests altèrent d'un acteur des fixtures. */
interface ActeurBrut {
  etatCivil: { dateDeces?: string; infoNaissance: { dateNais: string } };
  adresses?: { adresse: { typeLibelle: string; valElec: string }[] };
}

function modifierActeur(fixtures: string, pa: string, modifier: (acteur: ActeurBrut) => void) {
  const chemin = join(fixtures, 'json', 'acteur', `${pa}.json`);
  const brut = JSON.parse(readFileSync(chemin, 'utf8'));
  modifier(brut.acteur);
  writeFileSync(chemin, JSON.stringify(brut));
}

describe('ageAu', () => {
  it("compte les années entières : l'anniversaire change l'âge le jour même", () => {
    expect(ageAu('1973-04-13', '2026-04-12')).toBe(52);
    expect(ageAu('1973-04-13', '2026-04-13')).toBe(53);
    expect(ageAu('1973-04-13', '2026-12-31')).toBe(53);
    expect(ageAu('1973-04-13', '1973-04-13')).toBe(0);
  });

  it('ne donne jamais un âge négatif', () => {
    expect(ageAu('2030-01-01', '2026-10-19')).toBe(0);
  });

  it('gère le 29 février : l’anniversaire est atteint le 1er mars les années non bissextiles', () => {
    expect(ageAu('2000-02-29', '2025-02-28')).toBe(24);
    expect(ageAu('2000-02-29', '2025-03-01')).toBe(25);
  });
});

describe('jourAParis', () => {
  it('donne le jour à Paris, pas à Greenwich : minuit passe deux heures plus tôt en été', () => {
    expect(jourAParis(new Date('2026-07-14T21:59:59Z'))).toBe('2026-07-14');
    expect(jourAParis(new Date('2026-07-14T22:00:00Z'))).toBe('2026-07-15');
    expect(jourAParis(new Date('2026-01-14T22:59:59Z'))).toBe('2026-01-14');
    expect(jourAParis(new Date('2026-01-14T23:00:00Z'))).toBe('2026-01-15');
  });
});

describe('agregation : fiche d’un député', () => {
  let jeu: DonneesDeTest;
  let aujourdhui: Date;
  let agregation: Agregation;

  beforeAll(async () => {
    jeu = await produireDonneesDeTest((fixtures) => {
      // Un député décédé (il n'a plus d'âge qui avance) et un autre dont la date de naissance est dans le futur.
      modifierActeur(fixtures, 'PA1567', (a) => (a.etatCivil.dateDeces = '2026-03-01'));
      modifierActeur(
        fixtures,
        'PA720468',
        (a) => (a.etatCivil.infoNaissance.dateNais = '2999-01-01'),
      );
      // Un site écrit n'importe comment : il ne doit pas passer.
      modifierActeur(fixtures, 'PA1008', (a) => {
        a.adresses = { adresse: [{ typeLibelle: 'Site internet', valElec: 'mon site officiel' }] };
      });
    });
    aujourdhui = new Date('2026-10-19T10:00:00Z');
    agregation = creerAgregation(jeu.donnees, { maintenant: () => aujourdhui });
  });
  afterAll(() => jeu.nettoyer());

  const fiche = (slug: string) => agregation.depute(slug) as DeputeDetail;

  it('Alain David : naissance avec âge, profession, mandat en cours et législatures', () => {
    const david = fiche('alain-david');

    expect(david.naissance).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      age: expect.any(Number),
    });
    expect(david.deces).toBeNull();
    expect(david.profession).not.toBeNull();
    expect(david.mandat).toMatchObject({ depuis: '2024-07-07', fin: null });
    expect(david.mandat!.legislatures.at(-1)).toBe(17);
  });

  it("calcule l'âge à la requête, avec la date du jour à Paris (une date injectée)", () => {
    const naissance = fiche('alain-david').naissance!;
    const [annee, mois, jour] = naissance.date.split('-').map(Number);

    const veille = new Date(Date.UTC(2026, mois - 1, jour - 1, 12));
    const jourJ = new Date(Date.UTC(2026, mois - 1, jour, 12));
    const avant = creerAgregation(jeu.donnees, { maintenant: () => veille }).depute('alain-david')!;
    const apres = creerAgregation(jeu.donnees, { maintenant: () => jourJ }).depute('alain-david')!;

    expect(avant.naissance!.age).toBe(2026 - annee - 1);
    expect(apres.naissance!.age).toBe(2026 - annee);
  });

  it("l'âge suit l'horloge sans que la fiche mémorisée le fige : même agrégation, deux dates", () => {
    let maintenant = new Date('2026-01-01T12:00:00Z');
    const courante = creerAgregation(jeu.donnees, { maintenant: () => maintenant });
    const annee = Number(courante.depute('alain-david')!.naissance!.date.slice(0, 4));

    const avant = courante.depute('alain-david')!.naissance!.age;
    maintenant = new Date('2027-12-31T12:00:00Z');
    const apres = courante.depute('alain-david')!.naissance!.age;

    expect(avant).toBe(2026 - annee - 1);
    expect(apres).toBe(2027 - annee);
  });

  it("donne l'âge au décès d'un député décédé, et sa date de décès", () => {
    const guedj = fiche('jerome-guedj'); // né le 1972-01-23, décès altéré au 2026-03-01

    expect(guedj.deces).toBe('2026-03-01');
    expect(guedj.naissance).toEqual({ date: '1972-01-23', age: 54, lieu: 'Pantin' });
  });

  it('écarte une date de naissance dans le futur plutôt que de publier un âge faux', () => {
    expect(fiche('sebastien-chenu').naissance).toBeNull();
  });

  it('donne le lieu avec le pays quand il est étranger', () => {
    expect(fiche('jean-louis-roumegas').naissance?.lieu).toBe('Alger (Algérie)');
  });

  it('un lien absent est null, jamais une adresse devinée', () => {
    const martin = fiche('alexandra-martin-gironde');

    expect(martin.liens.hatvp).toBeNull();
    expect(martin.liens.assemblee).toMatch(
      /^https:\/\/www\.assemblee-nationale\.fr\/dyn\/deputes\/PA\d+$/,
    );
    for (const [cle, lien] of Object.entries(martin.liens)) {
      expect(lien === null || /^https:\/\//.test(lien), cle).toBe(true);
    }
  });

  it('un site déclaré de façon inexploitable est écarté', () => {
    expect(fiche('alain-david').liens.siteWeb).toBeNull();
  });

  it("les anciens députés n'ont pas d'adresse HATVP, de fonction ni de parti de rattachement", () => {
    const ancien = fiche('nicolas-forissier');

    expect(ancien.mandat!.fin).toBe('2025-11-12');
    expect(ancien.liens.hatvp).toBeNull();
    expect(ancien.fonctions).toEqual([]);
    expect(ancien.partiRattachement).toBeNull();
    expect(ancien.liens.wikipedia).toMatch(new RegExp(`^${WIKI}`));
  });

  it("donne l'historique des groupes avec les groupes complets, dont un groupe que ne liste aucun scrutin", () => {
    const ciotti = fiche('eric-ciotti');

    expect(ciotti.groupes.map(({ groupe, debut, fin }) => [groupe.abrege, debut, fin])).toEqual([
      ['NI', '2024-07-08', '2024-07-18'],
      ['AD', '2024-07-19', '2024-09-11'],
      ['UDR', '2024-09-12', '2025-09-04'],
      ['UDR', '2025-09-05', null],
    ]);
    expect(ciotti.groupes[1].groupe).toMatchObject({
      id: 'PO845520',
      libelle: expect.any(String),
      couleur: expect.stringMatching(/^#/),
    });
    expect(ciotti.groupe).toMatchObject({ id: 'PO872880', abrege: 'UDR' });
  });

  it('Sébastien Chenu (profil réel des fixtures) : fonctions, parti, X et Facebook', () => {
    const chenu = fiche('sebastien-chenu');

    expect(chenu.profession).toBe('Conseiller en communication');
    expect(chenu.groupes.map((g) => [g.groupe.abrege, g.debut, g.fin])).toEqual([
      ['NI', '2024-07-01', '2024-07-18'],
      ['RN', '2024-07-19', null],
    ]);
    expect(chenu.fonctions[0]).toEqual({
      organe: "Bureau de l'Assemblée nationale",
      qualite: "Vice-président de l'Assemblée nationale",
      depuis: '2025-10-01',
    });
    expect(chenu.partiRattachement).toBe('Rassemblement national');
    expect(chenu.liens).toEqual({
      assemblee: 'https://www.assemblee-nationale.fr/dyn/deputes/PA720468',
      hatvp: 'https://www.hatvp.fr/pages_nominatives/chenu-sebastien',
      wikipedia: `${WIKI}S%C3%A9bastien_Chenu`,
      siteWeb: null,
      x: 'https://x.com/sebchenu',
      facebook: 'https://www.facebook.com/chenu.sebastien',
    });
  });

  it('ne publie dans la fiche ni téléphone, ni e-mail, ni adresse postale', () => {
    for (const { slug } of jeu.donnees.deputes) {
      const texte = JSON.stringify(agregation.depute(slug));
      expect(texte, slug).not.toMatch(
        /@assemblee-nationale\.fr|\b0[1-9]([ .]?\d{2}){4}\b|Rue de l'Université/,
      );
    }
  });

  it("n'a aucun lien qui ne soit pas en https sur le site attendu, dans toutes les fiches", () => {
    const prefixes: Record<string, string> = {
      assemblee: 'https://www.assemblee-nationale.fr/dyn/deputes/',
      hatvp: 'https://www.hatvp.fr/pages_nominatives/',
      wikipedia: WIKI,
      x: 'https://x.com/',
      facebook: 'https://www.facebook.com/',
    };
    for (const { slug } of jeu.donnees.deputes) {
      const { liens } = fiche(slug);
      for (const [cle, prefixe] of Object.entries(prefixes)) {
        const lien = liens[cle as keyof typeof liens];
        expect(lien === null || lien.startsWith(prefixe), `${slug} ${cle}`).toBe(true);
      }
      expect(liens.siteWeb === null || liens.siteWeb.startsWith('https://'), slug).toBe(true);
    }
  });

  it("l'index des députés porte le numéro sans préfixe « PA » (sept caractères au plus) et la fiche en déduit la photo", () => {
    const { deputes } = agregation.deputes();

    for (const d of deputes) {
      expect(d.pa, d.slug).toMatch(/^\d{1,7}$/);
      expect(fiche(d.slug).photo, d.slug).toBe(
        `https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/${d.pa}.jpg`,
      );
    }
    expect(deputes.find((d) => d.slug === 'jerome-guedj')?.pa).toBe('1567');
  });

  it("garde l'index petit : ni photo ni données de fiche", () => {
    const { deputes } = agregation.deputes();

    expect(Object.keys(deputes[0]).sort()).toEqual(
      ['circonscription', 'departement', 'groupe', 'nom', 'nomTri', 'pa', 'slug'].sort(),
    );
  });
});

// Un remplaçant n'est « en mandat » qu'à partir de sa prise de fonction (DONNEES.md, « Effectif en mandat ») : sans cela,
// sa participation compterait aussi les scrutins où son titulaire siégeait seul. Cas réels des fixtures : Fabien Di Filippo
// et son remplaçant Jérôme End (2026-04-21), Paul Christophe et Pierre Marle (deux suspensions).
describe('agregation : participation des remplaçants', () => {
  let jeu: DonneesDeTest;
  let agregation: Agregation;

  beforeAll(async () => {
    jeu = await produireDonneesDeTest();
    agregation = creerAgregation(jeu.donnees, {
      maintenant: () => new Date('2026-10-19T10:00:00Z'),
    });
  });
  afterAll(() => jeu.nettoyer());

  const fiche = (slug: string) => agregation.depute(slug) as DeputeDetail;

  it('compte un remplaçant en mandat depuis son arrivée seulement : 12 scrutins sur 19 pour Jérôme End', () => {
    const end = fiche('jerome-end');

    // Les sept scrutins d'avant le 2026-04-21 ne comptent pas (il n'était pas encore député).
    expect(end.scrutins).toEqual({ enMandat: 12, pour: 5, contre: 0, abstention: 0, nonVote: 7 });
    expect(end.taux.participation).toBeCloseTo(5 / 12, 10);
    // La fiche montre son arrivée, non l'élection générale de 2024 que l'archive met dans `dateDebut`.
    expect(end.mandat).toMatchObject({ depuis: '2026-04-21', fin: null });
  });

  it('son titulaire Fabien Di Filippo ne compte que les scrutins jusqu’à sa démission', () => {
    const diFilippo = fiche('fabien-di-filippo');

    expect(diFilippo.scrutins).toEqual({
      enMandat: 7,
      pour: 0,
      contre: 3,
      abstention: 0,
      nonVote: 4,
    });
    expect(diFilippo.mandat).toMatchObject({ fin: '2026-04-20' });
  });

  it('deux suspensions : Paul Christophe et Pierre Marle ne sont jamais en mandat le même jour', () => {
    const christophe = fiche('paul-christophe');
    const marle = fiche('pierre-marle');

    expect(christophe.scrutins).toEqual({
      enMandat: 5,
      pour: 0,
      contre: 1,
      abstention: 1,
      nonVote: 3,
    });
    expect(marle.scrutins).toEqual({
      enMandat: 14,
      pour: 4,
      contre: 0,
      abstention: 0,
      nonVote: 10,
    });
    // Aucun des 19 scrutins ne les compte tous les deux (même siège, Nord 14).
    const deputes = JSON.parse(readFileSync(join(jeu.dossier, 'deputes.json'), 'utf8')) as {
      pa: string;
    }[];
    const lignes = readFileSync(join(jeu.dossier, 'votes.txt'), 'utf8').split('\n');
    const colonnes = ['PA642868', 'PA794518'].map((pa) => deputes.findIndex((d) => d.pa === pa));
    for (const ligne of lignes) {
      expect(colonnes.filter((c) => ligne[c] !== '-').length).toBeLessThanOrEqual(1);
    }
    // Marle a le mandat en cours le plus récent (ouvert depuis le 2026-04-07), Christophe son dernier mandat, fini.
    expect(marle.mandat).toMatchObject({ depuis: '2026-04-07', fin: null });
    expect(christophe.mandat).toMatchObject({ depuis: '2025-01-24', fin: '2026-04-06' });
  });
});
