// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CARACTERES_GROUPE,
  FICHIERS_DONNEES,
  type Donnees,
  type DonneesMeta,
  type DeputeFichier,
  type GroupeFichier,
  type ScrutinFichier,
} from '../../src/server/donnees.types';
import { zipSync } from 'fflate';
import { executer } from './index.mjs';
import {
  TAILLE_MINIMALE,
  URL_SCRUTINS,
  entreesDossier,
  estActeur,
  estOrgane,
  estScrutin,
} from './telecharger.mjs';

const silence = () => undefined;
const TYPES = ['final', 'motion', 'article', 'amendement', 'autre'];
const POSITIONS_GROUPE = ['pour', 'contre', 'abstention', 'nonvotant', 'partage'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const lireDossier = (dossier: string): Donnees => {
  const json = <T>(nom: string) => JSON.parse(readFileSync(join(dossier, nom), 'utf8')) as T;
  const lignes = (nom: string) => readFileSync(join(dossier, nom), 'utf8').split('\n');
  return {
    meta: json<DonneesMeta>('meta.json'),
    groupes: json<GroupeFichier[]>('groupes.json'),
    deputes: json<DeputeFichier[]>('deputes.json'),
    scrutins: json<ScrutinFichier[]>('scrutins.json'),
    votes: lignes('votes.txt'),
    groupesVotes: lignes('groupes-votes.txt'),
  };
};

/** Liste les écarts entre des données et le format décrit par donnees.types.ts et docs/DONNEES.md. */
function ecarts(d: Donnees): string[] {
  const e: string[] = [];
  const verifie = (condition: boolean, message: string) => {
    if (!condition) e.push(message);
  };
  const entier = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;
  const texteOuNull = (x: unknown) => x === null || typeof x === 'string';

  const { meta } = d;
  verifie(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(meta.genereLe), 'meta.genereLe');
  verifie(
    meta.scrutins === d.scrutins.length &&
      meta.deputes === d.deputes.length &&
      meta.groupes === d.groupes.length,
    'meta : effectifs',
  );
  for (const cle of ['scrutins', 'acteurs'] as const) {
    verifie(
      typeof meta.sources[cle].url === 'string' &&
        texteOuNull(meta.sources[cle].etag) &&
        texteOuNull(meta.sources[cle].lastModified),
      `meta.sources.${cle}`,
    );
  }
  const stat = meta.statistiques;
  verifie(
    [stat.adoptes, stat.rejetes, stat.sansDossier, stat.misesAuPoint, stat.groupesRattaches].every(
      entier,
    ),
    'meta.statistiques',
  );
  verifie(
    stat.adoptes + stat.rejetes === d.scrutins.length,
    'meta.statistiques : adoptés + rejetés',
  );
  verifie(Array.isArray(stat.nonVotantsCorriges), 'meta.statistiques.nonVotantsCorriges');
  verifie(
    Array.isArray(meta.avertissements) && meta.avertissements.every((a) => a === 'wikipedia'),
    'meta.avertissements',
  );
  verifie(Array.isArray(meta.autresGroupes), 'meta.autresGroupes');
  for (const quoi of ['actifs', 'tous'] as const) {
    verifie(
      Object.values(stat.couverture[quoi]).every(entier),
      `meta.statistiques.couverture.${quoi}`,
    );
  }
  verifie(
    stat.couverture.tous.deputes === d.deputes.length &&
      stat.couverture.actifs.deputes === d.deputes.filter((p) => p.actif).length,
    'meta.statistiques.couverture : effectifs',
  );

  d.groupes.forEach((g, i) => {
    verifie(
      /^PO\d+$/.test(g.id) &&
        typeof g.abrege === 'string' &&
        g.abrege !== '' &&
        typeof g.libelle === 'string',
      `groupes[${i}]`,
    );
    verifie(g.couleur === null || /^#[0-9A-Fa-f]{6}$/.test(g.couleur), `groupes[${i}].couleur`);
    verifie(
      (g.debut === null || DATE.test(g.debut)) && (g.fin === null || DATE.test(g.fin)),
      `groupes[${i}] : dates`,
    );
  });
  verifie(
    new Set(d.groupes.map((g) => g.id)).size === d.groupes.length,
    'groupes : identifiants uniques',
  );
  verifie(d.groupes.length <= CARACTERES_GROUPE.length, 'groupes : au plus 36');

  const idsGroupes = new Set(d.groupes.map((g) => g.id));
  const idsConnus = new Set([...idsGroupes, ...d.meta.autresGroupes.map((g) => g.id)]);
  d.meta.autresGroupes.forEach((g, i) => {
    verifie(!idsGroupes.has(g.id) && /^PO\d+$/.test(g.id), `meta.autresGroupes[${i}]`);
  });
  const dateValide = (x: unknown) =>
    typeof x === 'string' && DATE.test(x) && new Date(`${x}T00:00:00Z`).toISOString().startsWith(x);
  const PREFIXES: Record<string, string> = {
    hatvp: 'https://www.hatvp.fr/pages_nominatives/',
    wikipedia: 'https://fr.wikipedia.org/wiki/',
    siteWeb: 'https://',
    x: 'https://x.com/',
    facebook: 'https://www.facebook.com/',
  };
  d.deputes.forEach((p, i) => {
    verifie(
      p.naissance === null || (dateValide(p.naissance.date) && texteOuNull(p.naissance.lieu)),
      `deputes[${i}].naissance`,
    );
    verifie(p.deces === null || dateValide(p.deces), `deputes[${i}].deces`);
    verifie(texteOuNull(p.profession) && texteOuNull(p.parti), `deputes[${i}] : profession, parti`);
    verifie(
      p.mandat === null ||
        (dateValide(p.mandat.depuis) &&
          (p.mandat.fin === null || dateValide(p.mandat.fin)) &&
          p.mandat.legislatures.length > 0 &&
          p.mandat.legislatures.every(
            (n, j, l) => Number.isInteger(n) && (j === 0 || l[j - 1] < n),
          )),
      `deputes[${i}].mandat`,
    );
    p.groupes.forEach((g, j) => {
      verifie(
        idsConnus.has(g.id) && dateValide(g.debut) && (g.fin === null || dateValide(g.fin)),
        `deputes[${i}].groupes[${j}]`,
      );
      if (j > 0) verifie(p.groupes[j - 1].debut <= g.debut, `deputes[${i}].groupes : ordre`);
    });
    p.fonctions.forEach((f, j) => {
      verifie(
        f.organe !== '' && f.qualite !== '' && dateValide(f.depuis),
        `deputes[${i}].fonctions[${j}]`,
      );
    });
    verifie(
      !p.actif ? p.fonctions.length === 0 && p.parti === null : true,
      `deputes[${i}] : ancien député sans fonction ni parti`,
    );
    for (const [cle, prefixe] of Object.entries(PREFIXES)) {
      const lien = p.liens[cle as keyof typeof p.liens];
      verifie(
        lien === null ||
          (lien.startsWith(prefixe) && lien.length > prefixe.length && !/\s/.test(lien)),
        `deputes[${i}].liens.${cle}`,
      );
    }
    verifie(/^PA\d+$/.test(p.pa), `deputes[${i}].pa`);
    verifie(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug), `deputes[${i}].slug « ${p.slug} »`);
    verifie(p.nom.length > 0 && p.nomTri.length > 0, `deputes[${i}] : nom`);
    verifie(p.groupe === null || idsGroupes.has(p.groupe), `deputes[${i}].groupe`);
    verifie(
      texteOuNull(p.departement) && texteOuNull(p.circonscription) && typeof p.actif === 'boolean',
      `deputes[${i}]`,
    );
    if (i > 0) verifie(d.deputes[i - 1].pa < p.pa, `deputes : tri par PA à ${i}`);
  });
  verifie(
    new Set(d.deputes.map((p) => p.slug)).size === d.deputes.length,
    'deputes : slugs uniques',
  );

  d.scrutins.forEach((s, i) => {
    verifie(entier(s.n) && DATE.test(s.date) && typeof s.titre === 'string', `scrutins[${i}]`);
    verifie(
      TYPES.includes(s.type) &&
        typeof s.adopte === 'boolean' &&
        typeof s.solennel === 'boolean' &&
        texteOuNull(s.dossier),
      `scrutins[${i}] : type, adopte, solennel, dossier`,
    );
    verifie(
      Object.values(s.compte).every(entier) &&
        Object.keys(s.compte).join() === 'pour,contre,abstention,nonvotant',
      `scrutins[${i}].compte`,
    );
    if (i > 0) verifie(d.scrutins[i - 1].n > s.n, `scrutins : tri décroissant à ${i}`);
    const total = { pour: 0, contre: 0, abstention: 0, nonvotant: 0 };
    s.groupes.forEach((g, j) => {
      verifie(
        entier(g.g) && g.g < d.groupes.length && POSITIONS_GROUPE.includes(g.position),
        `scrutins[${i}].groupes[${j}]`,
      );
      if (j > 0) verifie(s.groupes[j - 1].g < g.g, `scrutins[${i}].groupes : index croissants`);
      for (const p of Object.keys(total) as (keyof typeof total)[]) total[p] += g.compte[p];
    });
    verifie(
      JSON.stringify(total) === JSON.stringify(s.compte),
      `scrutins[${i}] : somme des groupes ≠ décompte`,
    );
  });

  verifie(
    d.votes.length === d.scrutins.length && d.groupesVotes.length === d.scrutins.length,
    'matrices : une ligne par scrutin',
  );
  d.votes.forEach((ligne, i) => {
    verifie(
      ligne.length === d.deputes.length && d.groupesVotes[i].length === d.deputes.length,
      `matrices : longueur de la ligne ${i}`,
    );
    verifie(/^[PCANX-]*$/.test(ligne), `votes.txt : caractères de la ligne ${i}`);
    const attendu = new RegExp(`^[${CARACTERES_GROUPE.slice(0, d.groupes.length)}-]*$`);
    verifie(attendu.test(d.groupesVotes[i]), `groupes-votes.txt : caractères de la ligne ${i}`);
    // Les cases P, C, A et N ont un groupe ; les cases « - » n'en ont pas. On compte par (groupe, vote) en un passage.
    const comptes = new Map<string, number>();
    for (let c = 0; c < ligne.length; c++) {
      const vote = ligne[c];
      const groupe = d.groupesVotes[i][c];
      if ('PCAN'.includes(vote) && groupe === '-')
        e.push(`ligne ${i}, colonne ${c} : ${vote} sans groupe`);
      if (vote === '-' && groupe !== '-') e.push(`ligne ${i}, colonne ${c} : « - » avec un groupe`);
      const cle = groupe + vote;
      comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
    }
    // La matrice et scrutins.json disent la même chose, groupe par groupe.
    const s = d.scrutins[i];
    for (const g of s.groupes) {
      const attendu = {
        P: g.compte.pour,
        C: g.compte.contre,
        A: g.compte.abstention,
        N: g.compte.nonvotant,
      };
      for (const [lettre, nombre] of Object.entries(attendu)) {
        const n = comptes.get(CARACTERES_GROUPE[g.g] + lettre) ?? 0;
        if (n !== nombre) {
          e.push(
            `scrutin ${s.n}, groupe ${g.g} : ${n} « ${lettre} » dans la matrice pour ${nombre} dans scrutins.json`,
          );
        }
      }
    }
  });
  return e;
}

// `DONNEES_DIR=data npm test` vérifie aussi un data/ produit à partir des vraies archives.
describe.runIf(Boolean(process.env['DONNEES_DIR']))('data/ existant (DONNEES_DIR)', () => {
  it('est conforme à src/server/donnees.types.ts et à docs/DONNEES.md', () => {
    expect(ecarts(lireDossier(process.env['DONNEES_DIR']!))).toEqual([]);
  });
});

describe('npm run donnees, en mode fixtures', () => {
  let sortie: string;
  let donnees: Donnees;
  let journal: string[];

  beforeAll(async () => {
    sortie = mkdtempSync(join(tmpdir(), 'donnees-sortie-'));
    journal = [];
    await executer({
      env: { DONNEES_DEPUIS: 'fixtures' },
      destination: join(sortie, 'data'),
      journal: (m) => journal.push(m),
      maintenant: new Date('2026-10-19T05:41:02Z'),
    });
    donnees = lireDossier(join(sortie, 'data'));
  });
  afterAll(() => rmSync(sortie, { recursive: true, force: true }));

  it("écrit les six fichiers de data/, et rien d'autre", () => {
    expect(readdirSync(join(sortie, 'data')).sort()).toEqual([...FICHIERS_DONNEES].sort());
    expect(readdirSync(sortie)).toEqual(['data']);
  });

  it('produit des fichiers conformes à src/server/donnees.types.ts et à docs/DONNEES.md', () => {
    expect(ecarts(donnees)).toEqual([]);
  });

  it("détecte un écart (le contrôle de conformité n'est pas vide)", () => {
    const casse: Donnees = structuredClone(donnees);
    casse.votes[0] = casse.votes[0].slice(1);
    casse.scrutins[0].type = 'inconnu' as never;
    casse.deputes[1].slug = casse.deputes[0].slug;
    expect(ecarts(casse).length).toBeGreaterThanOrEqual(3);
  });

  it("daté de l'appel et sourcé sur les fixtures", () => {
    expect(donnees.meta.genereLe).toBe('2026-10-19T05:41:02Z');
    expect(donnees.meta.sources.scrutins).toEqual({
      url: 'src/server/fixtures/officiel',
      lastModified: null,
      etag: null,
    });
  });

  it('reste petit (un jeu de test, pas les 5,7 Mo des vraies matrices)', () => {
    const taille = FICHIERS_DONNEES.map(
      (nom) => readFileSync(join(sortie, 'data', nom)).length,
    ).reduce((a, b) => a + b, 0);
    expect(taille).toBeLessThan(150_000);
    expect(donnees.deputes.length).toBeLessThan(200);
  });

  it('journalise la source, les effectifs et la durée', () => {
    expect(journal[0]).toBe('[donnees] source : fixtures');
    expect(journal.some((m) => m.includes(`${donnees.meta.scrutins} scrutins`))).toBe(true);
    expect(journal.at(-1)).toMatch(/terminé en .* s \(mémoire maximale \d+ Mo\)/);
  });

  describe('couvre les cas du plan', () => {
    const finals = () => donnees.scrutins.filter((s) => s.type === 'final');

    it('12 votes finaux récents, dont une motion de censure', () => {
      const motions = donnees.scrutins.filter((s) => s.type === 'motion');
      expect(finals().length + 1).toBeGreaterThanOrEqual(12);
      expect(motions.length).toBeGreaterThanOrEqual(1);
      expect(finals().filter((s) => s.date >= '2026-01-01').length).toBeGreaterThanOrEqual(6);
    });

    it('un texte voté en plusieurs lectures', () => {
      const parDossier = new Map<string, number>();
      for (const s of finals())
        if (s.dossier) parDossier.set(s.dossier, (parDossier.get(s.dossier) ?? 0) + 1);
      expect([...parDossier.values()].some((n) => n >= 2)).toBe(true);
    });

    it('un vote « article unique » compté comme final, et des votes finaux sans dossier', () => {
      expect(finals().some((s) => /^l'article unique\b/.test(s.titre))).toBe(true);
      expect(finals().some((s) => s.dossier === null)).toBe(true);
    });

    it('au moins 6 amendements ou articles', () => {
      expect(
        donnees.scrutins.filter((s) => s.type === 'amendement' || s.type === 'article').length,
      ).toBeGreaterThanOrEqual(6);
    });

    it('les deux organes « UDR » et le groupe des non-inscrits', () => {
      expect(donnees.groupes.filter((g) => g.abrege === 'UDR')).toHaveLength(2);
      expect(donnees.groupes.some((g) => g.abrege === 'NI')).toBe(true);
      expect(donnees.groupes.length).toBe(13);
    });

    it('des entrées « PO0 » rattachées à leur vrai groupe, et aucun « PO0 » dans les groupes', () => {
      expect(donnees.meta.statistiques.groupesRattaches).toBeGreaterThan(0);
      expect(donnees.groupes.some((g) => g.id === 'PO0')).toBe(false);
    });

    it("des députés actifs et d'anciens députés", () => {
      expect(donnees.deputes.some((d) => d.actif)).toBe(true);
      expect(donnees.deputes.some((d) => !d.actif)).toBe(true);
    });

    it('un député qui change de groupe, avec ses groupes du jour du vote', () => {
      const changeurs = donnees.deputes.filter(
        (_, c) => new Set(donnees.groupesVotes.map((l) => l[c]).filter((x) => x !== '-')).size > 1,
      );
      expect(changeurs.length).toBeGreaterThan(0);
    });

    it('des homonymes aux slugs distincts', () => {
      const martin = donnees.deputes.filter(
        (d) => d.nomTri === 'Martin' && d.nom.startsWith('Alexandra'),
      );
      expect(martin.map((d) => d.slug)).toEqual([
        'alexandra-martin-alpes-maritimes',
        'alexandra-martin-gironde',
      ]);
    });

    it('des députés absents (X) et des députés pas encore en mandat (-)', () => {
      const cellules = new Set(donnees.votes.join(''));
      expect(cellules.has('X') && cellules.has('-') && cellules.has('N')).toBe(true);
    });

    it('un scrutin dont les non-votants officiels ne correspondent pas aux groupes (corrigé)', () => {
      expect(donnees.meta.statistiques.nonVotantsCorriges).toEqual([1]);
    });
  });

  describe('fiche des députés', () => {
    const chenu = () => donnees.deputes.find((d) => d.slug === 'sebastien-chenu')!;

    it('Sébastien Chenu : naissance, profession, mandats, groupes, fonctions, parti et liens réels', () => {
      expect(chenu()).toMatchObject({
        naissance: { date: '1973-04-13', lieu: 'Beauvais' },
        profession: 'Conseiller en communication',
        mandat: { depuis: '2024-06-30', fin: null, legislatures: [15, 16, 17] },
        parti: 'Rassemblement national',
        liens: {
          hatvp: 'https://www.hatvp.fr/pages_nominatives/chenu-sebastien',
          wikipedia: 'https://fr.wikipedia.org/wiki/S%C3%A9bastien_Chenu',
        },
      });
      expect(chenu().fonctions).toEqual([
        {
          organe: "Bureau de l'Assemblée nationale",
          qualite: "Vice-président de l'Assemblée nationale",
          depuis: '2025-10-01',
        },
        { organe: 'Commission des affaires étrangères', qualite: 'Membre', depuis: '2024-07-20' },
      ]);
      expect(chenu().groupes).toEqual([
        { id: 'PO840056', debut: '2024-07-01', fin: '2024-07-18' },
        { id: 'PO845401', debut: '2024-07-19', fin: null },
      ]);
    });

    it("garde l'historique d'un groupe que ne liste aucun scrutin (AD) dans meta.autresGroupes", () => {
      expect(donnees.meta.autresGroupes.map((g) => g.abrege)).toEqual(['AD']);
      expect(donnees.deputes.some((d) => d.groupes.some((g) => g.id === 'PO845520'))).toBe(true);
    });

    it('mesure la couverture des sources, pour les députés en mandat et pour tous', () => {
      const { actifs, tous } = donnees.meta.statistiques.couverture;
      expect(tous.deputes).toBe(donnees.deputes.length);
      expect(actifs.deputes).toBe(donnees.deputes.filter((d) => d.actif).length);
      expect(tous.wikipedia).toBe(donnees.deputes.length);
      expect(actifs.hatvp).toBeLessThanOrEqual(actifs.deputes);
      // Aucun ancien député n'a d'adresse HATVP dans l'archive.
      expect(tous.hatvp).toBe(actifs.hatvp);
      expect(tous.profession).toBe(tous.deputes);
      expect(tous.naissance).toBe(tous.deputes);
      expect(journal.filter((m) => m.includes('couverture'))).toHaveLength(2);
    });

    it('ne signale aucun avertissement avec les fixtures, qui ont leur extrait de Wikidata', () => {
      expect(donnees.meta.avertissements).toEqual([]);
    });

    it('ne publie ni téléphone, ni e-mail, ni adresse postale', () => {
      const texte = readFileSync(join(sortie, 'data', 'deputes.json'), 'utf8');
      expect(texte).not.toMatch(
        /@assemblee-nationale\.fr|\b0[1-9]([ .]?\d{2}){4}\b|Rue de l'Université/,
      );
    });
  });
});

describe('npm run donnees, échecs', () => {
  it('échoue clairement sur une source inconnue', async () => {
    await expect(
      executer({ env: { DONNEES_DEPUIS: 'ailleurs' }, journal: silence }),
    ).rejects.toThrow(/source inconnue/);
  });

  it("n'écrit rien quand les fixtures sont introuvables", async () => {
    const sortie = mkdtempSync(join(tmpdir(), 'donnees-vide-'));
    try {
      await expect(
        executer({
          env: { DONNEES_DEPUIS: 'fixtures' },
          fixtures: join(sortie, 'absent'),
          destination: join(sortie, 'data'),
          journal: silence,
        }),
      ).rejects.toThrow(/fixtures introuvables/);
      expect(readdirSync(sortie)).toEqual([]);
    } finally {
      rmSync(sortie, { recursive: true, force: true });
    }
  });

  it('construit sans les liens Wikipédia quand Wikidata manque : avertissement dans meta.json et dans le journal', async () => {
    const racine = mkdtempSync(join(tmpdir(), 'donnees-sans-wikidata-'));
    try {
      const fixtures = join(racine, 'fixtures');
      cpSync(join('src', 'server', 'fixtures', 'officiel'), fixtures, { recursive: true });
      rmSync(join(fixtures, 'wikidata.json'));
      const journal: string[] = [];

      const resultat = await executer({
        env: { DONNEES_DEPUIS: 'fixtures' },
        fixtures,
        destination: join(racine, 'data'),
        journal: (m) => journal.push(m),
        maintenant: new Date('2026-10-19T05:41:02Z'),
      });

      expect(resultat.meta.avertissements).toEqual(['wikipedia']);
      expect(
        JSON.parse(readFileSync(join(racine, 'data', 'meta.json'), 'utf8')).avertissements,
      ).toEqual(['wikipedia']);
      expect(
        resultat.deputes.every(
          (d: { liens: { wikipedia: string | null } }) => d.liens.wikipedia === null,
        ),
      ).toBe(true);
      expect(resultat.deputes.some((d: { liens: { hatvp: string | null } }) => d.liens.hatvp)).toBe(
        true,
      );
      expect(journal.some((m) => m.includes('AVERTISSEMENT : liens Wikipédia indisponibles'))).toBe(
        true,
      );
      expect(journal.some((m) => m.includes('avertissements : wikipedia'))).toBe(true);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("applique les seuils du plan aux archives officielles (pas aux fixtures) et n'écrit rien", async () => {
    const fixtures = join('src', 'server', 'fixtures', 'officiel');
    const zip = (accepte: (nom: string) => boolean) => {
      const fichiers: Record<string, Uint8Array> = {
        'remplissage.bin': new Uint8Array(TAILLE_MINIMALE + 10),
      };
      for (const [nom, octets] of entreesDossier(fixtures, accepte)) fichiers[nom] = octets;
      return zipSync(fichiers, { level: 0 });
    };
    const scrutins = zip(estScrutin);
    const acteurs = zip((nom) => estActeur(nom) || estOrgane(nom));
    const requete = async (url: string) =>
      new Response((url === URL_SCRUTINS ? scrutins : acteurs) as BodyInit, {
        status: 200,
        headers: { etag: '"x"' },
      });

    const racine = mkdtempSync(join(tmpdir(), 'donnees-seuils-'));
    try {
      await expect(
        executer({
          env: { DONNEES_DEPUIS: 'officiel' },
          cache: join(racine, 'cache'),
          destination: join(racine, 'data'),
          fetch: requete as never,
          pausesWikidata: [],
          journal: silence,
        }),
      ).rejects.toThrow(/garde-fou : 19 scrutins lus, au moins 8000 attendus/);
      expect(readdirSync(racine)).toEqual(['cache']);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
