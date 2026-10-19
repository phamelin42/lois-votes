import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-accueil',
  templateUrl: './accueil.html',
  styleUrl: './accueil.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-accueil' },
})
export class Accueil {}
