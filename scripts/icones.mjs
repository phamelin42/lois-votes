// Génère les icônes du site à partir de public/favicon.svg (voir docs/ICONE.md). Usage : npm run icones.
// Rastérise avec le Chromium de Playwright (déjà installé, aucune dépendance en plus) et écrit le conteneur ICO à la main.
// Le résultat est versionné : le build de production ne génère rien. Deux exécutions donnent les mêmes octets.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(RACINE, 'public');

/** Fond opaque de l'icône iOS (token `surface` du thème Jour de Fuda) : iOS remplit en noir ce qui est transparent. */
const FOND_APPLE = '#FDF8F8';
/** Part de l'icône iOS occupée par la carte (le reste est de la marge, iOS arrondit lui-même les angles). */
const PART_CARTE_APPLE = 0.78;

/** Taille (px) des PNG écrits, et des entrées de l'ICO. */
export const TAILLES_ICO = [16, 32, 48];
export const PNG = [
  { fichier: 'icon-48.png', taille: 48 },
  { fichier: 'icon-192.png', taille: 192 },
  { fichier: 'icon-512.png', taille: 512 },
];
export const APPLE = { fichier: 'apple-touch-icon.png', taille: 180 };

/**
 * Conteneur ICO dont chaque image est un PNG (lu par tous les navigateurs actuels) :
 * en-tête de 6 octets, un répertoire de 16 octets par image, puis les images.
 * @param {{ taille: number, png: Buffer }[]} images
 */
export function ecrireIco(images) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // type : 1 = icône
  entete.writeUInt16LE(images.length, 4);

  let decalage = 6 + 16 * images.length;
  const repertoire = images.map(({ taille, png }) => {
    const entree = Buffer.alloc(16);
    entree.writeUInt8(taille >= 256 ? 0 : taille, 0); // largeur (0 = 256)
    entree.writeUInt8(taille >= 256 ? 0 : taille, 1); // hauteur
    entree.writeUInt8(0, 2); // nombre de couleurs (0 : pas de palette)
    entree.writeUInt8(0, 3); // réservé
    entree.writeUInt16LE(1, 4); // plans
    entree.writeUInt16LE(32, 6); // bits par pixel
    entree.writeUInt32LE(png.length, 8); // taille des données
    entree.writeUInt32LE(decalage, 12); // position des données
    decalage += png.length;
    return entree;
  });

  return Buffer.concat([entete, ...repertoire, ...images.map(({ png }) => png)]);
}

/** Rastérise une page HTML à `taille` × `taille` px, fond transparent (`omitBackground`). */
async function rasteriser(navigateur, html, taille) {
  const contexte = await navigateur.newContext({
    viewport: { width: taille, height: taille },
    deviceScaleFactor: 1,
  });
  try {
    const page = await contexte.newPage();
    await page.setContent(html);
    return await page.screenshot({ omitBackground: true, type: 'png' });
  } finally {
    await contexte.close();
  }
}

const page = (corps, fond = 'transparent') =>
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${fond};overflow:hidden}` +
  `svg,img{display:block}</style>${corps}`;

async function main() {
  // Importé ici : la spec de ce fichier n'a pas besoin de charger Playwright.
  const { chromium } = await import('@playwright/test');
  const svg = await readFile(join(PUBLIC, 'favicon.svg'), 'utf8');
  // Le SVG est en ligne dans la page, étiré à la taille voulue (viewBox conservé : le dessin est net à toute taille).
  const dessin = (taille) =>
    svg.replace('width="64" height="64"', `width="${taille}" height="${taille}"`);
  const navigateur = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--font-render-hinting=none'],
  });
  try {
    await mkdir(PUBLIC, { recursive: true });

    const pngIco = [];
    for (const taille of TAILLES_ICO) {
      pngIco.push({ taille, png: await rasteriser(navigateur, page(dessin(taille)), taille) });
    }
    await writeFile(join(PUBLIC, 'favicon.ico'), ecrireIco(pngIco));

    for (const { fichier, taille } of PNG) {
      const png =
        pngIco.find((p) => p.taille === taille)?.png ??
        (await rasteriser(navigateur, page(dessin(taille)), taille));
      await writeFile(join(PUBLIC, fichier), png);
    }

    // Icône iOS : opaque, la carte occupe PART_CARTE_APPLE du côté et reste centrée.
    const carte = Math.round(APPLE.taille * PART_CARTE_APPLE);
    const marge = (APPLE.taille - carte) / 2;
    const html = page(
      `<div style="position:absolute;left:${marge}px;top:${marge}px">${dessin(carte)}</div>`,
      FOND_APPLE,
    );
    await writeFile(join(PUBLIC, APPLE.fichier), await rasteriser(navigateur, html, APPLE.taille));
  } finally {
    await navigateur.close();
  }
  console.log(
    'Icônes écrites dans public/ (favicon.ico, icon-48/192/512.png, apple-touch-icon.png).',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
