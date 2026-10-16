import { TestBed } from '@angular/core/testing';
import { compte } from '../../testing/builders';
import { AppVoteBar } from './vote-bar';

function monter(entrees: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(AppVoteBar);
  fixture.componentRef.setInput('compte', compte());
  for (const [cle, valeur] of Object.entries(entrees)) fixture.componentRef.setInput(cle, valeur);
  fixture.detectChanges();
  return { fixture, racine: fixture.nativeElement as HTMLElement };
}

describe('AppVoteBar', () => {
  it('est une image décrite en toutes lettres', () => {
    const { racine } = monter();
    const image = racine.querySelector('[role="img"]')!;

    expect(image.getAttribute('aria-label')).toBe('312 pour, 201 contre, 18 abstentions, 46 non-votants');
  });

  it('accorde le singulier', () => {
    const { racine } = monter({ compte: compte(1, 1, 1, 1) });

    expect(racine.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(
      '1 pour, 1 contre, 1 abstention, 1 non-votant',
    );
  });

  it('écrit les chiffres sous la barre : la couleur ne porte jamais seule l\'information', () => {
    const { racine } = monter();
    const texte = racine.textContent!.replace(/\s+/g, ' ');

    expect(texte).toContain('312 pour');
    expect(texte).toContain('201 contre');
    expect(texte).toContain('18 abst.');
  });

  it('répartit la largeur proportionnellement avec flex-grow, sans JS de mise en page', () => {
    const { racine } = monter();
    const grow = (type: string) =>
      Number((racine.querySelector(`.app-vote-bar__segment--${type}`) as HTMLElement).style.flexGrow);

    expect(grow('pour')).toBe(312);
    expect(grow('contre')).toBe(201);
    expect(grow('abstention')).toBe(18);
    expect(grow('nonvotant')).toBe(46);
  });

  it('omet les segments vides', () => {
    const { racine } = monter({ compte: compte(10, 0, 0, 0) });

    expect(racine.querySelectorAll('.app-vote-bar__segment')).toHaveLength(1);
    expect(racine.querySelector('.app-vote-bar__segment--pour')).not.toBeNull();
  });

  it('reste lisible sans aucun vote', () => {
    const { racine } = monter({ compte: compte(0, 0, 0, 0) });

    expect(racine.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain('0 pour');
    expect(racine.querySelectorAll('.app-vote-bar__segment')).toHaveLength(0);
  });

  it('prend la taille md par défaut et accepte sm', () => {
    const { fixture, racine } = monter();
    expect(racine.querySelector('.app-vote-bar')!.classList.contains('app-vote-bar--sm')).toBe(false);

    fixture.componentRef.setInput('taille', 'sm');
    fixture.detectChanges();

    expect(racine.querySelector('.app-vote-bar')!.classList.contains('app-vote-bar--sm')).toBe(true);
  });
});
