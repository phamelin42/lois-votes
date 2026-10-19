import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Conventions du projet (voir CLAUDE.md et celles de Fuda), vérifiées sur tout le code de l'application.
// Chaque règle porte sur les fichiers existants : elle reste vraie à mesure que les pages arrivent.
const racine = process.cwd();

function fichiers(dossier: string, extensions: string[]): string[] {
  const chemin = join(racine, dossier);
  try {
    statSync(chemin);
  } catch {
    return [];
  }
  return readdirSync(chemin, { recursive: true, withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() && extensions.some((x) => e.name.endsWith(x)) && !e.name.endsWith('.spec.ts'),
    )
    .map((e) => join(e.parentPath, e.name));
}

const lire = (f: string) => readFileSync(f, 'utf8');
const nom = (f: string) => relative(racine, f);
const sansCommentaires = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ts = fichiers('src/app', ['.ts']).filter((f) => !f.includes('/testing/'));
const composants = ts.filter((f) => /@Component\(/.test(lire(f)));
const html = fichiers('src/app', ['.html']);
const scss = fichiers('src/app', ['.scss']);

describe('conventions Angular 22', () => {
  it.each([
    ['standalone: true', /standalone:\s*true/],
    ['NgModule', /@NgModule\(/],
    ['@Input()', /@Input\(/],
    ['@Output()', /@Output\(/],
    ['@HostBinding', /@HostBinding\(/],
    ['@HostListener', /@HostListener\(/],
    ['ngOnChanges', /ngOnChanges/],
    ['*ngIf', /\*ngIf/],
    ['*ngFor', /\*ngFor/],
  ])("n'utilise pas %s", (_nom, motif) => {
    const fautifs = [...ts, ...html].filter((f) => motif.test(sansCommentaires(lire(f)))).map(nom);
    expect(fautifs).toEqual([]);
  });

  it('chaque composant a son template et ses styles dans des fichiers séparés', () => {
    const fautifs = composants.filter((f) => {
      const code = lire(f);
      return (
        /\btemplate:\s*[`'"]/.test(code) ||
        /\bstyles:\s*[[`'"]/.test(code) ||
        !/templateUrl:/.test(code) ||
        !/styleUrl:/.test(code)
      );
    });
    expect(fautifs.map(nom)).toEqual([]);
  });

  it('chaque composant utilise ViewEncapsulation.None', () => {
    expect(composants.filter((f) => !/ViewEncapsulation\.None/.test(lire(f))).map(nom)).toEqual([]);
  });

  it('les sélecteurs de composants sont préfixés « app- »', () => {
    const fautifs = composants.filter((f) => {
      const selecteur = /selector:\s*'([^']+)'/.exec(lire(f))?.[1];
      return selecteur !== undefined && !/^app-/.test(selecteur);
    });
    expect(fautifs.map(nom)).toEqual([]);
  });

  it('utilise host: {} et inject() plutôt que les décorateurs et le constructeur', () => {
    const fautifs = ts.filter((f) =>
      /constructor\s*\(\s*(private|public|protected|readonly)\s/.test(lire(f)),
    );
    expect(fautifs.map(nom)).toEqual([]);
  });

  it('chaque @defer a son @placeholder', () => {
    const fautifs = html.filter((f) => {
      const code = lire(f);
      return (
        (code.match(/@defer\b/g)?.length ?? 0) !== (code.match(/@placeholder\b/g)?.length ?? 0)
      );
    });
    expect(fautifs.map(nom)).toEqual([]);
  });
});

describe('conventions de style (tokens Fuda uniquement)', () => {
  const regles: [string, RegExp][] = [
    ['couleur hexadécimale', /#[0-9a-fA-F]{3,8}\b/],
    ['couleur rgb/hsl/oklch', /\b(rgb|rgba|hsl|hsla|oklch)\s*\(/],
    ['longueur en px', /(?<![\w-])\d*\.?\d+px\b/],
    ['durée en dur', /(?<![\w.-])\d*\.?\d+(ms|s)\b(?!\w)/],
    ['courbe en dur', /\bcubic-bezier\s*\(/],
  ];

  it.each(regles)("aucune %s en dur dans les .scss de l'application", (_nom, motif) => {
    const fautifs = scss.flatMap((f) =>
      lire(f)
        .split('\n')
        .map((ligne, i) => ({ f, ligne, i }))
        .filter(
          ({ ligne }) =>
            !ligne.includes('exception:') &&
            !/^\s*(\/\/|\*|\/\*)/.test(ligne) &&
            !ligne.includes('@media'),
        )
        .filter(({ ligne }) => motif.test(ligne))
        .map(({ f, i }) => `${nom(f)}:${i + 1}`),
    );
    expect(fautifs).toEqual([]);
  });

  it("n'utilise jamais prefers-color-scheme pour les couleurs (le thème Nuit est un choix explicite)", () => {
    expect(scss.filter((f) => /prefers-color-scheme/.test(lire(f))).map(nom)).toEqual([]);
  });

  it('chaque .scss de composant respecte le budget de 4 Ko', () => {
    expect(scss.filter((f) => statSync(f).size > 4096).map(nom)).toEqual([]);
  });
});

describe('règles du produit', () => {
  const textes = [...ts, ...html];

  it("n'écrit jamais « loi adoptée » : c'est « Adopté par l'Assemblée »", () => {
    expect(
      textes.filter((f) => /loi adopt[ée]e/i.test(sansCommentaires(lire(f)))).map(nom),
    ).toEqual([]);
  });

  it("n'écrit « présence » que dans la page À propos, qui explique pourquoi on dit « participation »", () => {
    const fautifs = textes.filter(
      (f) => !f.includes('a-propos') && /présence/i.test(sansCommentaires(lire(f))),
    );
    expect(fautifs.map(nom)).toEqual([]);
  });

  it("le navigateur n'appelle jamais directement un serveur externe (tout passe par /api)", () => {
    expect(textes.filter((f) => /fetch\(\s*['"`]https?:/.test(lire(f))).map(nom)).toEqual([]);
  });

  it('ne contient aucune clé ni secret', () => {
    expect(
      textes
        .filter((f) => /api[_-]?key|\bsecret\b|api[_-]?token/i.test(sansCommentaires(lire(f))))
        .map(nom),
    ).toEqual([]);
  });

  it("ne modifie pas Fuda : aucun fichier de l'application ne réécrit ses classes fd-* par composant", () => {
    const fautifs = scss.filter(
      (f) => /^\s*\.fd-[\w-]+\s*\{/m.test(lire(f)) && !f.includes('/ui/'),
    );
    expect(fautifs.map(nom)).toEqual([]);
  });
});
