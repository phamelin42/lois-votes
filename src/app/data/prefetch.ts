import { isPlatformBrowser } from '@angular/common';
import { Directive, inject, input, PLATFORM_ID } from '@angular/core';
import { economiseDonnees } from './connexion';

/**
 * Précharge les données d'un lien au premier survol, au focus ou au toucher : un seul `fetch`
 * de priorité basse, qui alimente le cache HTTP du navigateur (le BFF envoie Cache-Control).
 * Rien côté serveur, rien avec l'économiseur de données.
 */
@Directive({
  selector: '[appPrefetch]',
  host: {
    '(pointerenter)': 'precharger()',
    '(focus)': 'precharger()',
    '(touchstart)': 'precharger()',
  },
})
export class AppPrefetch {
  /** URL des données à précharger, par exemple « /api/lois/DLR5L17N54372 ». */
  readonly appPrefetch = input<string | undefined>();

  private readonly plateforme = inject(PLATFORM_ID);
  private dejaFait = false;

  precharger(): void {
    const url = this.appPrefetch();
    if (this.dejaFait || !url || !isPlatformBrowser(this.plateforme) || economiseDonnees()) return;

    this.dejaFait = true;
    fetch(url, { priority: 'low' }).catch(() => undefined);
  }
}
