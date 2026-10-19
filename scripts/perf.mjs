// Mesure Lighthouse (profil mobile) de trois pages du site construit sur le jeu de données de test (fixtures).
// Échoue si la performance ou l'accessibilité est sous le seuil. Usage : npm run perf (qui construit d'abord).

import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as attendre } from 'node:timers/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PORT_SITE = 4021;
const SEUIL = 95;
const PAGES = [
  { nom: 'accueil', chemin: '/' },
  { nom: 'loi', chemin: '/lois/DLR5L17N54445' },
  { nom: 'député', chemin: '/deputes/jerome-guedj' },
];

async function attendreSite(url) {
  for (let essai = 0; essai < 100; essai++) {
    try {
      await fetch(url);
      return;
    } catch {
      await attendre(200);
    }
  }
  throw new Error(`Le site ne répond pas sur ${url}`);
}

async function mesurer(url, nom, dossier) {
  const sortie = join(dossier, `${nom}.json`);
  await execFileAsync(
    process.execPath,
    [
      join('node_modules', 'lighthouse', 'cli', 'index.js'),
      url,
      '--output=json',
      `--output-path=${sortie}`,
      '--only-categories=performance,accessibility',
      '--chrome-flags=--headless=new --no-sandbox --font-render-hinting=none',
      '--quiet',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const rapport = JSON.parse(await readFile(sortie, 'utf8'));
  return {
    performance: rapport.categories.performance.score * 100,
    accessibilite: rapport.categories.accessibility.score * 100,
  };
}

const site = spawn(process.execPath, ['dist/lois-votes/server/server.mjs'], {
  env: {
    ...process.env,
    PORT: String(PORT_SITE),
    DONNEES_DIR: '',
    UMAMI_WEBSITE_ID: '',
  },
  stdio: 'inherit',
});

let echecs = 0;
let dossier;
try {
  await attendreSite(`http://localhost:${PORT_SITE}/a-propos`);
  dossier = await mkdtemp(join(tmpdir(), 'lighthouse-'));
  console.log(`Seuil : ${SEUIL} en performance et en accessibilité (profil mobile).\n`);
  for (const { nom, chemin } of PAGES) {
    const scores = await mesurer(`http://localhost:${PORT_SITE}${chemin}`, nom, dossier);
    const sousSeuil = Object.entries(scores).filter(([, score]) => score < SEUIL);
    echecs += sousSeuil.length;
    console.log(
      `${nom.padEnd(10)} ${chemin.padEnd(26)} performance ${scores.performance.toFixed(0)}  accessibilité ${scores.accessibilite.toFixed(0)}`,
    );
  }
} finally {
  site.kill();
  if (dossier) await rm(dossier, { recursive: true, force: true });
}

if (echecs > 0) {
  console.error(`\n${echecs} score(s) sous le seuil de ${SEUIL}.`);
  process.exit(1);
}
