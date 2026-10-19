import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import type { Groupe } from '@contrat';
import { groupes, LFI, SOC } from '../../testing/builders';
import { AppGroupTable } from './group-table';

function monter(sansVotant?: Groupe[], liste = groupes()) {
  const fixture = TestBed.createComponent(AppGroupTable);
  fixture.componentRef.setInput('groupes', liste);
  if (sansVotant) fixture.componentRef.setInput('sansVotant', sansVotant);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const espaces = (texte: string | null | undefined) => (texte ?? '').replace(/\s+/g, ' ').trim();

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
    // Nombre et part des votants du groupe (RN : 3 pour, 1 abstention, donc 75 % et 25 %) ; pas de part pour les non-votants.
    expect(cellules.slice(1, 5).map((c) => espaces(c).replace(/\s%/, '%'))).toEqual([
      '3 (75%)',
      '0 (0%)',
      '1 (25%)',
      '0',
    ]);
  });

  it('écrit les pourcentages sur les votants du groupe, sans dépasser 100', () => {
    const lignes = Array.from(monter().querySelectorAll('tbody tr'));

    for (const ligne of lignes) {
      const parts = [...ligne.querySelectorAll('.app-group-table__part')].map((p) =>
        Number(/(\d+)/.exec(p.textContent!)![1]),
      );
      expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it('écrit un tiret, sans NaN, pour un groupe sans aucun votant', () => {
    const racine = monter(undefined, [
      {
        groupe: LFI,
        position: 'nonvotant',
        compte: { pour: 0, contre: 0, abstention: 0, nonvotant: 2 },
      },
    ]);

    expect(espaces(racine.querySelector('tbody')!.textContent)).not.toMatch(/NaN|Infinity/);
    expect(
      [...racine.querySelectorAll('.app-group-table__part')].map((p) => p.textContent!.trim()),
    ).toEqual(['(—)', '(—)', '(—)']);
  });

  it("n'écrit pas de note quand tous les groupes en activité ont voté", () => {
    expect(monter().querySelector('.app-group-table__note')).toBeNull();
    expect(monter([]).querySelector('.app-group-table__note')).toBeNull();
  });

  it('nomme les groupes sans aucun votant sous le tableau', () => {
    const note = monter([LFI, SOC]).querySelector('.app-group-table__note')!;

    expect(espaces(note.textContent)).toContain(
      'Groupes sans aucun votant sur ce scrutin : LFI-NFP, SOC.',
    );
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

  it("n'ajoute pas la ligne « n'ont pas voté » aux petites barres des groupes", () => {
    const racine = monter();

    expect(racine.querySelector('tbody .app-vote-bar__absents')).toBeNull();
  });
});
