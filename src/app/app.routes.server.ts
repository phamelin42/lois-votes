import { RenderMode, ServerRoute } from '@angular/ssr';

// Tout est rendu par le serveur, sauf la page À propos (contenu statique, pré-rendu au build).
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
