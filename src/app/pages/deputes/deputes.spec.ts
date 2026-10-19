import { By, Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { AppPrefetch } from '../../data/prefetch';
import { UDR_2024, UDR_2025, deputeListe } from '../../testing/builders';
import { configurerPage, monter, stabiliser } from '../../testing/page';
import { DeputesPage } from './deputes';

async function afficher(entrees: Record<string, unknown> = {}, liste = deputeListe()) {
  const ctx = configurerPage();
  const fixture = monter(DeputesPage, entrees);
  ctx.http.expectOne('/api/deputes').flush(liste);
  const racine = await stabiliser(fixture);
  const noms = () =>
    Array.from(racine.querySelectorAll('.app-depute-carte__nom')).map((n) => n.textContent!.trim());
  return { ...ctx, fixture, racine, noms };
}

describe('DeputesPage', () => {
  describe('photos', () => {
    it('affiche la photo officielle de chaque député dans sa carte, avec son nom en alternative textuelle', async () => {
      const { racine } = await afficher();
      const images = Array.from(racine.querySelectorAll<HTMLImageElement>('.app-depute-carte img'));

      expect(images).toHaveLength(5);
      const alice = images.find((i) => i.getAttribute('alt') === 'Alice Durand')!;
      expect(alice.getAttribute('src')).toBe(
        'https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/1001.jpg',
      );
      for (const image of images) {
        expect(image.getAttribute('alt')).not.toBe('');
        expect(image.getAttribute('src')).toMatch(/\/photos\/carre\/\d+\.jpg$/);
        expect(image.getAttribute('src')).not.toContain('/PA');
      }
    });

    it('donne à chaque image ses dimensions (64 px) pour éviter tout décalage, et la charge sans bloquer', async () => {
      const { racine } = await afficher();

      for (const image of Array.from(racine.querySelectorAll('.app-depute-carte img'))) {
        expect(image.getAttribute('width')).toBe('64');
        expect(image.getAttribute('height')).toBe('64');
        expect(image.getAttribute('loading')).toBe('lazy');
        expect(image.getAttribute('decoding')).toBe('async');
        expect(image.getAttribute('fetchpriority')).not.toBe('high');
      }
    });

    it("se replie sur les initiales quand l'image échoue, dans la même carte", async () => {
      const { racine, fixture } = await afficher();
      const carte = racine.querySelector('.app-depute-carte')!;

      carte.querySelector('img')!.dispatchEvent(new Event('error'));
      await stabiliser(fixture);

      expect(carte.querySelector('img')).toBeNull();
      expect(carte.querySelector('fd-avatar')).not.toBeNull();
      expect(carte.querySelector('.app-depute-carte__nom')).not.toBeNull();
    });

    it("garde un seul lien par carte : l'image est dans le lien, pas un second lien", async () => {
      const { racine } = await afficher();

      for (const carte of Array.from(racine.querySelectorAll('.app-depute-carte'))) {
        expect(carte.querySelectorAll('a')).toHaveLength(1);
        expect(carte.querySelector('a img')).not.toBeNull();
      }
    });
  });

  it('liste les députés triés par nom de famille', async () => {
    const { noms, racine } = await afficher();

    expect(racine.querySelectorAll('h1')).toHaveLength(1);
    expect(noms()).toEqual([
      'Alice Durand',
      'Julie Fournier',
      'Émilie Laurent',
      'Bruno Martin',
      'Élodie Roux',
    ]);
  });

  it("filtre par groupe depuis le paramètre d'URL", async () => {
    const { noms } = await afficher({ groupe: 'RN' });

    expect(noms()).toEqual(['Alice Durand', 'Bruno Martin']);
  });

  it('confond les deux organes « UDR » : le filtre et la liste parlent en abrégés', async () => {
    const liste = deputeListe();
    liste.deputes.push({
      slug: 'eric-ciotti',
      pa: '1100',
      nom: 'Éric Ciotti',
      nomTri: 'Ciotti',
      groupe: 'UDR',
      departement: '06',
      circonscription: 'Alpes-Maritimes (1)',
    });
    liste.groupes.push(UDR_2024, UDR_2025);

    const { noms, racine } = await afficher({ groupe: 'UDR' }, liste);

    expect(noms()).toEqual(['Éric Ciotti']);
    expect(
      racine.querySelector('.app-depute-carte app-group-pill')!.textContent!.replace(/\s+/g, ' '),
    ).toContain('UDR');
    const select = racine.querySelector('fd-select')!;
    const options = Array.from(select.querySelectorAll('option, [role="option"]'));
    expect(
      options.filter((o) => o.textContent!.trim() === 'Union des droites pour la République'),
    ).toHaveLength(1);
    expect(options.filter((o) => o.textContent!.trim() === 'UDR')).toHaveLength(0);
  });

  it("filtre par département depuis le paramètre d'URL", async () => {
    const { noms } = await afficher({ dept: '69' });

    expect(noms()).toEqual(['Alice Durand', 'Julie Fournier', 'Émilie Laurent']);
  });

  it('filtre par nom sans tenir compte des accents ni de la casse', async () => {
    const { noms } = await afficher({ q: 'EMILIE' });

    expect(noms()).toEqual(['Émilie Laurent']);
  });

  it('combine les filtres', async () => {
    const { noms } = await afficher({ groupe: 'RN', dept: '69' });

    expect(noms()).toEqual(['Alice Durand']);
  });

  it('propose des filtres libellés : groupe, département et nom', async () => {
    const { racine } = await afficher();

    expect(racine.querySelectorAll('fd-select')).toHaveLength(2);
    expect(racine.querySelector('fd-text-field')).not.toBeNull();
  });

  it('montre un état vide quand aucun député ne correspond', async () => {
    const { racine, noms } = await afficher({ q: 'zzzzzz' });

    expect(noms()).toEqual([]);
    expect(racine.querySelector('fd-empty-state')).not.toBeNull();
  });

  it('affiche la photo (ou les initiales), le nom, le groupe et la circonscription de chaque carte', async () => {
    const { racine } = await afficher({ q: 'durand' });
    const carte = racine.querySelector('.app-depute-carte')!;

    expect(carte.querySelector('app-deputy-photo')).not.toBeNull();
    expect(carte.querySelector('app-group-pill')).not.toBeNull();
    expect(carte.textContent).toContain('Rhône (7)');
    expect(carte.querySelector('a')!.getAttribute('href')).toBe('/deputes/alice-durand');
  });

  it('pose appPrefetch vers le profil de chaque député', async () => {
    const { fixture } = await afficher({ groupe: 'RN' });
    const urls = fixture.debugElement
      .queryAll(By.directive(AppPrefetch))
      .map((d) => d.injector.get(AppPrefetch).appPrefetch());

    expect(urls).toEqual(['/api/deputes/alice-durand', '/api/deputes/bruno-martin']);
  });

  it("n'affiche que 60 résultats, puis « Afficher plus »", async () => {
    const liste = deputeListe();
    liste.deputes = Array.from({ length: 70 }, (_, i) => ({
      slug: `depute-${String(i).padStart(2, '0')}`,
      pa: String(2000 + i),
      nom: `Député ${String(i).padStart(2, '0')}`,
      nomTri: `Député ${String(i).padStart(2, '0')}`,
      groupe: 'RN',
      departement: '69',
      circonscription: 'Rhône (1)',
    }));
    const { fixture, racine, noms } = await afficher({}, liste);
    const plus = () =>
      Array.from(racine.querySelectorAll('button')).find((b) =>
        b.textContent!.includes('Afficher plus'),
      );

    expect(noms()).toHaveLength(60);
    plus()!.click();
    await stabiliser(fixture);

    expect(noms()).toHaveLength(70);
    expect(plus()).toBeUndefined();
  });

  it('pose le titre de la page', async () => {
    await afficher();

    expect(TestBed.inject(Title).getTitle()).toContain('Qui a voté quoi ?');
  });

  it('répond 503 avec une alerte quand la source est indisponible', async () => {
    const { http, init } = configurerPage();
    const fixture = monter(DeputesPage);

    http
      .expectOne('/api/deputes')
      .flush({ erreur: 'panne' }, { status: 503, statusText: 'Service Unavailable' });
    const racine = await stabiliser(fixture);

    expect(init.status).toBe(503);
    expect(racine.querySelector('fd-alert')).not.toBeNull();
  });
});
