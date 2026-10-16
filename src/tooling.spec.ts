import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Garde-fous du squelette : outils, budgets, polices latines, thème sans flash, versions épinglées.
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8');
const json = (chemin: string) => JSON.parse(lire(chemin));

describe('outillage du dépôt', () => {
  const paquet = json('package.json');

  it('nomme le projet lois-votes et exige Node ≥ 22.22.3', () => {
    expect(paquet.name).toBe('lois-votes');
    expect(paquet.engines.node).toBe('>=22.22.3');
    expect(lire('.nvmrc').trim()).toBe('24');
  });

  it.each(['start', 'build', 'test', 'lint', 'typecheck', 'serve:ssr'])(
    'a le script npm « %s »',
    (script) => {
      expect(paquet.scripts[script], script).toBeTruthy();
    },
  );

  it("typecheck couvre l'app, le serveur et les specs", () => {
    expect(paquet.scripts.typecheck).toMatch(/tsc/);
    const tsconfigs = [
      lire('tsconfig.json'),
      existsSync(join(process.cwd(), 'tsconfig.spec.json')) ? lire('tsconfig.spec.json') : '',
    ].join('\n');
    expect(tsconfigs).toContain('src/server');
    expect(tsconfigs).toContain('allowJs');
  });

  it('installe Fuda depuis GitHub, épinglée sur un commit', () => {
    expect(paquet.dependencies.fuda).toMatch(
      /^github:phamelin42\/design-system-fuda#[0-9a-f]{40}$/,
    );
    expect(paquet.dependencies['@angular/cdk']).toBeDefined();
    expect(paquet.dependencies['@fontsource/dela-gothic-one']).toBeDefined();
    expect(paquet.dependencies['@fontsource/zen-maru-gothic']).toBeDefined();
  });

  it('est en Angular 22 avec SSR', () => {
    expect(paquet.dependencies['@angular/core']).toMatch(/^[~^]?22\./);
    expect(paquet.dependencies['@angular/ssr']).toMatch(/^[~^]?22\./);
  });

  it('fixe les budgets en erreur : initial ≤ 300 Ko brut (Angular 22 + routeur + hydratation ne tiennent pas dans 150 Ko), styles de composant ≤ 4 Ko', () => {
    const angular = json('angular.json');
    const projet = Object.values(angular.projects)[0] as {
      architect: {
        build: {
          options?: { budgets?: unknown[] };
          configurations?: { production?: { budgets?: unknown[] } };
        };
      };
    };
    const budgets = (projet.architect.build.configurations?.production?.budgets ??
      projet.architect.build.options?.budgets ??
      []) as {
      type: string;
      maximumError?: string;
    }[];
    const initial = budgets.find((b) => b.type === 'initial');
    const composant = budgets.find((b) => b.type === 'anyComponentStyle');

    expect(initial?.maximumError).toMatch(/^300(\.0)?(kB|kb|KB)$/i);
    expect(composant?.maximumError).toMatch(/^4(\.0)?(kB|kb|KB)$/i);
  });

  it("sert l'application en SSR en mode serveur", () => {
    const angular = json('angular.json');
    const projet = Object.values(angular.projects)[0] as {
      architect: { build: { options: { outputMode?: string; ssr?: unknown; server?: string } } };
    };

    expect(projet.architect.build.options.outputMode).toBe('server');
    expect(
      projet.architect.build.options.ssr ?? projet.architect.build.options.server,
    ).toBeTruthy();
  });

  it('contient les fichiers racine attendus', () => {
    for (const fichier of [
      'CLAUDE.md',
      'README.md',
      '.gitignore',
      '.editorconfig',
      '.nvmrc',
      'eslint.config.js',
    ]) {
      expect(existsSync(join(process.cwd(), fichier)), fichier).toBe(true);
    }
  });
});

describe('index.html et styles', () => {
  const html = () => lire('src/index.html');
  const styles = () => lire('src/styles.scss');

  it('déclare le français', () => {
    expect(html()).toMatch(/<html[^>]*\blang="fr"/);
  });

  it('précharge la police du texte (latin 500)', () => {
    expect(html()).toMatch(/<link[^>]+rel="preload"[^>]+as="font"[^>]*>/);
    expect(html()).toContain('latin-500');
  });

  it('pose le thème sombre avant le rendu, dans un try/catch', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html())?.[1] ?? '';

    expect(script).toContain("localStorage['fuda-theme']");
    expect(script).toContain('data-theme');
    expect(script).toMatch(/try\s*\{[\s\S]*\}\s*catch/);
  });

  it('charge Fuda puis seulement les polices latines', () => {
    expect(styles()).toContain('fuda/styles/fuda.css');
    expect(styles()).toContain('@fontsource/dela-gothic-one/latin-400.css');
    expect(styles()).toContain('@fontsource/zen-maru-gothic/latin-500.css');
    expect(styles()).toContain('@fontsource/zen-maru-gothic/latin-700.css');
    expect(styles()).not.toContain('fuda/styles/fonts.css');
  });
});
