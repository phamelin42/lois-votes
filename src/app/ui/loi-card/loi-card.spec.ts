import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { dateCourte } from '../../data/format';
import { loiCarte } from '../../testing/builders';
import { AppLoiCard } from './loi-card';

function monter(loi = loiCarte()) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(AppLoiCard);
  fixture.componentRef.setInput('loi', loi);
  fixture.detectChanges();
  const racine = fixture.nativeElement as HTMLElement;
  return { racine, lien: racine.querySelector('a') as HTMLAnchorElement };
}

describe('AppLoiCard', () => {
  it('est une carte-lien Fuda vers la page de la loi', () => {
    const { lien } = monter();

    expect(lien.hasAttribute('fdCard') || lien.classList.contains('fd-card')).toBe(true);
    expect(lien.getAttribute('href')).toBe('/lois/DLR5L17N54372');
  });

  it("pointe vers le scrutin quand le vote n'est rattaché à aucun dossier", () => {
    const { lien } = monter(loiCarte(null, 8317));

    expect(lien.getAttribute('href')).toBe('/scrutins/8317');
  });

  it('écrit le titre court en titre et la lecture en sous-titre', () => {
    const { racine } = monter();

    expect(racine.querySelector('.app-loi-card__titre')!.textContent!.trim()).toBe(
      'Projet de loi relatif à la sobriété foncière',
    );
    expect(racine.querySelector('.app-loi-card__lecture')!.textContent!.trim()).toBe(
      'première lecture',
    );
  });

  it("n'écrit pas de lecture quand le titre n'en indique pas", () => {
    const { racine } = monter(loiCarte('DLR5L17N1', 1, { lecture: null }));

    expect(racine.querySelector('.app-loi-card__lecture')).toBeNull();
  });

  it('écrit le titre officiel, limité à 2 lignes par la feuille de style', () => {
    const { racine } = monter();
    const scss = readFileSync('src/app/ui/loi-card/loi-card.scss', 'utf8');

    expect(racine.querySelector('.app-loi-card__officiel')!.textContent).toContain(
      'adopté par le Sénat',
    );
    expect(scss).toMatch(/line-clamp:\s*2/);
  });

  it('affiche la date du vote final dans un élément <time>', () => {
    const { racine } = monter();
    const temps = racine.querySelector('time')!;

    expect(temps.textContent!.trim()).toBe(dateCourte('2024-10-07T22:00:00+00:00'));
    expect(temps.getAttribute('datetime')).toBe('2024-10-07T22:00:00+00:00');
  });

  it("affiche « Adopté par l'Assemblée »", () => {
    const { racine } = monter();

    expect(racine.querySelector('fd-badge')!.textContent!.trim()).toBe("Adopté par l'Assemblée");
    expect(racine.textContent).not.toMatch(/loi adoptée/i);
  });

  it("affiche « Rejeté par l'Assemblée »", () => {
    const { racine } = monter(
      loiCarte('DLR5L17N1', 1, { voteFinal: { ...loiCarte().voteFinal, adopte: false } }),
    );

    expect(racine.querySelector('fd-badge')!.textContent!.trim()).toBe("Rejeté par l'Assemblée");
  });

  it('contient la barre des votes et les pastilles de groupes', () => {
    const { racine } = monter();

    expect(racine.querySelector('app-vote-bar')).not.toBeNull();
    expect(racine.querySelector('app-group-pills')).not.toBeNull();
  });

  it("donne à la barre les députés en mandat : écrit combien n'ont pas voté", () => {
    const { racine } = monter();
    const texte = racine.textContent!.replace(/\s+/g, ' ');

    // 577 en mandat, 531 votants (312 + 201 + 18) : 46 n'ont pas voté.
    expect(texte).toContain("46 n'ont pas voté sur 577 en mandat (8");
    expect(texte).toMatch(/59\s%\spour \(312\)/);
  });

  it('écrit « Vote solennel » à côté du résultat', () => {
    const { racine } = monter();

    expect(
      Array.from(racine.querySelectorAll('fd-badge')).map((b) => b.textContent!.trim()),
    ).toEqual(["Adopté par l'Assemblée", 'Vote solennel']);
  });

  it('écrit « Vote ordinaire » à côté du résultat', () => {
    const { racine } = monter(
      loiCarte('DLR5L17N1', 1, { voteFinal: { ...loiCarte().voteFinal, solennel: false } }),
    );

    expect(
      Array.from(racine.querySelectorAll('fd-badge')).map((b) => b.textContent!.trim()),
    ).toEqual(["Adopté par l'Assemblée", 'Vote ordinaire']);
  });

  it('a une hauteur fixe, des titres coupés et des pastilles sur une ligne (feuille de style)', () => {
    const scss = readFileSync('src/app/ui/loi-card/loi-card.scss', 'utf8');

    expect(scss).toMatch(/\.app-loi-card\s*\{[^}]*\bheight:\s*calc\(/);
    expect(scss).toMatch(/\.app-loi-card__titre\s*\{[^}]*line-clamp:\s*2/);
    expect(scss).toMatch(/\.app-loi-card \.app-group-pills\s*\{[^}]*max-height:\s*1lh/);
  });

  it('a un nom accessible de lien qui ne se réduit pas à « Voir »', () => {
    const { lien } = monter();

    expect(lien.textContent).toContain('Projet de loi relatif à la sobriété foncière');
  });
});
