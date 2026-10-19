import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import type { DeputeDetail } from '@contrat';
import {
  aLieu,
  ans,
  dateLongue,
  ordinalLegislature,
  periode as periodeEntre,
} from '../../data/format';

/** Les informations d'état civil et de mandat d'un député : naissance, profession, circonscription, mandat, groupes, fonctions, parti. */
@Component({
  selector: 'app-depute-profil',
  templateUrl: './depute-profil.html',
  styleUrl: './depute-profil.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-depute-profil' },
})
export class AppDeputeProfil {
  readonly depute = input.required<DeputeDetail>();

  /** « 13 avril 1973 (52 ans), à Beauvais » ; sans l'âge d'un député décédé, qui a sa propre ligne. */
  protected readonly naissance = computed(() => {
    const { naissance, deces } = this.depute();
    if (!naissance) return null;
    const age = deces ? '' : ` (${ans(naissance.age)})`;
    const lieu = naissance.lieu ? `, ${aLieu(naissance.lieu)}` : '';
    return `${dateLongue(naissance.date)}${age}${lieu}`;
  });

  /** « 7 juillet 2025 (à 59 ans) » */
  protected readonly deces = computed(() => {
    const { deces, naissance } = this.depute();
    if (!deces) return null;
    return naissance ? `${dateLongue(deces)} (à ${ans(naissance.age)})` : dateLongue(deces);
  });

  /** « En cours depuis le 30 juin 2024 » ou « Du 30 juin 2024 au 10 janvier 2026 ». */
  protected readonly mandat = computed(() => {
    const mandat = this.depute().mandat;
    if (!mandat) return null;
    const texte = periodeEntre(mandat.depuis, mandat.fin);
    return mandat.fin === null
      ? `En cours ${texte}`
      : texte.charAt(0).toUpperCase() + texte.slice(1);
  });

  /** « 15ᵉ, 16ᵉ et 17ᵉ législatures » */
  protected readonly legislatures = computed(() => {
    const numeros = this.depute().mandat?.legislatures ?? [];
    if (numeros.length === 0) return null;
    const ordinaux = numeros.map(ordinalLegislature);
    const liste =
      ordinaux.length > 1
        ? `${ordinaux.slice(0, -1).join(', ')} et ${ordinaux.at(-1)}`
        : ordinaux[0];
    return `${liste} ${numeros.length > 1 ? 'législatures' : 'législature'}`;
  });

  protected readonly groupes = computed(() =>
    this.depute().groupes.map(({ groupe, debut, fin }) => ({
      nom: `${groupe.libelle} (${groupe.abrege})`,
      periode: periodeEntre(debut, fin),
    })),
  );

  /** Une qualité qui nomme déjà l'Assemblée (« Vice-président de l'Assemblée nationale ») n'a pas besoin de répéter son bureau. */
  protected readonly fonctions = computed(() =>
    this.depute().fonctions.map(({ organe, qualite, depuis }) => ({
      intitule: qualite.includes('Assemblée nationale') ? qualite : `${qualite}, ${organe}`,
      periode: periodeEntre(depuis, null),
    })),
  );
}
