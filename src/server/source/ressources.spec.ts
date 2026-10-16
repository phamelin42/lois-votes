import { lireRessources } from './ressources';

describe('ressources (rid des fichiers de data.gouv.fr)', () => {
  it('lit les rid depuis les variables d\'environnement', () => {
    const rids = lireRessources({
      RID_SCRUTINS: 'a',
      RID_VOTES: 'b',
      RID_DEPUTES: 'c',
      RID_DATAN_DEPUTES: 'd',
      RID_DATAN_GROUPES: 'e',
    });
    expect(rids).toMatchObject({ scrutins: 'a', votes: 'b', deputes: 'c', datanDeputes: 'd', datanGroupes: 'e' });
  });

  it('a une valeur par défaut pour chaque besoin, sans variable', () => {
    const rids = lireRessources({});
    for (const cle of ['scrutins', 'votes', 'deputes', 'datanDeputes'] as const) {
      expect(typeof rids[cle]).toBe('string');
      expect(rids[cle].length).toBeGreaterThan(0);
    }
  });

  it('ne surcharge que ce qui est défini', () => {
    const defauts = lireRessources({});
    const rids = lireRessources({ RID_VOTES: 'autre' });
    expect(rids.votes).toBe('autre');
    expect(rids.scrutins).toBe(defauts.scrutins);
  });
});
