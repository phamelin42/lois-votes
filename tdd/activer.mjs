#!/usr/bin/env node
// Déplace les tests d'une tâche de tdd/<tâche>/ vers leur emplacement définitif dans le dépôt.
// Usage : node tdd/activer.mjs 02-bff [03-donnees ...]
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tdd = dirname(fileURLToPath(import.meta.url));
const racine = resolve(tdd, '..');
const taches = process.argv.slice(2);
if (taches.length === 0) {
  console.error('Usage : node tdd/activer.mjs <tâche> [...]\nTâches : ' + readdirSync(tdd).filter((n) => /^\d\d-/.test(n)).join(', '));
  process.exit(1);
}
for (const tache of taches) {
  const source = join(tdd, tache);
  if (!existsSync(source)) {
    console.error(`Tâche inconnue : ${tache}`);
    process.exit(1);
  }
  cpSync(source, racine, { recursive: true, force: true });
  rmSync(source, { recursive: true, force: true });
  console.log(`Tests activés : ${tache}`);
}
