import { Routes } from '@angular/router';

// Chaque page est chargée à la demande (loadComponent).
export const routes: Routes = [
  {
    path: '',
    title: 'Qui a voté quoi ?',
    loadComponent: () => import('./pages/accueil/accueil').then((m) => m.Accueil),
  },
  {
    path: 'lois/:dossier',
    title: 'Loi · Qui a voté quoi ?',
    loadComponent: () => import('./pages/loi/loi').then((m) => m.Loi),
  },
  {
    path: 'scrutins/:numero',
    title: 'Scrutin · Qui a voté quoi ?',
    loadComponent: () => import('./pages/scrutin/scrutin').then((m) => m.Scrutin),
  },
  {
    path: 'deputes',
    title: 'Députés · Qui a voté quoi ?',
    loadComponent: () => import('./pages/deputes/deputes').then((m) => m.Deputes),
  },
  {
    path: 'deputes/:slug',
    title: 'Député · Qui a voté quoi ?',
    loadComponent: () => import('./pages/depute/depute').then((m) => m.Depute),
  },
  {
    path: 'recherche',
    title: 'Recherche · Qui a voté quoi ?',
    loadComponent: () => import('./pages/recherche/recherche').then((m) => m.Recherche),
  },
  {
    path: 'a-propos',
    title: 'À propos · Qui a voté quoi ?',
    loadComponent: () => import('./pages/a-propos/a-propos').then((m) => m.APropos),
  },
  {
    path: '**',
    title: 'Page introuvable · Qui a voté quoi ?',
    loadComponent: () => import('./pages/introuvable/introuvable').then((m) => m.Introuvable),
  },
];
