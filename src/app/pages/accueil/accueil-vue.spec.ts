import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { accueil, loiCarteSansVote } from '../../testing/builders';
import { AccueilVue } from './accueil-vue';

function monter(entrees: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(AccueilVue);
  fixture.componentRef.setInput('donnees', accueil(3, 1, true));
  fixture.componentRef.setInput('chargement', false);
  for (const [cle, valeur] of Object.entries(entrees)) fixture.componentRef.setInput(cle, valeur);
  fixture.detectChanges();
  return { fixture, racine: fixture.nativeElement as HTMLElement };
}

const bouton = (racine: HTMLElement) =>
  Array.from(racine.querySelectorAll('button')).find((b) =>
    b.textContent!.includes('Voir plus'),
  ) as HTMLButtonElement | undefined;

describe('AccueilVue', () => {
  it("a un seul h1 : « Les dernières lois votées à l'Assemblée »", () => {
    const { racine } = monter();
    const titres = racine.querySelectorAll('h1');

    expect(titres).toHaveLength(1);
    expect(titres[0].textContent!.trim()).toBe("Les dernières lois votées à l'Assemblée");
  });

  it('explique en une phrase ce que montre la page', () => {
    const { racine } = monter();

    expect(
      racine.querySelector('h1 + p, .app-accueil__intro')!.textContent!.trim().length,
    ).toBeGreaterThan(20);
  });

  it('donne le nombre de textes et la date du plus ancien', () => {
    const { racine } = monter({
      donnees: { ...accueil(3, 1, true), total: 259, depuis: '2024-10-08' },
    });
    const total = racine.querySelector('.app-accueil__total')!;

    expect(total.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      "259 textes depuis le 8 octobre 2024. Un texte adopté à main levée ou par l'article 49.3 n'a pas de vote nominatif.",
    );
    expect(total.querySelector('time')!.getAttribute('datetime')).toBe('2024-10-08');
  });

  it('écrit « 1 texte » au singulier', () => {
    const { racine } = monter({ donnees: { ...accueil(1), total: 1 } });

    expect(racine.querySelector('.app-accueil__total')!.textContent).toMatch(/^\s*1 texte depuis/);
  });

  it('mêle les textes adoptés sans vote nominatif aux autres cartes', () => {
    const donnees = accueil(2);
    donnees.lois.splice(1, 0, loiCarteSansVote());
    const { racine } = monter({ donnees });

    expect(racine.querySelectorAll('app-loi-card')).toHaveLength(3);
    expect(racine.querySelectorAll('app-loi-card')[1].textContent).toContain('Adopté à main levée');
  });

  it("affiche une carte par loi, dans l'ordre reçu", () => {
    const { racine } = monter();
    const titres = Array.from(racine.querySelectorAll('app-loi-card .app-loi-card__titre')).map(
      (t) => t.textContent!.trim(),
    );

    expect(titres).toEqual(['Loi numéro 1-1', 'Loi numéro 1-2', 'Loi numéro 1-3']);
  });

  it('propose « Voir plus » quand une page suivante existe', () => {
    expect(bouton(monter().racine)).toBeDefined();
  });

  it('ne propose pas « Voir plus » sans page suivante', () => {
    expect(bouton(monter({ donnees: accueil(3, 1, false) }).racine)).toBeUndefined();
  });

  it('émet pageSuivante au clic sur « Voir plus »', () => {
    const { fixture, racine } = monter();
    const demande = vi.fn();
    fixture.componentInstance.pageSuivante.subscribe(demande);

    bouton(racine)!.click();

    expect(demande).toHaveBeenCalledTimes(1);
  });

  it('montre un spinner et désactive le bouton pendant le chargement', () => {
    const { racine } = monter({ chargement: true });

    expect(racine.querySelector('fd-spinner')).not.toBeNull();
    expect(
      bouton(racine)!.disabled || bouton(racine)!.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('montre des squelettes de hauteur fixe avant la première réponse', () => {
    const { racine } = monter({ donnees: undefined, chargement: true });

    expect(racine.querySelectorAll('.app-accueil__squelette').length).toBeGreaterThanOrEqual(3);
    expect(racine.querySelectorAll('app-loi-card')).toHaveLength(0);
  });

  it("montre un état vide quand il n'y a aucune loi", () => {
    const { racine } = monter({ donnees: accueil(0, 1, false) });

    expect(racine.querySelector('fd-empty-state')).not.toBeNull();
  });

  it('montre une alerte quand les données sont indisponibles', () => {
    const { racine } = monter({ donnees: undefined, erreur: true });
    const alerte = racine.querySelector('fd-alert')!;

    expect(alerte.textContent).toContain(
      'Données momentanément indisponibles, réessayez dans une minute.',
    );
  });
});
