import { expect, test, type Page } from '@playwright/test';
import { attendreHydratation } from './aide';

const TITRE_COURT = 'Projet de loi relatif à la modernisation';
const TITRE_LONG =
  'Projet de loi relatif à la simplification de la vie économique, au renforcement de la souveraineté ' +
  'industrielle et énergétique, à la transition écologique des territoires et à la protection des consommateurs ' +
  'dans les outre-mer et en métropole, adopté par le Sénat après engagement de la procédure accélérée';

/** Hauteurs (boundingBox) de toutes les cartes de l'accueil. */
async function hauteurs(page: Page) {
  const cartes = page.locator('a.app-loi-card');
  const nombre = await cartes.count();
  const resultat: number[] = [];
  for (let i = 0; i < nombre; i++) resultat.push((await cartes.nth(i).boundingBox())!.height);
  return resultat;
}

for (const largeur of [375, 1280]) {
  test.describe(`cartes de l'accueil à ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 900 } });

    test('toutes les cartes ont la même hauteur, titres courts ou longs', async ({ page }) => {
      await page.goto('/');
      await attendreHydratation(page);

      const naturelles = await hauteurs(page);
      expect(naturelles.length).toBeGreaterThanOrEqual(10);
      expect(new Set(naturelles).size).toBe(1);

      // Titres du jeu de test mêlés à un titre très court et à un titre très long, sur le titre et sur le résumé.
      await page.evaluate(
        ({ court, long }) => {
          const titres = document.querySelectorAll<HTMLElement>('.app-loi-card__titre');
          const officiels = document.querySelectorAll<HTMLElement>('.app-loi-card__officiel');
          titres.forEach(
            (t, i) => (t.textContent = i % 3 === 0 ? court : i % 3 === 1 ? long : t.textContent),
          );
          officiels.forEach((o, i) => (o.textContent = i % 2 === 0 ? 'Court.' : long.repeat(3)));
        },
        { court: TITRE_COURT, long: TITRE_LONG },
      );
      const melangees = await hauteurs(page);
      expect(new Set(melangees).size).toBe(1);
      expect(melangees[0]).toBe(naturelles[0]);
    });

    test("le contenu d'une carte ne dépasse jamais sa hauteur fixe", async ({ page }) => {
      await page.goto('/');
      await attendreHydratation(page);
      await page.evaluate((long) => {
        document
          .querySelectorAll<HTMLElement>('.app-loi-card__titre, .app-loi-card__officiel')
          .forEach((e) => (e.textContent = long.repeat(3)));
        // Pire cas réaliste : les chiffres de la barre et la ligne « n'ont pas voté » passent sur deux lignes.
        document.querySelectorAll<HTMLElement>('.app-vote-bar__chiffres').forEach((e) => {
          e.textContent =
            '100 % pour (574) · 100 % contre (574) · 100 % abst. (574) · 100 % pour (574) · 100 % contre';
        });
        document.querySelectorAll<HTMLElement>('.app-vote-bar__absents').forEach((e) => {
          e.textContent =
            "574 n'ont pas voté sur 574 en mandat (100 %) · 574 n'ont pas voté sur 574";
        });
      }, TITRE_LONG);

      const debordements = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('a.app-loi-card'))
          .filter((c) => {
            const carte = c.getBoundingClientRect();
            const contenu = c.querySelector<HTMLElement>('.fd-card__body')!;
            // Le dernier élément (pastilles ou barre) reste dans la carte, et rien n'est coupé par le bas.
            const dernier = c
              .querySelector<HTMLElement>('app-group-pills')!
              .getBoundingClientRect();
            return contenu.scrollHeight > contenu.clientHeight || dernier.bottom > carte.bottom;
          })
          .map((c) => c.querySelector('.app-loi-card__titre')!.textContent),
      );
      expect(debordements).toEqual([]);
    });

    test('les pastilles de groupes tiennent sur une ligne', async ({ page }) => {
      await page.goto('/');
      await attendreHydratation(page);

      const lignes = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('.app-loi-card .app-group-pills')).map(
          (ul) => {
            const visibles = Array.from(ul.children).filter(
              (li) => li.getBoundingClientRect().bottom <= ul.getBoundingClientRect().bottom + 1,
            );
            return new Set(visibles.map((li) => Math.round(li.getBoundingClientRect().top))).size;
          },
        ),
      );
      expect(lignes.every((n) => n === 1)).toBe(true);
    });

    test('la barre de vote est au bas de la carte', async ({ page }) => {
      await page.goto('/');
      await attendreHydratation(page);

      const ecarts = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('a.app-loi-card')).map((c) => {
          const bas = c.getBoundingClientRect().bottom;
          const pastilles = c.querySelector('app-group-pills')!.getBoundingClientRect().bottom;
          return bas - pastilles;
        }),
      );
      // Même écart (le padding du bas) sur toutes les cartes.
      expect(new Set(ecarts.map((e) => Math.round(e))).size).toBe(1);
    });
  });
}

test.describe('espace autour de la liste et du bouton « Voir plus » (accueil)', () => {
  test("la liste a de l'air en haut et en bas de la page", async ({ page }) => {
    await page.goto('/');
    await attendreHydratation(page);

    const bas = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>('.app-accueil')!;
      const s = getComputedStyle(section);
      return { haut: parseFloat(s.paddingTop), bas: parseFloat(s.paddingBottom) };
    });
    expect(bas.haut).toBeGreaterThan(0);
    expect(bas.bas).toBeGreaterThan(0);
  });
});

test.describe('en-tête : champ de recherche', () => {
  test('le libellé est dans le placeholder et le champ garde son nom accessible', async ({
    page,
  }) => {
    await page.goto('/');
    await attendreHydratation(page);
    const champ = page.getByRole('combobox', { name: 'Rechercher' });

    await expect(champ).toHaveAttribute('placeholder', /^Rechercher/);
    // Aucun libellé visible au-dessus du champ.
    const libelle = page.locator('.app-search__libelle');
    const boite = await libelle.boundingBox();
    expect(boite === null || (boite.width <= 1 && boite.height <= 1)).toBe(true);
  });

  test("le champ est aligné verticalement avec le reste de l'en-tête (1280 px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await attendreHydratation(page);

    const centre = async (selecteur: string) => {
      const b = (await page.locator(selecteur).first().boundingBox())!;
      return b.y + b.height / 2;
    };
    const champ = await centre('.app-search__input');
    const nom = await centre('.app-shell__nom');
    const bascule = await centre('.app-shell__bascule');
    expect(Math.abs(champ - nom)).toBeLessThanOrEqual(2);
    expect(Math.abs(champ - bascule)).toBeLessThanOrEqual(2);
  });
});

test.describe('vote solennel ou vote ordinaire', () => {
  test('la page du scrutin 8706 (solennel) le dit en toutes lettres', async ({ page }) => {
    await page.goto('/scrutins/8706');
    await attendreHydratation(page);

    await expect(page.locator('.app-scrutin__resultat')).toContainText('Vote solennel');
    await expect(page.getByText('Vote solennel : tous les députés sont convoqués.')).toBeVisible();
  });

  test('une loi dont le vote final est ordinaire le dit aussi, avec sa phrase', async ({
    page,
  }) => {
    await page.goto('/');
    await attendreHydratation(page);
    // Une carte « Vote ordinaire » de l'accueil mène à sa page : le badge et la phrase y sont.
    const carte = page.locator('a.app-loi-card', { hasText: 'Vote ordinaire' }).first();
    await expect(carte).toBeVisible();
    await carte.click();
    await page.waitForURL(/\/(lois|scrutins)\//);
    await expect(
      page.getByText(/^Vote ordinaire : en séance, seuls les députés présents/),
    ).toBeVisible();
  });

  test("les cartes de l'accueil portent un badge « Vote solennel » ou « Vote ordinaire »", async ({
    page,
  }) => {
    await page.goto('/');
    await attendreHydratation(page);

    const cartes = page.locator('a.app-loi-card');
    const nombre = await cartes.count();
    for (let i = 0; i < nombre; i++) {
      await expect(cartes.nth(i)).toContainText(/Vote (solennel|ordinaire)/);
    }
    await expect(
      page.locator('a.app-loi-card', { hasText: 'Vote solennel' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('a.app-loi-card', { hasText: 'Vote ordinaire' }).first(),
    ).toBeVisible();
  });

  test('/a-propos explique la différence et pourquoi la participation paraît basse', async ({
    page,
  }) => {
    await page.goto('/a-propos');

    await expect(
      page.getByRole('heading', { name: 'Vote solennel et vote ordinaire' }),
    ).toBeVisible();
    await expect(
      page.getByText("Pourquoi la participation d'un député paraît basse"),
    ).toBeVisible();
  });
});
