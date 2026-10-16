import {
  AfterViewInit,
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FdTextField } from 'fuda';
import type { DeputeListe } from '@contrat';
import { dateCourte, normaliser } from '../../data/format';

const MAX_PAR_GROUPE = 5;
let instances = 0;

interface Resultat {
  rang: number;
  url: string;
  titre: string;
  detail: string;
}

interface Section {
  libelle: string;
  items: Resultat[];
}

/**
 * Recherche d'un député ou d'une loi : combobox ARIA 1.2 sur le champ Fuda, dans un formulaire GET
 * qui fonctionne sans JavaScript. L'index n'est demandé qu'au premier focus.
 */
@Component({
  selector: 'app-search',
  imports: [FdTextField],
  templateUrl: './search.html',
  styleUrl: './search.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AppSearch implements AfterViewInit {
  /** Index des députés et des lois récentes ; `undefined` tant qu'il n'est pas chargé. */
  readonly index = input<DeputeListe | undefined>();
  /** Émis une seule fois, au premier focus du champ. */
  readonly besoinIndex = output<void>();

  private readonly router = inject(Router);
  private readonly identifiant = `app-search-${instances++}`;
  protected readonly listeId = `${this.identifiant}-liste`;
  private readonly champ = viewChild.required(FdTextField, { read: ElementRef<HTMLElement> });
  private demandeFaite = false;

  protected readonly requete = signal('');
  protected readonly ouvert = signal(false);
  protected readonly actif = signal(-1);

  protected readonly sections = computed<Section[]>(() => {
    const index = this.index();
    const q = normaliser(this.requete());
    if (!index || !q) return [];

    const deputes = index.deputes
      .filter((d) => normaliser(d.nom).includes(q))
      .slice(0, MAX_PAR_GROUPE)
      .map((d) => ({
        url: `/deputes/${encodeURIComponent(d.slug)}`,
        titre: d.nom,
        detail: [d.groupe, d.circonscription].filter(Boolean).join(' · '),
      }));
    const lois = index.loisRecentes
      .filter((l) => normaliser(l.titreCourt).includes(q))
      .slice(0, MAX_PAR_GROUPE)
      .map((l) => ({
        url: `/lois/${encodeURIComponent(l.dossier)}`,
        titre: l.titreCourt,
        detail: dateCourte(l.date),
      }));

    let rang = 0;
    return [
      { libelle: 'Députés', items: deputes },
      { libelle: 'Lois', items: lois },
    ]
      .filter((section) => section.items.length > 0)
      .map((section) => ({
        libelle: section.libelle,
        items: section.items.map((item) => ({ ...item, rang: rang++ })),
      }));
  });

  protected readonly resultats = computed(() => this.sections().flatMap((s) => s.items));
  protected readonly total = computed(() => this.resultats().length);
  protected readonly liste = computed(() => this.ouvert() && this.total() > 0);
  protected readonly annonce = computed(() => {
    if (!this.requete().trim()) return '';
    if (!this.index()) return 'Chargement de la recherche…';
    const n = this.total();
    if (n === 0) return 'Aucun résultat';
    return n === 1 ? '1 résultat' : `${n} résultats`;
  });

  constructor() {
    // Attributs ARIA et nom du champ, posés sur l'<input> natif que Fuda rend (il ne les expose pas).
    afterRenderEffect(() => {
      const saisie = this.champ().nativeElement.querySelector('input');
      if (!saisie) return;
      const actif = this.liste() && this.actif() >= 0 && this.actif() < this.total();

      saisie.name = 'q';
      saisie.setAttribute('autocomplete', 'off');
      saisie.setAttribute('role', 'combobox');
      saisie.setAttribute('aria-autocomplete', 'list');
      saisie.setAttribute('aria-controls', this.listeId);
      saisie.setAttribute('aria-expanded', String(this.liste()));
      if (actif) saisie.setAttribute('aria-activedescendant', this.idOption(this.actif()));
      else saisie.removeAttribute('aria-activedescendant');
    });
  }

  ngAfterViewInit(): void {
    // Le focus ne remonte pas du champ natif : l'écoute se fait sur l'<input> lui-même.
    this.champ().nativeElement.querySelector('input')?.addEventListener('focus', () => {
      if (this.demandeFaite) return;
      this.demandeFaite = true;
      this.besoinIndex.emit();
    });
  }

  protected idOption(rang: number): string {
    return `${this.identifiant}-option-${rang}`;
  }

  protected onSaisie(texte: string): void {
    this.requete.set(texte);
    this.ouvert.set(texte.trim() !== '');
    this.actif.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.deplacer(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.deplacer(-1);
        break;
      case 'Enter':
        this.valider(event);
        break;
      case 'Escape':
        if (!this.liste()) return;
        event.preventDefault();
        this.fermer();
        break;
    }
  }

  /** Quitter le formulaire ferme la liste ; un clic sur un résultat garde le focus (voir mousedown). */
  protected onFocusOut(event: FocusEvent, formulaire: HTMLFormElement): void {
    if (!formulaire.contains(event.relatedTarget as Node | null)) this.fermer();
  }

  protected choisir(url: string): void {
    void this.router.navigateByUrl(url);
    this.fermer();
  }

  private deplacer(delta: number): void {
    const total = this.total();
    if (total === 0) return;
    this.ouvert.set(true);
    const actuel = this.actif();
    if (actuel < 0) this.actif.set(delta > 0 ? 0 : total - 1);
    else this.actif.set((actuel + delta + total) % total);
  }

  /** Entrée : ouvre le résultat sélectionné, sinon lance la recherche complète (le formulaire sans JavaScript). */
  private valider(event: KeyboardEvent): void {
    const choisi = this.liste() && this.actif() >= 0 ? this.resultats()[this.actif()] : undefined;
    const q = this.requete().trim();
    if (!choisi && !q) return;
    event.preventDefault();
    this.choisir(choisi?.url ?? `/recherche?q=${encodeURIComponent(q)}`);
  }

  private fermer(): void {
    this.ouvert.set(false);
    this.actif.set(-1);
  }
}
