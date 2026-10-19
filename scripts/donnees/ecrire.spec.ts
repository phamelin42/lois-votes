// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ecrireAtomique } from './ecrire.mjs';

describe('ecrireAtomique', () => {
  let racine: string;
  beforeEach(() => {
    racine = mkdtempSync(join(tmpdir(), 'donnees-ecrire-'));
  });
  afterEach(() => rmSync(racine, { recursive: true, force: true }));

  it('crée le dossier avec tous les fichiers, sans laisser de dossier temporaire', () => {
    const data = join(racine, 'data');
    ecrireAtomique(data, { 'a.json': '{"a":1}', 'b.txt': 'PCA' });
    expect(readdirSync(data).sort()).toEqual(['a.json', 'b.txt']);
    expect(readFileSync(join(data, 'b.txt'), 'utf8')).toBe('PCA');
    expect(readdirSync(racine)).toEqual(['data']);
  });

  it("remplace entièrement l'ancien dossier (un fichier disparu ne survit pas)", () => {
    const data = join(racine, 'data');
    mkdirSync(data);
    writeFileSync(join(data, 'ancien.json'), 'ancien');
    ecrireAtomique(data, { 'nouveau.json': 'nouveau' });
    expect(readdirSync(data)).toEqual(['nouveau.json']);
    expect(readdirSync(racine)).toEqual(['data']);
  });

  it('crée aussi les dossiers parents manquants', () => {
    const data = join(racine, 'a', 'b', 'data');
    ecrireAtomique(data, { 'x.json': '1' });
    expect(readFileSync(join(data, 'x.json'), 'utf8')).toBe('1');
  });

  it("laisse l'ancien dossier intact et nettoie le temporaire quand l'écriture échoue", () => {
    const data = join(racine, 'data');
    mkdirSync(data);
    writeFileSync(join(data, 'ancien.json'), 'ancien');
    expect(() =>
      ecrireAtomique(data, { 'bon.json': '1', 'sous/dossier-absent.json': '2' }),
    ).toThrow();
    expect(readdirSync(data)).toEqual(['ancien.json']);
    expect(readFileSync(join(data, 'ancien.json'), 'utf8')).toBe('ancien');
    expect(readdirSync(racine)).toEqual(['data']);
  });
});
