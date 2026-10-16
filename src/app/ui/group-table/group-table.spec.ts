import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { groupes } from '../../testing/builders';
import { AppGroupTable } from './group-table';

function monter() {
  const fixture = TestBed.createComponent(AppGroupTable);
  fixture.componentRef.setInput('groupes', groupes());
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AppGroupTable', () => {
  it('est un vrai tableau avec une légende « Vote par groupe »', () => {
    const racine = monter();

    expect(racine.querySelector('table')).not.toBeNull();
    expect(racine.querySelector('caption')!.textContent!.trim()).toBe('Vote par groupe');
  });

  it('nomme ses colonnes', () => {
    const entetes = Array.from(monter().querySelectorAll('thead th'));

    expect(entetes.map((th) => th.textContent!.trim())).toEqual([
      'Groupe',
      'Position',
      'Pour',
      'Contre',
      'Abst.',
      'Non-votants',
    ]);
    for (const th of entetes) expect(th.getAttribute('scope')).toBe('col');
  });

  it('a une ligne par groupe, avec le groupe en en-tête de ligne', () => {
    const lignes = Array.from(monter().querySelectorAll('tbody tr'));

    expect(lignes).toHaveLength(4);
    expect(lignes[0].querySelector('th')!.getAttribute('scope')).toBe('row');
    expect(lignes[0].querySelector('th')!.textContent).toContain('RN');
  });

  it('affiche la position en toutes lettres et les décomptes', () => {
    const premiere = monter().querySelector('tbody tr')!;
    const cellules = Array.from(premiere.querySelectorAll('td')).map((td) =>
      td.textContent!.trim(),
    );

    expect(cellules[0]).toContain('Pour');
    expect(cellules.slice(1, 5)).toEqual(['3', '0', '1', '0']);
  });

  it('aligne les chiffres avec des chiffres tabulaires (feuille de style du composant)', () => {
    const scss = readFileSync('src/app/ui/group-table/group-table.scss', 'utf8');

    expect(scss).toContain('tabular-nums');
  });

  it('défile horizontalement dans une région focalisable et nommée', () => {
    const region = monter().querySelector('[tabindex="0"]')!;

    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBeTruthy();
    expect(region.querySelector('table')).not.toBeNull();
  });

  it('glisse une mini-barre de taille sm dans chaque ligne', () => {
    const barres = monter().querySelectorAll('tbody tr .app-vote-bar--sm');

    expect(barres).toHaveLength(4);
  });
});
