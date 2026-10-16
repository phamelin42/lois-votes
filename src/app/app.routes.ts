import { Routes } from '@angular/router';

// Chaque page est chargée à la demande (loadComponent) : le code d'une page ne pèse pas sur l'accueil.
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/accueil/accueil').then((m) => m.AccueilPage),
  },
  {
    path: 'lois/:dossier',
    loadComponent: () => import('./pages/loi/loi').then((m) => m.LoiPage),
  },
  {
    path: 'scrutins/:numero',
    loadComponent: () => import('./pages/scrutin/scrutin').then((m) => m.ScrutinPage),
  },
  {
    path: 'deputes',
    loadComponent: () => import('./pages/deputes/deputes').then((m) => m.DeputesPage),
  },
  {
    path: 'deputes/:slug',
    loadComponent: () => import('./pages/depute/depute').then((m) => m.DeputePage),
  },
  {
    path: 'recherche',
    loadComponent: () => import('./pages/recherche/recherche').then((m) => m.RecherchePage),
  },
  {
    path: 'a-propos',
    loadComponent: () => import('./pages/a-propos/a-propos').then((m) => m.AProposPage),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/introuvable/introuvable').then((m) => m.IntrouvablePage),
  },
];
