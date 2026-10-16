import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-recherche-page',
  templateUrl: './recherche.html',
  styleUrl: './recherche.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-recherche' },
})
export class RecherchePage {}
