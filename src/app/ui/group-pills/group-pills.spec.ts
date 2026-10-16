import { TestBed } from '@angular/core/testing';
import { LFI, NI, RN, SOC, voteGroupe } from '../../testing/builders';
import { AppGroupPills } from './group-pills';

const beaucoup = () =>
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((abrege) =>
    voteGroupe({ id: abrege, abrege, libelle: `Groupe ${abrege}`, couleur: null }, 'pour', {
      pour: 1,
    }),
  );

function monter(groupes = beaucoup(), max?: number) {
  const fixture = TestBed.createComponent(AppGroupPills);
  fixture.componentRef.setInput('groupes', groupes);
  if (max !== undefined) fixture.componentRef.setInput('max', max);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AppGroupPills', () => {
  it('écrit chaque groupe avec sa position', () => {
    const racine = monter([
      voteGroupe(RN, 'pour'),
      voteGroupe(LFI, 'contre'),
      voteGroupe(SOC, 'partage'),
      voteGroupe(NI, 'abstention'),
    ]);
    const texte = racine.textContent!.replace(/\s+/g, ' ');

    expect(texte).toContain('RN');
    expect(texte).toContain('Pour');
    expect(texte).toContain('LFI-NFP');
    expect(texte).toContain('Contre');
    expect(texte).toContain('Partagé');
  });

  it('se limite à 6 groupes par défaut et indique le reste', () => {
    const racine = monter();

    expect(racine.querySelectorAll('app-group-pill')).toHaveLength(6);
    expect(racine.textContent).toContain('+2');
  });

  it('respecte la limite demandée', () => {
    const racine = monter(beaucoup(), 3);

    expect(racine.querySelectorAll('app-group-pill')).toHaveLength(3);
    expect(racine.textContent).toContain('+5');
  });

  it("n'écrit pas « +n » quand tout tient", () => {
    const racine = monter(beaucoup().slice(0, 4));

    expect(racine.textContent).not.toMatch(/\+\d/);
  });
});
