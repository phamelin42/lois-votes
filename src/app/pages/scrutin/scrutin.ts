import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-scrutin',
  templateUrl: './scrutin.html',
  styleUrl: './scrutin.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-scrutin' },
})
export class Scrutin {}
