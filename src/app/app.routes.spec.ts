import { RenderMode } from '@angular/ssr';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';

const CHEMINS: [string, string][] = [
  ['/', 'Les dernières lois votées'],
  ['/lois/DLR5L17N54372', 'Loi'],
  ['/scrutins/8430', 'Scrutin'],
  ['/deputes', 'Les députés'],
  ['/deputes/mathilde-panot', 'Député'],
  ['/recherche', 'Recherche'],
  ['/a-propos', 'À propos'],
  ['/une/page/qui/nexiste/pas', 'Page introuvable'],
];

describe('routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('déclare les 8 routes, chacune chargée par loadComponent', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '',
      'lois/:dossier',
      'scrutins/:numero',
      'deputes',
      'deputes/:slug',
      'recherche',
      'a-propos',
      '**',
    ]);
    for (const route of routes as Route[]) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      expect(route.component, route.path).toBeUndefined();
    }
  });

  it.each(CHEMINS)('%s affiche un <h1> « %s »', async (chemin, titre) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(chemin);

    const h1 = (harness.routeNativeElement as HTMLElement).querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe(titre);
    expect(TestBed.inject(Router).url).toBe(chemin);
  });

  it('rend toutes les routes côté serveur, sauf /a-propos pré-rendue', () => {
    expect(serverRoutes).toEqual([
      { path: 'a-propos', renderMode: RenderMode.Prerender },
      { path: '**', renderMode: RenderMode.Server },
    ]);
  });
});
