import { TestBed } from '@angular/core/testing';
import { AppPosition } from './position';

function monter(position: unknown) {
  const fixture = TestBed.createComponent(AppPosition);
  fixture.componentRef.setInput('position', position);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AppPosition', () => {
  it.each([
    ['pour', 'Pour', 'tokiwa'],
    ['contre', 'Contre', 'enji'],
    ['abstention', 'Abstention', 'yamabuki'],
  ])('%s s\'écrit « %s » dans un badge Fuda de ton %s', (position, libelle, ton) => {
    const racine = monter(position);
    const badge = racine.querySelector('fd-badge')!;

    expect(badge.textContent!.trim()).toBe(libelle);
    expect(badge.classList.contains(`fd-badge--${ton}`)).toBe(true);
  });

  it.each([
    ['nonvotant', 'Non-votant'],
    ['partage', 'Partagé'],
  ])('%s s\'écrit « %s » dans un badge neutre', (position, libelle) => {
    const badge = monter(position).querySelector('fd-badge')!;

    expect(badge.textContent!.trim()).toBe(libelle);
    expect(badge.className).not.toMatch(/fd-badge--(tokiwa|enji|yamabuki)/);
  });

  it('affiche un tiret quand la position est inconnue', () => {
    const racine = monter(null);

    expect(racine.textContent!.trim()).toBe('—');
  });
});
