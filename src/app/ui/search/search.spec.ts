import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { deputeListe } from '../../testing/builders';
import { AppSearch } from './search';

function monter(index: ReturnType<typeof deputeListe> | null = deputeListe()) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(AppSearch);
  fixture.componentRef.setInput('index', index ?? undefined);
  fixture.detectChanges();
  const racine = fixture.nativeElement as HTMLElement;
  const champ = racine.querySelector('input') as HTMLInputElement;
  const navigation = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

  async function saisir(texte: string) {
    champ.value = texte;
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function touche(key: string) {
    champ.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }
  const options = () => Array.from(racine.querySelectorAll('[role="option"]')) as HTMLElement[];
  return { fixture, racine, champ, navigation, saisir, touche, options };
}

describe('AppSearch', () => {
  it('fonctionne sans JavaScript : formulaire GET vers /recherche avec le champ « q »', () => {
    const { racine, champ } = monter();
    const formulaire = racine.querySelector('form')!;

    expect(formulaire.getAttribute('action')).toBe('/recherche');
    expect(formulaire.getAttribute('method')?.toLowerCase()).toBe('get');
    expect(champ.getAttribute('name')).toBe('q');
  });

  it('a un libellé visible', () => {
    const { racine } = monter();

    expect(racine.querySelector('label')!.textContent!.trim().length).toBeGreaterThan(0);
  });

  it('est une combobox ARIA 1.2 fermée au départ', () => {
    const { champ } = monter();

    expect(champ.getAttribute('role')).toBe('combobox');
    expect(champ.getAttribute('aria-expanded')).toBe('false');
    expect(champ.getAttribute('aria-autocomplete')).toBe('list');
    expect(champ.getAttribute('aria-controls')).toBeTruthy();
  });

  it("demande l'index au premier focus, une seule fois", () => {
    const { fixture, champ } = monter(null);
    const demande = vi.fn();
    fixture.componentInstance.besoinIndex.subscribe(demande);

    champ.dispatchEvent(new Event('focus'));
    champ.dispatchEvent(new Event('focus'));

    expect(demande).toHaveBeenCalledTimes(1);
  });

  it('filtre sans tenir compte des accents ni de la casse', async () => {
    const { saisir, options } = monter();

    await saisir('ELODIE');

    expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Élodie Roux')]);
  });

  it('range les résultats en groupes « Députés » et « Lois »', async () => {
    const { racine, saisir } = monter();

    await saisir('a');

    const groupes = Array.from(racine.querySelectorAll('[role="group"]'));
    expect(groupes.map((g) => g.getAttribute('aria-label'))).toEqual(['Députés', 'Lois']);
  });

  it('retrouve une loi par un mot de son titre', async () => {
    const { options, saisir } = monter();

    await saisir('abeilles');

    expect(options()).toHaveLength(1);
    expect(options()[0].textContent).toContain('Proposition de loi visant à protéger les abeilles');
  });

  it('montre au plus 5 députés', async () => {
    const index = deputeListe();
    index.deputes = Array.from({ length: 12 }, (_, i) => ({
      slug: `martin-${i}`,
      nom: `Martin ${i}`,
      nomTri: `Martin ${i}`,
      groupe: 'RN',
      departement: '69',
      circonscription: 'Rhône (1)',
    }));
    const { saisir, options } = monter(index);

    await saisir('martin');

    expect(options()).toHaveLength(5);
  });

  it('ouvre la liste et annonce le nombre de résultats dans une région aria-live', async () => {
    const { champ, racine, saisir } = monter();

    await saisir('martin');

    expect(champ.getAttribute('aria-expanded')).toBe('true');
    const annonce = racine.querySelector('[aria-live="polite"]')!;
    expect(annonce.textContent).toMatch(/1 résultat/);
  });

  it('se parcourt aux flèches avec aria-activedescendant', async () => {
    const { champ, saisir, touche, options } = monter();
    await saisir('r');

    touche('ArrowDown');
    expect(champ.getAttribute('aria-activedescendant')).toBe(options()[0].id);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');

    touche('ArrowDown');
    expect(champ.getAttribute('aria-activedescendant')).toBe(options()[1].id);

    touche('ArrowUp');
    expect(champ.getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('Entrée sur un député ouvre son profil', async () => {
    const { saisir, touche, navigation } = monter();
    await saisir('elodie');

    touche('ArrowDown');
    touche('Enter');

    expect(navigation).toHaveBeenCalledWith('/deputes/elodie-roux');
  });

  it('Entrée sur une loi ouvre sa page', async () => {
    const { saisir, touche, navigation } = monter();
    await saisir('abeilles');

    touche('ArrowDown');
    touche('Enter');

    expect(navigation).toHaveBeenCalledWith('/lois/DLR5L17N2000');
  });

  it('cliquer sur un résultat navigue aussi', async () => {
    const { saisir, options, navigation } = monter();
    await saisir('elodie');

    options()[0].click();

    expect(navigation).toHaveBeenCalledWith('/deputes/elodie-roux');
  });

  it('Entrée sans sélection lance la recherche complète', async () => {
    const { saisir, touche, navigation } = monter();
    await saisir('dura');

    touche('Enter');

    expect(navigation).toHaveBeenCalledWith('/recherche?q=dura');
  });

  it('encode la requête de la recherche complète', async () => {
    const { saisir, touche, navigation } = monter();
    await saisir('sobriété & foncière');

    touche('Enter');

    expect(navigation).toHaveBeenCalledWith(
      '/recherche?q=sobri%C3%A9t%C3%A9%20%26%20fonci%C3%A8re',
    );
  });

  it('Échap ferme la liste', async () => {
    const { champ, saisir, touche } = monter();
    await saisir('martin');
    expect(champ.getAttribute('aria-expanded')).toBe('true');

    touche('Escape');

    expect(champ.getAttribute('aria-expanded')).toBe('false');
  });

  it("ne plante pas tant que l'index n'est pas chargé", async () => {
    const { saisir, options } = monter(null);

    await saisir('martin');

    expect(options()).toHaveLength(0);
  });
});
