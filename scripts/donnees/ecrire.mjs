// Écriture atomique du dossier `data/` : tout est écrit dans un dossier temporaire voisin, puis renommé.
// Un build interrompu laisse donc l'ancien `data/` intact (ou aucun), jamais un dossier à moitié écrit.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

/**
 * @param {string} destination Dossier à produire (`data`).
 * @param {Record<string, string>} fichiers Contenu des fichiers, par nom.
 */
export function ecrireAtomique(destination, fichiers) {
  const cible = resolve(destination);
  const parent = dirname(cible);
  mkdirSync(parent, { recursive: true });
  const temporaire = mkdtempSync(join(parent, `${basename(cible)}.tmp-`));
  try {
    for (const [nom, contenu] of Object.entries(fichiers))
      writeFileSync(join(temporaire, nom), contenu);
    chmodSync(temporaire, 0o755); // mkdtemp crée un dossier privé : le serveur peut tourner sous un autre utilisateur
    const ancien = existsSync(cible) ? `${cible}.old-${process.pid}` : null;
    if (ancien) renameSync(cible, ancien);
    try {
      renameSync(temporaire, cible);
    } catch (erreur) {
      if (ancien) renameSync(ancien, cible);
      throw erreur;
    }
    if (ancien) rmSync(ancien, { recursive: true, force: true });
  } catch (erreur) {
    rmSync(temporaire, { recursive: true, force: true });
    throw erreur;
  }
}
