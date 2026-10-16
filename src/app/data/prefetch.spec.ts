import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppPrefetch } from './prefetch';

@Component({
  imports: [AppPrefetch],
  template: `<a href="/lois/X" [appPrefetch]="url()">Une loi</a>`,
})
class Hote {
  readonly url = signal('/api/lois/DLR5L17N54372');
}

function connexion(valeur: Record<string, unknown> | undefined) {
  Object.defineProperty(navigator, 'connection', { value: valeur, configurable: true });
}

function monter(plateforme: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: plateforme }] });
  const fixture = TestBed.createComponent(Hote);
  fixture.detectChanges();
  return { fixture, lien: fixture.nativeElement.querySelector('a') as HTMLAnchorElement };
}

describe('AppPrefetch', () => {
  let fetchEspion: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchEspion = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchEspion);
    connexion(undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    connexion(undefined);
  });

  it.each(['pointerenter', 'focus', 'touchstart'])(
    'lance un fetch de priorité basse au premier %s',
    (evenement) => {
      const { lien } = monter();

      lien.dispatchEvent(new Event(evenement));

      expect(fetchEspion).toHaveBeenCalledTimes(1);
      expect(fetchEspion).toHaveBeenCalledWith(
        '/api/lois/DLR5L17N54372',
        expect.objectContaining({ priority: 'low' }),
      );
    },
  );

  it("ne fait qu'un seul fetch, quels que soient les événements suivants", () => {
    const { lien } = monter();

    lien.dispatchEvent(new Event('pointerenter'));
    lien.dispatchEvent(new Event('focus'));
    lien.dispatchEvent(new Event('touchstart'));
    lien.dispatchEvent(new Event('pointerenter'));

    expect(fetchEspion).toHaveBeenCalledTimes(1);
  });

  it("suit la valeur de l'entrée", () => {
    const { fixture, lien } = monter();
    fixture.componentInstance.url.set('/api/scrutins/8317');
    fixture.detectChanges();

    lien.dispatchEvent(new Event('pointerenter'));

    expect(fetchEspion).toHaveBeenCalledWith('/api/scrutins/8317', expect.anything());
  });

  it("ne fait rien avec l'économiseur de données", () => {
    connexion({ saveData: true });
    const { lien } = monter();

    lien.dispatchEvent(new Event('pointerenter'));

    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it('ne fait rien côté serveur', () => {
    const { lien } = monter('server');

    lien.dispatchEvent(new Event('pointerenter'));

    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it('ignore un échec réseau', async () => {
    fetchEspion.mockRejectedValue(new TypeError('réseau coupé'));
    const { lien } = monter();

    lien.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();

    expect(fetchEspion).toHaveBeenCalledTimes(1);
  });
});
