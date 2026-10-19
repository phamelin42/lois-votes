import { TestBed } from '@angular/core/testing';
import { compte } from '../../testing/builders';
import { AppVoteBar } from './vote-bar';

function monter(entrees: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(AppVoteBar);
  fixture.componentRef.setInput('compte', compte());
  for (const [cle, valeur] of Object.entries(entrees)) fixture.componentRef.setInput(cle, valeur);
  fixture.detectChanges();
  return { fixture, racine: fixture.nativeElement as HTMLElement };
}

const espaces = (texte: string | null | undefined) => (texte ?? '').replace(/\s+/g, ' ').trim();
const etiquette = (racine: HTMLElement) =>
  espaces(racine.querySelector('[role="img"]')!.getAttribute('aria-label'));
const chiffres = (racine: HTMLElement) =>
  espaces(racine.querySelector('.app-vote-bar__chiffres')!.textContent);

describe('AppVoteBar', () => {
  it('est une image décrite en toutes lettres : votants, pourcentages, comptes', () => {
    const { racine } = monter({ compte: compte(351, 179, 7, 0) });

    expect(etiquette(racine)).toBe(
      'Sur 537 votants : 351 pour (66 %), 179 contre (33 %), 7 abstentions (1 %)',
    );
  });

  it('accorde le singulier', () => {
    const { racine } = monter({ compte: compte(1, 1, 1, 1) });

    expect(etiquette(racine)).toBe(
      'Sur 3 votants : 1 pour (34 %), 1 contre (33 %), 1 abstention (33 %), 1 non-votant',
    );
  });

  it('écrit les pourcentages et les nombres sous la barre : la couleur ne porte jamais seule', () => {
    const { racine } = monter({ compte: compte(351, 179, 7, 0) });

    expect(chiffres(racine)).toBe('66 % pour (351) · 33 % contre (179) · 1 % abst. (7)');
  });

  it('arrondit sans que la somme dépasse 100 : 1/3, 1/3, 1/3 donne 34, 33, 33', () => {
    const { racine } = monter({ compte: compte(10, 10, 10, 0) });
    const nombres = [...chiffres(racine).matchAll(/(\d+)\s%/g)].map((m) => Number(m[1]));

    expect(nombres).toEqual([34, 33, 33]);
    expect(nombres.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('garde une somme de 100 sur des cas aux arrondis ingrats', () => {
    for (const [p, c, a] of [
      [1, 1, 0],
      [2, 1, 0],
      [5, 5, 1],
      [127, 3, 3],
      [999, 1, 0],
    ]) {
      const { racine } = monter({ compte: compte(p, c, a, 0) });
      const nombres = [...chiffres(racine).matchAll(/(\d+)\s%/g)].map((m) => Number(m[1]));

      expect(
        nombres.reduce((x, y) => x + y, 0),
        `${p}/${c}/${a}`,
      ).toBe(100);
    }
  });

  it('formate les pourcentages à la française (espace avant le signe %)', () => {
    const { racine } = monter({ compte: compte(1, 0, 0, 0) });

    expect(racine.querySelector('.app-vote-bar__chiffres')!.textContent).toMatch(/100\s%\spour/);
  });

  it('répartit la largeur sur les votants avec flex-grow, sans JS de mise en page', () => {
    const { racine } = monter();
    const grow = (type: string) =>
      Number(
        (racine.querySelector(`.app-vote-bar__segment--${type}`) as HTMLElement).style.flexGrow,
      );

    expect(grow('pour')).toBe(312);
    expect(grow('contre')).toBe(201);
    expect(grow('abstention')).toBe(18);
  });

  it("ne dessine pas les non-votants : la barre est celle des votants, la ligne dessous dit qui n'a pas voté", () => {
    const { racine } = monter();

    expect(racine.querySelector('.app-vote-bar__segment--nonvotant')).toBeNull();
    expect(racine.querySelectorAll('.app-vote-bar__segment')).toHaveLength(3);
  });

  it('omet les segments vides', () => {
    const { racine } = monter({ compte: compte(10, 0, 0, 0) });

    expect(racine.querySelectorAll('.app-vote-bar__segment')).toHaveLength(1);
    expect(racine.querySelector('.app-vote-bar__segment--pour')).not.toBeNull();
  });

  describe('sans entrée enMandat', () => {
    it("n'écrit pas la ligne « n'ont pas voté »", () => {
      const { racine } = monter();

      expect(racine.querySelector('.app-vote-bar__absents')).toBeNull();
      expect(espaces(racine.textContent)).not.toContain('pas voté');
    });

    it('mentionne les non-votants dans la description quand il y en a (petites barres par groupe)', () => {
      const { racine } = monter({ compte: compte(3, 0, 1, 2), taille: 'sm' });

      expect(etiquette(racine)).toContain('2 non-votants');
    });
  });

  describe("avec l'entrée enMandat", () => {
    it("écrit « N n'ont pas voté sur M en mandat (x %) »", () => {
      const { racine } = monter({ compte: compte(351, 179, 7, 0), enMandat: 577 });
      const ligne = racine.querySelector('.app-vote-bar__absents')!;

      // 577 − (351 + 179 + 7) = 40
      expect(espaces(ligne.textContent)).toMatch(/^40 n'ont pas voté sur 577 en mandat \(7\s%\)$/);
    });

    it("compte dans « n'ont pas voté » les non-votants officiels et les absents", () => {
      const { racine } = monter({ compte: compte(100, 20, 10, 5), enMandat: 577 });

      expect(espaces(racine.querySelector('.app-vote-bar__absents')!.textContent)).toContain(
        "447 n'ont pas voté sur 577 en mandat",
      );
    });

    it("complète la description : votants, pourcentages, puis ceux qui n'ont pas voté", () => {
      const { racine } = monter({ compte: compte(351, 179, 7, 0), enMandat: 577 });

      expect(etiquette(racine)).toMatch(
        /^Sur 537 votants : 351 pour \(66\s%\), 179 contre \(33\s%\), 7 abstentions \(1\s%\), 40 n'ont pas voté sur 577 en mandat \(7\s%\)$/,
      );
    });

    it("accorde « n'a pas voté » au singulier", () => {
      const { racine } = monter({ compte: compte(5, 4, 1, 0), enMandat: 11 });

      expect(espaces(racine.querySelector('.app-vote-bar__absents')!.textContent)).toMatch(
        /^1 n'a pas voté sur 11 en mandat/,
      );
    });

    it('ne dit jamais 0 % ni 100 % quand ce serait faux', () => {
      const presque = monter({ compte: compte(1, 0, 0, 0), enMandat: 1000 }).racine;
      const quasiTous = monter({ compte: compte(1000, 0, 0, 0), enMandat: 1001 }).racine;
      const tous = monter({ compte: compte(10, 0, 0, 0), enMandat: 10 }).racine;

      expect(espaces(presque.querySelector('.app-vote-bar__absents')!.textContent)).toMatch(
        /\(99\s%\)$/,
      );
      expect(espaces(quasiTous.querySelector('.app-vote-bar__absents')!.textContent)).toMatch(
        /\(moins de 1\s%\)$/,
      );
      expect(espaces(tous.querySelector('.app-vote-bar__absents')!.textContent)).toMatch(
        /^0 n'a pas voté sur 10 en mandat \(0\s%\)$/,
      );
    });

    it("n'écrit pas la ligne sans député en mandat", () => {
      const { racine } = monter({ compte: compte(0, 0, 0, 0), enMandat: 0 });

      expect(racine.querySelector('.app-vote-bar__absents')).toBeNull();
    });
  });

  it('reste lisible sans aucun votant, sans division par zéro', () => {
    const { racine } = monter({ compte: compte(0, 0, 0, 0), enMandat: 577 });

    expect(etiquette(racine)).toBe(
      "Aucun vote exprimé, 577 n'ont pas voté sur 577 en mandat (100 %)",
    );
    expect(chiffres(racine)).toBe('Aucun vote exprimé');
    expect(racine.querySelectorAll('.app-vote-bar__segment')).toHaveLength(0);
    expect(espaces(racine.textContent)).not.toMatch(/NaN|Infinity/);
  });

  it('prend la taille md par défaut et accepte sm', () => {
    const { fixture, racine } = monter();
    expect(racine.querySelector('.app-vote-bar')!.classList.contains('app-vote-bar--sm')).toBe(
      false,
    );

    fixture.componentRef.setInput('taille', 'sm');
    fixture.detectChanges();

    expect(racine.querySelector('.app-vote-bar')!.classList.contains('app-vote-bar--sm')).toBe(
      true,
    );
  });
});
