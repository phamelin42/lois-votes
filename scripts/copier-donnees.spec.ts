// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copier } from './copier-donnees.mjs';

const FICHIERS = [
  'meta.json',
  'groupes.json',
  'deputes.json',
  'scrutins.json',
  'votes.txt',
  'groupes-votes.txt',
];

describe('copier-donnees', () => {
  let racine: string;
  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'copier-donnees-'));
    mkdirSync(join(racine, 'data'));
    for (const nom of FICHIERS) writeFileSync(join(racine, 'data', nom), `contenu de ${nom}`);
    mkdirSync(join(racine, 'dist', 'lois-votes', 'browser'), { recursive: true });
  });
  afterEach(() => rmSync(racine, { recursive: true, force: true }));

  const options = () => ({
    depuis: join(racine, 'data'),
    vers: join(racine, 'dist', 'lois-votes', 'data'),
    build: join(racine, 'dist', 'lois-votes'),
  });

  it('copie les six fichiers dans le build, à côté de browser/', () => {
    copier(options());

    for (const nom of FICHIERS) {
      expect(readFileSync(join(racine, 'dist', 'lois-votes', 'data', nom), 'utf8')).toBe(
        `contenu de ${nom}`,
      );
    }
    expect(existsSync(join(racine, 'dist', 'lois-votes', 'browser', 'data'))).toBe(false);
  });

  it('remplace une copie précédente sans garder de fichier périmé', () => {
    copier(options());
    writeFileSync(join(racine, 'dist', 'lois-votes', 'data', 'ancien.txt'), 'périmé');

    copier(options());

    expect(existsSync(join(racine, 'dist', 'lois-votes', 'data', 'ancien.txt'))).toBe(false);
  });

  it('échoue clairement quand un fichier de données manque', () => {
    rmSync(join(racine, 'data', 'votes.txt'));

    expect(() => copier(options())).toThrow(/incomplet, il manque : votes\.txt/);
  });

  it("échoue clairement quand le build n'existe pas", () => {
    rmSync(join(racine, 'dist'), { recursive: true });

    expect(() => copier(options())).toThrow(/build introuvable/);
  });
});
