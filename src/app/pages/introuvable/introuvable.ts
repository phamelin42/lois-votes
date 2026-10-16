import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-introuvable-page',
  templateUrl: './introuvable.html',
  styleUrl: './introuvable.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-introuvable' },
})
export class IntrouvablePage {}
