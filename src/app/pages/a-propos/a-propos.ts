import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-a-propos-page',
  templateUrl: './a-propos.html',
  styleUrl: './a-propos.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-a-propos' },
})
export class AProposPage {}
