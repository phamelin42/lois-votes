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
  /** Chemins de liens devenus visibles avant que le routeur ait déclaré la route qu'ils désignent. */
  private readonly enAttente: string[][] = [];

  override preload(route: Route, charger: () => Observable<unknown>): Observable<unknown> {
    if (route.path !== undefined && route.path !== '**') {
      const segments = route.path.split('/').filter((s) => s !== '');
      const declaree: RouteChargeable = { segments, charger, prechargee: false };
      this.routes.push(declaree);
      // L'en-tête peut être visible avant la première navigation : on applique les liens reçus trop tôt.
      const attente = this.enAttente.findIndex((lien) => correspond(segments, lien));
      if (attente >= 0) {
        this.enAttente.splice(attente, 1);
        this.precharger(declaree);
      }
    }
    return EMPTY;
  }

  /** Appelée quand un lien devient visible : précharge la route qu'il désigne, si elle est déjà connue. */
  lienVisible(lien: string): void {
    if (connexionLimitee()) return;
    const segments = cheminLocal(lien);
    if (segments === null) return;

    const route = this.routes.find((r) => !r.prechargee && correspond(r.segments, segments));
    if (route) {
      this.precharger(route);
      return;
    }
    // Route pas encore déclarée : on garde le lien (une seule fois) pour l'appliquer dans preload().
    const dejaNote = this.enAttente.some((attente) => attente.join('/') === segments.join('/'));
    if (!dejaNote) this.enAttente.push(segments);
  }

  private precharger(route: RouteChargeable): void {
    route.prechargee = true;
    planifier(() => {
      route
        .charger()
        .pipe(catchError(() => EMPTY))
        .subscribe();
    });
  }
}
