import { configurerPage, monter } from '../../testing/page';
import { IntrouvablePage } from './introuvable';

describe('IntrouvablePage', () => {
  it('répond 404 avec un état vide et un retour à l\'accueil', () => {
    const { init } = configurerPage();
    const fixture = monter(IntrouvablePage);
    const racine = fixture.nativeElement as HTMLElement;

    expect(init.status).toBe(404);
    expect(racine.querySelector('fd-empty-state')).not.toBeNull();
    expect(racine.querySelectorAll('h1')).toHaveLength(1);
    expect(Array.from(racine.querySelectorAll('a')).some((a) => a.getAttribute('href') === '/')).toBe(true);
  });
});
