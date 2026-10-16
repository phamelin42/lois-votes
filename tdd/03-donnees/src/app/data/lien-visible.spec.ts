import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { AppLienVisible } from './lien-visible';
import { ViewportPreloadingStrategy } from './viewport-preloading.strategy';

@Component({
  imports: [RouterLink, AppLienVisible],
  template: `
    <a routerLink="/lois/DLR5L17N1">Une loi</a>
    <a href="/externe">Sans routerLink</a>
  `,
})
class Hote {}

type Observateur = { rappel: IntersectionObserverCallback; observes: Element[] };

describe('AppLienVisible', () => {
  let observateurs: Observateur[];

  beforeEach(() => {
    observateurs = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        private readonly etat: Observateur;
        constructor(rappel: IntersectionObserverCallback) {
          this.etat = { rappel, observes: [] };
          observateurs.push(this.etat);
        }
        observe(element: Element) {
          this.etat.observes.push(element);
        }
        unobserve(element: Element) {
          this.etat.observes = this.etat.observes.filter((e) => e !== element);
        }
        disconnect() {
          this.etat.observes = [];
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function monter() {
    const lienVisible = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ViewportPreloadingStrategy, useValue: { lienVisible } }],
    });
    const fixture = TestBed.createComponent(Hote);
    fixture.detectChanges();
    return { fixture, lienVisible };
  }

  function rendreVisible(element: Element, visible = true) {
    for (const o of observateurs) {
      o.rappel(
        [{ target: element, isIntersecting: visible } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    }
  }

  it("observe les liens routerLink et pas les autres", () => {
    const { fixture } = monter();
    const observes = observateurs.flatMap((o) => o.observes);

    expect(observes).toHaveLength(1);
    expect(observes[0]).toBe(fixture.nativeElement.querySelector('a[href="/lois/DLR5L17N1"]'));
  });

  it('prévient la stratégie quand le lien entre dans l\'écran', () => {
    const { fixture, lienVisible } = monter();
    const lien = fixture.nativeElement.querySelector('a[href="/lois/DLR5L17N1"]') as HTMLAnchorElement;

    rendreVisible(lien);

    expect(lienVisible).toHaveBeenCalledWith('/lois/DLR5L17N1');
  });

  it('ne fait rien tant que le lien est hors écran', () => {
    const { fixture, lienVisible } = monter();
    const lien = fixture.nativeElement.querySelector('a[href="/lois/DLR5L17N1"]') as HTMLAnchorElement;

    rendreVisible(lien, false);

    expect(lienVisible).not.toHaveBeenCalled();
  });

  it('cesse d\'observer le lien une fois signalé', () => {
    const { fixture } = monter();
    const lien = fixture.nativeElement.querySelector('a[href="/lois/DLR5L17N1"]') as HTMLAnchorElement;

    rendreVisible(lien);

    expect(observateurs.flatMap((o) => o.observes)).toHaveLength(0);
  });

  it('cesse d\'observer quand le composant est détruit', () => {
    const { fixture } = monter();

    fixture.destroy();

    expect(observateurs.flatMap((o) => o.observes)).toHaveLength(0);
  });

  it('ne plante pas sans IntersectionObserver (rendu serveur)', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    expect(() => monter()).not.toThrow();
  });
});
