import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FdThemeService } from 'fuda';
import { deputeListe } from '../testing/builders';
import { dateLongue } from '../data/format';
import { AppShell } from './shell';

function monter(entrees: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(AppShell);
  fixture.componentRef.setInput('index', deputeListe());
  fixture.componentRef.setInput('miseAJour', null);
  for (const [cle, valeur] of Object.entries(entrees)) fixture.componentRef.setInput(cle, valeur);
  fixture.detectChanges();
  return { fixture, racine: fixture.nativeElement as HTMLElement };
}

describe('AppShell', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.clear();
    } catch {
      /* stockage indisponible */
    }
  });

  it("commence par un lien d'évitement vers le contenu", () => {
    const { racine } = monter();
    const premier = racine.querySelector('a')!;

    expect(premier.textContent!.trim()).toBe('Aller au contenu');
    expect(premier.getAttribute('href')).toBe('#contenu');
  });

  it('a un <main id="contenu"> qui reçoit les pages', () => {
    const { racine } = monter();
    const main = racine.querySelector('main#contenu')!;

    expect(main).not.toBeNull();
    expect(main.querySelector('router-outlet')).not.toBeNull();
  });

  it("nomme le site « Qui a voté quoi ? » avec un lien vers l'accueil", () => {
    const { racine } = monter();
    const nom = Array.from(racine.querySelectorAll('header a')).find((a) =>
      a.textContent!.includes('Qui a voté quoi ?'),
    )!;

    expect(nom.getAttribute('href')).toBe('/');
  });

  it('propose les liens « Lois » et « Députés » dans une navigation nommée', () => {
    const { racine } = monter();
    const nav = racine.querySelector('header nav')!;
    const liens = Array.from(nav.querySelectorAll('a')).map((a) => [
      a.textContent!.trim(),
      a.getAttribute('href'),
    ]);

    expect(nav.getAttribute('aria-label')).toBeTruthy();
    expect(liens).toEqual(
      expect.arrayContaining([
        ['Lois', '/'],
        ['Députés', '/deputes'],
      ]),
    );
  });

  it("contient la recherche et lui transmet l'index", () => {
    const { racine } = monter();

    expect(racine.querySelector('header app-search')).not.toBeNull();
  });

  it("relaie la demande d'index de la recherche", () => {
    const { fixture, racine } = monter();
    const demande = vi.fn();
    fixture.componentInstance.besoinIndex.subscribe(demande);

    racine.querySelector('header input')!.dispatchEvent(new Event('focus'));

    expect(demande).toHaveBeenCalledTimes(1);
  });

  it('bascule le thème Jour/Nuit avec un bouton aria-pressed', () => {
    const { fixture, racine } = monter();
    const bouton = racine.querySelector(
      'header button[fdIconButton], header button.fd-icon-button, header button[aria-pressed]',
    ) as HTMLButtonElement;
    const theme = TestBed.inject(FdThemeService);

    expect(bouton.getAttribute('aria-label')).toBe('Thème sombre');
    expect(bouton.getAttribute('aria-pressed')).toBe('false');

    bouton.click();
    fixture.detectChanges();
    TestBed.tick();

    expect(theme.theme()).toBe('dark');
    expect(bouton.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('cite la source des données et renvoie vers « À propos »', () => {
    const { racine } = monter();
    const pied = racine.querySelector('footer')!;
    const texte = pied.textContent!.replace(/\s+/g, ' ');

    expect(texte).toContain('data.gouv.fr');
    expect(texte).toContain('NosParlementaires');
    expect(texte).toContain('Datan');
    expect(texte).toContain('Licence Ouverte 2.0');
    expect(
      Array.from(pied.querySelectorAll('a'))
        .find((a) => a.textContent!.trim() === 'À propos')!
        .getAttribute('href'),
    ).toBe('/a-propos');
  });

  it('affiche la date de mise à jour quand elle est connue', () => {
    const { racine } = monter({ miseAJour: '2025-01-15T09:00:00Z' });

    expect(racine.querySelector('footer')!.textContent).toContain(
      dateLongue('2025-01-15T09:00:00Z'),
    );
  });

  it("n'affiche pas de date de mise à jour sinon", () => {
    const { racine } = monter();

    expect(racine.querySelector('footer')!.textContent).not.toMatch(/mis à jour/i);
  });
});
