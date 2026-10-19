// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ErreurDonnees, chargerDonnees, decrireChargement, dossierDonnees } from './donnees';
import { GENERE_LE, produireDonneesDeTest, type DonneesDeTest } from './testing/donnees';

describe('donnees.ts', () => {
  let jeu: DonneesDeTest;
  beforeAll(async () => {
    jeu = await produireDonneesDeTest();
  });
  afterAll(() => jeu.nettoyer());

  describe('données valides (fixtures)', () => {
    it('charge les six fichiers et expose les effectifs', () => {
      const d = jeu.donnees;

      expect(d.meta.genereLe).toBe(GENERE_LE);
      expect(d.nbScrutins).toBe(19);
      expect(d.nbDeputes).toBe(97);
      expect(d.groupes).toHaveLength(13);
    });

    it("relit un scrutin tel qu'il est dans scrutins.json (numéro décroissant, comptes, groupes)", () => {
      const d = jeu.donnees;
      const fichier = JSON.parse(readFileSync(join(jeu.dossier, 'scrutins.json'), 'utf8')) as {
        n: number;
        date: string;
        titre: string;
        type: string;
        adopte: boolean;
        dossier: string | null;
        compte: unknown;
        groupes: unknown[];
      }[];

      fichier.forEach((attendu, s) => {
        expect(d.numero(s)).toBe(attendu.n);
        expect(d.date(s)).toBe(attendu.date);
        expect(d.titre(s)).toBe(attendu.titre);
        expect(d.type(s)).toBe(attendu.type);
        expect(d.adopte(s)).toBe(attendu.adopte);
        expect(d.dossier(s)).toBe(attendu.dossier);
        expect(d.compte(s)).toEqual(attendu.compte);
        expect(d.groupesDuScrutin(s)).toEqual(attendu.groupes);
        expect(d.parNumero.get(attendu.n)).toBe(s);
      });
    });

    it('indexe les scrutins par dossier, du plus récent au plus ancien', () => {
      const d = jeu.donnees;
      const dossier = d.parDossier.get('DLR5L17N53980') ?? [];

      expect(dossier.map((s) => d.numero(s))).toEqual([8433, 8279, 8278, 8259]);
    });

    it('lit les matrices : une case et un groupe par député et par scrutin', () => {
      const d = jeu.donnees;
      const lignes = readFileSync(join(jeu.dossier, 'votes.txt'), 'utf8').split('\n');
      const groupes = readFileSync(join(jeu.dossier, 'groupes-votes.txt'), 'utf8').split('\n');

      for (let s = 0; s < d.nbScrutins; s++) {
        for (let p = 0; p < d.nbDeputes; p++) {
          expect(d.caseVote(s, p)).toBe(lignes[s][p]);
          const caractere = groupes[s][p];
          expect(d.groupeAuVote(s, p)).toBe(
            caractere === '-' ? -1 : '0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(caractere),
          );
        }
      }
    });

    it("retrouve la position d'un groupe, ou null s'il ne figure pas au scrutin", () => {
      const d = jeu.donnees;
      const [premier] = d.groupesDuScrutin(0);

      expect(d.positionDuGroupe(0, premier.g)).toBe(premier.position);
      expect(d.positionDuGroupe(0, 99)).toBeNull();
    });

    it('trie les scrutins par date puis numéro décroissants', () => {
      const d = jeu.donnees;
      const cles = d.ordreRecent.map((s) => `${d.date(s)}|${String(d.numero(s)).padStart(6, '0')}`);

      expect(cles).toEqual([...cles].sort().reverse());
    });

    it('mesure le chargement', () => {
      const m = jeu.donnees.mesures;

      expect(m.dureeMs).toBeGreaterThan(0);
      expect(m.rss).toBeGreaterThan(0);
      expect(decrireChargement(jeu.donnees)).toMatch(
        /19 scrutins, 97 députés, 13 groupes .* en \d+ ms/,
      );
    });
  });

  describe('données absentes ou invalides', () => {
    let copie: string;
    beforeEach(() => {
      copie = mkdtempSync(join(tmpdir(), 'serveur-donnees-copie-'));
      cpSync(jeu.dossier, copie, { recursive: true });
    });
    afterEach(() => rmSync(copie, { recursive: true, force: true }));

    const modifier = (fichier: string, f: (contenu: string) => string) =>
      writeFileSync(join(copie, fichier), f(readFileSync(join(copie, fichier), 'utf8')));

    it('lève une erreur claire quand le dossier est introuvable', () => {
      expect(() => chargerDonnees(join(copie, 'absent'))).toThrow(ErreurDonnees);
      expect(() => chargerDonnees(join(copie, 'absent'))).toThrow(
        /fichier manquant : .*meta\.json/,
      );
    });

    it.each([
      'meta.json',
      'groupes.json',
      'deputes.json',
      'scrutins.json',
      'votes.txt',
      'groupes-votes.txt',
    ])('lève une erreur quand %s manque', (fichier) => {
      rmSync(join(copie, fichier));

      expect(() => chargerDonnees(copie)).toThrow(
        new RegExp(`fichier manquant : .*${fichier.replace('.', '\\.')}`),
      );
    });

    it('lève une erreur sur un JSON illisible', () => {
      modifier('scrutins.json', (c) => c.slice(0, c.length - 10));

      expect(() => chargerDonnees(copie)).toThrow(/scrutins\.json : JSON invalide/);
    });

    it('refuse des effectifs de meta.json différents des fichiers', () => {
      modifier('meta.json', (c) => c.replace('"scrutins":19', '"scrutins":20'));

      expect(() => chargerDonnees(copie)).toThrow(/meta\.json : effectifs/);
    });

    it('refuse une matrice dont le nombre de lignes diffère du nombre de scrutins', () => {
      modifier('votes.txt', (c) => c.slice(0, c.lastIndexOf('\n')));

      expect(() => chargerDonnees(copie)).toThrow(
        /votes\.txt : .* octets pour 19 scrutins × 97 députés/,
      );
    });

    it("refuse une ligne qui n'a pas autant de caractères que de députés", () => {
      modifier('votes.txt', (c) => c.replace('\n', 'P\n').slice(0, -1));

      expect(() => chargerDonnees(copie)).toThrow(/votes\.txt : la ligne 1 n'a pas 97 caractères/);
    });

    it('refuse un caractère de vote inconnu', () => {
      modifier('votes.txt', (c) => `Z${c.slice(1)}`);

      expect(() => chargerDonnees(copie)).toThrow(/votes\.txt : caractère inconnu/);
    });

    it('refuse un groupe inconnu dans groupes-votes.txt pour un député qui a voté', () => {
      modifier('votes.txt', (c) => `P${c.slice(1)}`);
      modifier('groupes-votes.txt', (c) => `-${c.slice(1)}`);

      expect(() => chargerDonnees(copie)).toThrow(/groupes-votes\.txt : groupe inconnu/);
    });

    it('refuse un scrutin dont la somme des groupes diffère du décompte', () => {
      modifier('scrutins.json', (c) => c.replace('"compte":{"pour":4,', '"compte":{"pour":5,'));

      expect(() => chargerDonnees(copie)).toThrow(/la somme des groupes diffère du décompte/);
    });

    it('refuse des scrutins qui ne sont pas triés par numéro décroissant', () => {
      modifier('scrutins.json', (c) => {
        const scrutins = JSON.parse(c) as unknown[];
        return JSON.stringify(scrutins.reverse());
      });

      expect(() => chargerDonnees(copie)).toThrow(/ordre décroissant/);
    });

    it('refuse un député dont le groupe est inconnu', () => {
      modifier('deputes.json', (c) => c.replace('"groupe":"PO845419"', '"groupe":"PO0"'));

      expect(() => chargerDonnees(copie)).toThrow(/deputes\.json : groupe de /);
    });
  });

  describe('dossierDonnees', () => {
    it('préfère DONNEES_DIR au dossier par défaut', () => {
      expect(dossierDonnees({ DONNEES_DIR: '/ailleurs' }, '/defaut')).toBe('/ailleurs');
      expect(dossierDonnees({}, '/defaut')).toBe('/defaut');
      expect(dossierDonnees({ DONNEES_DIR: '' }, '/defaut')).toBe('/defaut');
    });
  });
});
