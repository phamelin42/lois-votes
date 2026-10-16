import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { catchError, EMPTY, Observable } from 'rxjs';
import { connexionLimitee } from './connexion';

interface RouteChargeable {
  segments: string[];
  charger: () => Observable<unknown>;
  prechargee: boolean;
}

// Origine fictive : sert à ignorer les liens externes et à lire le chemin d'un lien relatif.
const ORIGINE = 'http://local.invalid';

/** Chemin local d'un lien (sans requête ni fragment), ou null pour un lien externe. */
function cheminLocal(lien: string): string[] | null {
  const url = new URL(lien, ORIGINE);
  if (url.origin !== ORIGINE) return null;
  return url.pathname.split('/').filter((s) => s !== '');
}

/** Vrai si le chemin d'une route (« lois/:dossier ») correspond aux segments d'un lien. */
function correspond(modele: string[], segments: string[]): boolean {
  if (modele.length !== segments.length) return false;
  return modele.every((m, i) => (m.startsWith(':') ? segments[i] !== '' : m === segments[i]));
}

function planifier(tache: () => void): void {
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(tache);
  } else {
    setTimeout(tache);
  }
}

/**
 * Préchargement du code des routes paresseuses : une route est chargée quand un lien qui y mène
 * entre dans l'écran (voir AppLienVisible), une seule fois, pendant un moment d'inactivité.
 * Rien n'est chargé avec l'économiseur de données ni sur une connexion 2g.
 */
@Injectable({ providedIn: 'root' })
export class ViewportPreloadingStrategy extends PreloadingStrategy {
  private readonly routes: RouteChargeable[] = [];

  override preload(route: Route, charger: () => Observable<unknown>): Observable<unknown> {
    if (route.path !== undefined && route.path !== '**') {
      const segments = route.path.split('/').filter((s) => s !== '');
      this.routes.push({ segments, charger, prechargee: false });
    }
    return EMPTY;
  }

  /** Appelée quand un lien devient visible : précharge la route qu'il désigne, si elle existe. */
  lienVisible(lien: string): void {
    if (connexionLimitee()) return;
    const segments = cheminLocal(lien);
    if (segments === null) return;

    const route = this.routes.find((r) => !r.prechargee && correspond(r.segments, segments));
    if (!route) return;

    route.prechargee = true;
    planifier(() => {
      route
        .charger()
        .pipe(catchError(() => EMPTY))
        .subscribe();
    });
  }
}
