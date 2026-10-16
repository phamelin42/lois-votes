import { Route, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ViewportPreloadingStrategy } from './viewport-preloading.strategy';

const routes: Route[] = [
  { path: 'lois/:dossier', loadComponent: () => Promise.resolve(class {}) },
  { path: 'deputes', loadComponent: () => Promise.resolve(class {}) },
];

function connexion(valeur: Record<string, unknown> | undefined) {
  Object.defineProperty(navigator, 'connection', { value: valeur, configurable: true });
}

function preparer() {
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  const strategie = TestBed.inject(ViewportPreloadingStrategy);
  const charger = {
    lois: vi.fn(() => of('lois')),
    deputes: vi.fn(() => of('deputes')),
  };
  // Le routeur appelle `preload` pour chaque route paresseuse ; la stratégie garde le chargeur.
  const retour = strategie.preload(routes[0], charger.lois as () => Observable<unknown>);
  strategie.preload(routes[1], charger.deputes as () => Observable<unknown>);
  return { strategie, charger, retour };
}

describe('ViewportPreloadingStrategy', () => {
  beforeEach(() => {
    vi.stubGlobal('requestIdleCallback', (rappel: () => void) => {
      rappel();
      return 1;
    });
    connexion(undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    connexion(undefined);
  });

  it("ne précharge rien tant qu'aucun lien n'est visible", () => {
    const { charger, retour } = preparer();
    retour.subscribe();

    expect(charger.lois).not.toHaveBeenCalled();
    expect(charger.deputes).not.toHaveBeenCalled();
  });

  it('précharge la route qui correspond à un lien devenu visible, et seulement celle-là', () => {
    const { strategie, charger } = preparer();

    strategie.lienVisible('/lois/DLR5L17N54372');

    expect(charger.lois).toHaveBeenCalledTimes(1);
    expect(charger.deputes).not.toHaveBeenCalled();
  });

  it('ne précharge une route qu\'une seule fois', () => {
    const { strategie, charger } = preparer();

    strategie.lienVisible('/lois/A');
    strategie.lienVisible('/lois/B');

    expect(charger.lois).toHaveBeenCalledTimes(1);
  });

  it('ignore les liens qui ne mènent à aucune route paresseuse', () => {
    const { strategie, charger } = preparer();

    strategie.lienVisible('/inconnue');
    strategie.lienVisible('https://exemple.org/lois/A');

    expect(charger.lois).not.toHaveBeenCalled();
    expect(charger.deputes).not.toHaveBeenCalled();
  });

  it('ignore la chaîne de requête et le fragment', () => {
    const { strategie, charger } = preparer();

    strategie.lienVisible('/deputes?groupe=RN#haut');

    expect(charger.deputes).toHaveBeenCalledTimes(1);
  });

  it('ne précharge pas quand l\'économiseur de données est actif', () => {
    connexion({ saveData: true });
    const { strategie, charger } = preparer();

    strategie.lienVisible('/lois/A');

    expect(charger.lois).not.toHaveBeenCalled();
  });

  it('ne précharge pas sur une connexion 2g', () => {
    connexion({ effectiveType: '2g' });
    const { strategie, charger } = preparer();

    strategie.lienVisible('/lois/A');

    expect(charger.lois).not.toHaveBeenCalled();
  });

  it('précharge sur une connexion rapide', () => {
    connexion({ effectiveType: '4g', saveData: false });
    const { strategie, charger } = preparer();

    strategie.lienVisible('/lois/A');

    expect(charger.lois).toHaveBeenCalledTimes(1);
  });

  it('attend un moment d\'inactivité du navigateur', () => {
    let rappelInactif: (() => void) | undefined;
    vi.stubGlobal('requestIdleCallback', (rappel: () => void) => {
      rappelInactif = rappel;
      return 1;
    });
    const { strategie, charger } = preparer();

    strategie.lienVisible('/lois/A');
    expect(charger.lois).not.toHaveBeenCalled();
    rappelInactif!();

    expect(charger.lois).toHaveBeenCalledTimes(1);
  });

  it('retombe sur setTimeout sans requestIdleCallback', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const { strategie, charger } = preparer();

    strategie.lienVisible('/lois/A');
    expect(charger.lois).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(charger.lois).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
