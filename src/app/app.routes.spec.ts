import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { RenderMode } from '@angular/ssr';

describe("routes de l'application", () => {
  it('déclare les 8 routes du plan, la dernière étant la 404', () => {
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
  });

  it('charge chaque page paresseusement (loadComponent), jamais en direct', () => {
    for (const route of routes) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      expect(route.component, route.path).toBeUndefined();
    }
  });

  it.each(routes.map((r) => [r.path ?? '', r] as const))(
    'la route « %s » se résout vers un composant',
    async (_chemin, route) => {
      const composant = await route.loadComponent!();

      expect(composant).toBeTypeOf('function');
    },
  );
});

describe('routes de rendu serveur', () => {
  it('rend tout côté serveur, sauf /a-propos qui est pré-rendue', () => {
    const parChemin = new Map(serverRoutes.map((r) => [r.path, r.renderMode]));

    expect(parChemin.get('a-propos')).toBe(RenderMode.Prerender);
    expect(parChemin.get('**')).toBe(RenderMode.Server);
    for (const [chemin, mode] of parChemin) {
      if (chemin !== 'a-propos') expect(mode, chemin).toBe(RenderMode.Server);
    }
  });

  it('se termine par un joker qui couvre toutes les autres routes', () => {
    expect(serverRoutes.at(-1)!.path).toBe('**');
  });
});
