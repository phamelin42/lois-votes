import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const NOM_DU_SITE = 'Qui a voté quoi ?';

/** Titre (« Page · Qui a voté quoi ? ») et métadonnées description et Open Graph de la page courante. */
@Injectable({ providedIn: 'root' })
export class PageMeta {
  private readonly titre = inject(Title);
  private readonly meta = inject(Meta);

  poser(page: string, description: string): void {
    const titre = `${page} · ${NOM_DU_SITE}`;
    this.titre.setTitle(titre);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: titre });
    this.meta.updateTag({ property: 'og:description', content: description });
  }
}
