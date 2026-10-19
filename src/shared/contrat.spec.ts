/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('contrat', () => {
  it('src/shared/contrat.ts est la copie exacte du bloc TypeScript de docs/CONTRAT.md', () => {
    const racine = process.cwd();
    const doc = readFileSync(join(racine, 'docs/CONTRAT.md'), 'utf8');
    const bloc = /```ts\n([\s\S]*?)\n```/.exec(doc)?.[1];
    const source = readFileSync(join(racine, 'src/shared/contrat.ts'), 'utf8');

    expect(bloc).toBeDefined();
    expect(source.trimEnd()).toBe(bloc);
  });
});
