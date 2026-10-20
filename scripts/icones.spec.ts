// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FICHIERS_PUBLICS } from '../src/server/en-tetes';
import { APPLE, PNG, TAILLES_ICO, ecrireIco } from './icones.mjs';

// Icônes du site (voir docs/ICONE.md) : formats, tailles, déclarations dans index.html et manifeste.
const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const racine = process.cwd();
const lirePublic = (nom: string) => readFileSync(join(racine, 'public', nom));

/** Largeur, hauteur et type de couleur lus dans le bloc IHDR d'un PNG (contrôle aussi la signature). */
function entetePng(png: Buffer) {
  expect(png.subarray(0, 8).equals(SIGNATURE_PNG)).toBe(true);
  expect(png.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { largeur: png.readUInt32BE(16), hauteur: png.readUInt32BE(20), couleur: png[25] };
}

describe('favicon.ico', () => {
  const ico = lirePublic('favicon.ico');

  it("a un en-tête d'icône avec les entrées 16, 32 et 48 px", () => {
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(TAILLES_ICO.length);
    expect(TAILLES_ICO).toEqual([16, 32, 48]);
    const tailles = TAILLES_ICO.map((_, i) => ico[6 + 16 * i]);
    expect(tailles).toEqual([16, 32, 48]);
  });

  it.each(TAILLES_ICO.map((t, i) => [t, i] as const))(
    "l'entrée %i px pointe sur un PNG de cette taille, sans trou ni recouvrement",
    (taille, i) => {
      const entree = 6 + 16 * i;
      expect(ico[entree]).toBe(taille);
      expect(ico[entree + 1]).toBe(taille);
      expect(ico.readUInt16LE(entree + 4)).toBe(1); // plans
      expect(ico.readUInt16LE(entree + 6)).toBe(32); // bits par pixel
      const longueur = ico.readUInt32LE(entree + 8);
      const decalage = ico.readUInt32LE(entree + 12);
      expect(decalage + longueur).toBeLessThanOrEqual(ico.length);
      const png = ico.subarray(decalage, decalage + longueur);
      expect(entetePng(png)).toMatchObject({ largeur: taille, hauteur: taille });
    },
  );

  it('se termine avec la dernière image', () => {
    const derniere = 6 + 16 * (TAILLES_ICO.length - 1);
    expect(ico.readUInt32LE(derniere + 12) + ico.readUInt32LE(derniere + 8)).toBe(ico.length);
  });
});

describe('ecrireIco', () => {
  it('range les images dans l’ordre, avec 0 pour 256 px', () => {
    const a = Buffer.from('a'.repeat(10));
    const b = Buffer.from('b'.repeat(7));
    const ico = ecrireIco([
      { taille: 16, png: a },
      { taille: 256, png: b },
    ]);

    expect(ico.length).toBe(6 + 32 + 17);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[22]).toBe(0);
    expect(ico.readUInt32LE(6 + 12)).toBe(38);
    expect(ico.readUInt32LE(22 + 12)).toBe(48);
    expect(ico.subarray(38, 48).equals(a)).toBe(true);
    expect(ico.subarray(48).equals(b)).toBe(true);
  });
});

describe('PNG', () => {
  it.each([...PNG, APPLE].map((p) => [p.fichier, p.taille] as const))(
    '%s est un PNG carré de %i px',
    (fichier, taille) => {
      expect(entetePng(lirePublic(fichier))).toMatchObject({ largeur: taille, hauteur: taille });
    },
  );

  it('apple-touch-icon fait 180 px, icon-192 et icon-512 les tailles du manifeste', () => {
    expect(APPLE).toEqual({ fichier: 'apple-touch-icon.png', taille: 180 });
    expect(PNG.map((p) => p.taille)).toEqual([48, 192, 512]);
  });
});

