import {
  booleanAttribute,
  Component,
  computed,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FdAvatar } from 'fuda';

/**
 * Photo officielle d'un député. Sans photo, ou si l'image échoue, les initiales prennent sa place
 * (une nouvelle source tente à nouveau la photo).
 */
@Component({
  selector: 'app-deputy-photo',
  imports: [NgOptimizedImage, FdAvatar],
  templateUrl: './deputy-photo.html',
  styleUrl: './deputy-photo.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppDeputyPhoto {
  readonly src = input<string | null>(null);
  readonly nom = input.required<string>();
  readonly taille = input<64 | 160>(64);
  /** Image de la page (LCP) : chargée tout de suite, sinon paresseusement. */
  readonly priority = input(false, { transform: booleanAttribute });

  private readonly echec = signal<string | null>(null);

  protected readonly photo = computed(() => {
    const src = this.src();
    return src && src !== this.echec() ? src : null;
  });
  protected readonly avatar = computed(() => (this.taille() === 160 ? 'xl' : 'lg'));

  protected echoue(): void {
    this.echec.set(this.src());
  }
}
