import { TestBed } from '@angular/core/testing';
import { LFI, NI } from '../../testing/builders';
import { AppGroupPill } from './group-pill';

function monter(groupe = LFI) {
  const fixture = TestBed.createComponent(AppGroupPill);
  fixture.componentRef.setInput('groupe', groupe);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AppGroupPill', () => {
  it('montre une pastille décorative et l\'abrégé du groupe', () => {
    const racine = monter();
    const pastille = racine.querySelector('.app-group-pill__dot')!;

    expect(pastille.getAttribute('aria-hidden')).toBe('true');
    expect(racine.textContent).toContain('LFI-NFP');
  });

  it('colore la pastille avec la couleur officielle', () => {
    const pastille = monter().querySelector('.app-group-pill__dot') as HTMLElement;

    expect(pastille.style.backgroundColor).not.toBe('');
  });

  it('laisse la couleur de repli du CSS quand le groupe n\'en a pas', () => {
    const pastille = monter(NI).querySelector('.app-group-pill__dot') as HTMLElement;

    expect(pastille.style.backgroundColor).toBe('');
  });

  it('donne le libellé complet en infobulle et aux lecteurs d\'écran', () => {
    const racine = monter();

    expect(racine.querySelector('[title]')!.getAttribute('title')).toBe(LFI.libelle);
    expect(racine.querySelector('.app-group-pill__libelle')!.textContent).toContain(LFI.libelle);
  });
});