describe('favicon.svg', () => {
  const svg = lirePublic('favicon.svg').toString('utf8');

  it('est un dessin carré, sans texte ni dépendance au thème du système', () => {
    const [, x, y, largeur, hauteur] = /viewBox="(\S+) (\S+) (\S+) (\S+)"/.exec(svg) ?? [];
    expect(largeur).toBe(hauteur);
    expect([x, y]).toEqual(['0', '0']);
    expect(svg).not.toMatch(/<text|prefers-color-scheme|<image|href=/);
  });

  it('utilise les couleurs de Fuda (thème Jour) documentées dans docs/ICONE.md', () => {
    const doc = readFileSync(join(racine, 'docs', 'ICONE.md'), 'utf8');
    for (const couleur of new Set(svg.match(/#[0-9A-Fa-f]{6}/g))) {
      expect(doc.toUpperCase(), couleur).toContain(couleur.toUpperCase());
    }
  });
});

describe('site.webmanifest', () => {
  const manifeste = JSON.parse(lirePublic('site.webmanifest').toString('utf8'));
  const html = readFileSync(join(racine, 'src', 'index.html'), 'utf8');

  it('nomme le site en français', () => {
    expect(manifeste.name).toBe('Qui a voté quoi ?');
    expect(manifeste.short_name).toBeTruthy();
    expect(manifeste.lang).toBe('fr');
    expect(manifeste.start_url).toBe('/');
  });

  it('a les mêmes couleurs que la balise theme-color de index.html', () => {
    const themes = [...html.matchAll(/<meta\s+name="theme-color"\s+content="([^"]+)"/g)];
    expect(themes).toHaveLength(1);
    expect(manifeste.theme_color).toBe(themes[0][1]);
    expect(manifeste.background_color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('ne cite que des icônes qui existent, à la taille annoncée', () => {
    expect(manifeste.icons.length).toBeGreaterThan(0);
    for (const icone of manifeste.icons as { src: string; sizes: string; type: string }[]) {
      expect(icone.src.startsWith('/'), icone.src).toBe(true);
      const fichier = join(racine, 'public', icone.src.slice(1));
      expect(existsSync(fichier), icone.src).toBe(true);
      if (icone.type === 'image/png') {
        const { largeur, hauteur } = entetePng(readFileSync(fichier));
        expect(icone.sizes).toBe(`${largeur}x${hauteur}`);
      }
    }
  });
});

describe('index.html', () => {
  const html = readFileSync(join(racine, 'src', 'index.html'), 'utf8');
  const liens = [...html.matchAll(/<link\s+([^>]*)>/g)].map(([, attributs]) => ({
    rel: /rel="([^"]+)"/.exec(attributs)?.[1],
    href: /href="([^"]+)"/.exec(attributs)?.[1],
    sizes: /sizes="([^"]+)"/.exec(attributs)?.[1],
  }));

  it('déclare le favicon (ICO 48 px, SVG), l’icône iOS et le manifeste', () => {
    const icones = liens.filter((l) => l.rel === 'icon');
    expect(icones).toContainEqual({ rel: 'icon', href: '/favicon.ico', sizes: '48x48' });
    expect(icones).toContainEqual({ rel: 'icon', href: '/favicon.svg', sizes: 'any' });
    expect(liens).toContainEqual({
      rel: 'apple-touch-icon',
      href: '/apple-touch-icon.png',
      sizes: undefined,
    });
    expect(liens.find((l) => l.rel === 'manifest')?.href).toBe('/site.webmanifest');
  });

  it('ne cite que des fichiers présents dans public/', () => {
    const cites = liens
      .filter((l) => ['icon', 'apple-touch-icon', 'manifest'].includes(l.rel ?? ''))
      .map((l) => l.href ?? '');
    expect(cites.length).toBeGreaterThanOrEqual(4);
    for (const href of cites) {
      expect(href.startsWith('/'), href).toBe(true);
      expect(existsSync(join(racine, 'public', href.slice(1))), href).toBe(true);
    }
  });
});

describe('public/ et build', () => {
  it('ne contient que les fichiers que le serveur sait cacher un jour (FICHIERS_PUBLICS)', () => {
    expect(readdirSync(join(racine, 'public')).sort()).toEqual([...FICHIERS_PUBLICS].sort());
  });

  it('est copié à la racine du build par angular.json', () => {
    const angular = JSON.parse(readFileSync(join(racine, 'angular.json'), 'utf8'));
    expect(angular.projects['lois-votes'].architect.build.options.assets).toContainEqual({
      glob: '**/*',
      input: 'public',
    });
  });

  it('a un en-tête Cache-Control Vercel pour chacun de ses fichiers', () => {
    const vercel = JSON.parse(readFileSync(join(racine, 'vercel.json'), 'utf8'));
    const regle = vercel.headers.find((h: { headers: { key: string }[] }) =>
      h.headers.some((e) => e.key === 'Cache-Control'),
    );
    expect(regle.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=86400' });
    const source = new RegExp(`^${regle.source}$`);
    for (const fichier of FICHIERS_PUBLICS) expect(source.test(`/${fichier}`), fichier).toBe(true);
    expect(source.test('/main-ABC.js')).toBe(false);
  });
});
