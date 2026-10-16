import { GROUPES_OFFICIELS, groupeParAbrege } from './groupes';

describe('table des groupes (configuration, pas de donnée)', () => {
  it('contient les 12 groupes de la 17ᵉ législature', () => {
    expect(GROUPES_OFFICIELS.map((g) => g.abrege).sort()).toEqual(
      ['DEM', 'DR', 'ECOS', 'EPR', 'GDR', 'HOR', 'LFI-NFP', 'LIOT', 'NI', 'RN', 'SOC', 'UDDPLR'].sort(),
    );
  });

  it('donne un identifiant, un libellé et une couleur hexadécimale (sauf NI)', () => {
    for (const groupe of GROUPES_OFFICIELS) {
      expect(groupe.id).toBe(groupe.abrege);
      expect(groupe.libelle.length).toBeGreaterThan(2);
      if (groupe.abrege === 'NI') {
        expect(groupe.couleur).toBeNull();
      } else {
        expect(groupe.couleur).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('retrouve un groupe par son abrégé', () => {
    expect(groupeParAbrege('RN')?.libelle).toBe('Rassemblement National');
    expect(groupeParAbrege('inconnu')).toBeUndefined();
  });
});
