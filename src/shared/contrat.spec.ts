import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// docs/CONTRAT.md est la source unique : src/shared/contrat.ts en est la copie exacte (au formatage près).
const racine = process.cwd();

function blocTypeScript(markdown: string): string {
  const m = /```ts\n([\s\S]*?)\n```/.exec(markdown);
  if (!m) throw new Error('aucun bloc ```ts dans docs/CONTRAT.md');
  return m[1];
}

/** Retire commentaires et espaces : seule la structure des types compte. */
function structure(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, '')
    .replace(/[,;]/g, '');
}

describe('contrat BFF ↔ application', () => {
  const doc = blocTypeScript(readFileSync(join(racine, 'docs/CONTRAT.md'), 'utf8'));
  const code = readFileSync(join(racine, 'src/shared/contrat.ts'), 'utf8');

  it('src/shared/contrat.ts reprend exactement les types de docs/CONTRAT.md', () => {
    expect(structure(code)).toBe(structure(doc));
  });

  it.each([
    'Position',
    'PositionGroupe',
    'TypeScrutin',
    'Compte',
    'Groupe',
    'VoteGroupe',
    'ScrutinResume',
    'LoiCarte',
    'Accueil',
    'LoiDetail',
    'DeputeMini',
    'ScrutinDetail',
    'DeputeIndex',
    'DeputeListe',
    'VoteDepute',
    'DeputeDetail',
  ])('exporte %s', (nom) => {
    expect(code).toMatch(new RegExp(`export (type|interface) ${nom}\\b`));
  });
});
