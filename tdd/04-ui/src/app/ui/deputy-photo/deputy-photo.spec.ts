import { TestBed } from '@angular/core/testing';
import { AppDeputyPhoto } from './deputy-photo';

const SRC = 'https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/1001.jpg';

function monter(entrees: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(AppDeputyPhoto);
  fixture.componentRef.setInput('src', SRC);
  fixture.componentRef.setInput('nom', 'Alice Durand');
  for (const [cle, valeur] of Object.entries(entrees)) fixture.componentRef.setInput(cle, valeur);
  fixture.detectChanges();
  return { fixture, racine: fixture.nativeElement as HTMLElement };
}

describe('AppDeputyPhoto', () => {
  it('affiche la photo avec son nom comme alternative textuelle', () => {
    const { racine } = monter();
    const image = racine.querySelector('img')!;

    expect(image.getAttribute('alt')).toBe('Alice Durand');
    expect(image.getAttribute('src')).toContain('/photos/carre/1001.jpg');
  });

  it('fixe width et height pour éviter les sauts de mise en page (64 par défaut)', () => {
    const image = monter().racine.querySelector('img')!;

    expect(image.getAttribute('width')).toBe('64');
    expect(image.getAttribute('height')).toBe('64');
  });

  it('accepte la taille 160', () => {
    const image = monter({ taille: 160 }).racine.querySelector('img')!;

    expect(image.getAttribute('width')).toBe('160');
    expect(image.getAttribute('height')).toBe('160');
  });

  it('charge paresseusement par défaut', () => {
    const image = monter().racine.querySelector('img')!;

    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('charge en priorité (LCP) quand on le demande', () => {
    const image = monter({ priority: true }).racine.querySelector('img')!;

    expect(image.getAttribute('fetchpriority')).toBe('high');
    expect(image.getAttribute('loading')).toBe('eager');
  });

  it('se replie sur les initiales (fd-avatar) quand il n\'y a pas de photo', () => {
    const { racine } = monter({ src: null });

    expect(racine.querySelector('img')).toBeNull();
    expect(racine.querySelector('fd-avatar')).not.toBeNull();
    expect(racine.textContent).toContain('AD');
  });

  it('se replie sur les initiales quand l\'image échoue', () => {
    const { fixture, racine } = monter();

    racine.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(racine.querySelector('img')).toBeNull();
    expect(racine.querySelector('fd-avatar')).not.toBeNull();
  });
});
