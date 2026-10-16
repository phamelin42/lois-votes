import { afterNextRender, Directive, DestroyRef, ElementRef, inject, Injector } from '@angular/core';
import { ViewportPreloadingStrategy } from './viewport-preloading.strategy';

/**
 * Signale à la stratégie de préchargement chaque lien routerLink qui entre dans l'écran.
 * Côté serveur, aucun IntersectionObserver : la directive ne fait alors rien.
 */
@Directive({
  // Sélecteur d'attribut posé sur les liens de RouterLink : il n'a pas le préfixe « app ».
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'a[routerLink]',
})
export class AppLienVisible {
  private readonly element = inject<ElementRef<HTMLAnchorElement>>(ElementRef);
  private readonly strategie = inject(ViewportPreloadingStrategy);
  private readonly destruction = inject(DestroyRef);
  private readonly injecteur = inject(Injector);

  constructor() {
    afterNextRender(
      () => {
        if (typeof IntersectionObserver === 'undefined') return;

        const observateur = new IntersectionObserver((entrees) => {
          for (const entree of entrees) {
            if (!entree.isIntersecting) continue;
            observateur.unobserve(entree.target);
            this.strategie.lienVisible(entree.target.getAttribute('href') ?? '');
          }
        });
        observateur.observe(this.element.nativeElement);
        this.destruction.onDestroy(() => observateur.disconnect());
      },
      { injector: this.injecteur },
    );
  }
}
