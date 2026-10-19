import { RenderMode, ServerRoute } from '@angular/ssr';

// Rendu à chaque requête, sauf la page « À propos », sans donnée, pré-rendue au build.
export const serverRoutes: ServerRoute[] = [
  {
    path: 'a-propos',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
