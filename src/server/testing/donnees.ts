import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chargerDonnees, type DonneesChargees } from '../donnees';
import { executer } from '../../../scripts/donnees/index.mjs';

/** Date de génération des données de test : fixe, pour des assertions stables. */
export const GENERE_LE = '2026-10-19T05:41:02Z';

export interface DonneesDeTest {
  /** Dossier `data/` produit à partir des fixtures officielles (`src/server/fixtures/officiel/`). */
  dossier: string;
  donnees: DonneesChargees;
  nettoyer(): void;
}

/** Produit `data/` en mode `fixtures` dans un dossier temporaire, puis le charge comme le fait le serveur. */
export async function produireDonneesDeTest(): Promise<DonneesDeTest> {
  const racine = mkdtempSync(join(tmpdir(), 'serveur-donnees-'));
  const dossier = join(racine, 'data');
  await executer({
    env: { DONNEES_DEPUIS: 'fixtures' },
    destination: dossier,
    journal: () => undefined,
    maintenant: new Date(GENERE_LE),
  });
  return {
    dossier,
    donnees: chargerDonnees(dossier),
    nettoyer: () => rmSync(racine, { recursive: true, force: true }),
  };
}
