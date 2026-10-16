import { By, Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { AppPrefetch } from '../../data/prefetch';
import { deputeListe } from '../../testing/builders';
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
  it('liste les députés triés par nom de famille', async () => {
    const { noms, racine } = await afficher();

    expect(racine.querySelectorAll('h1')).toHaveLength(1);
    expect(noms()).toEqual(['Alice Durand', 'Julie Fournier', 'Émilie Laurent', 'Bruno Martin', 'Élodie Roux']);
  });

  it('filtre par groupe depuis le paramètre d\'URL', async () => {
    const { noms } = await afficher({ groupe: 'RN' });

    expect(noms()).toEqual(['Alice Durand', 'Bruno Martin']);
  });

  it('filtre par département depuis le paramètre d\'URL', async () => {
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

  it('n\'affiche que 60 résultats, puis « Afficher plus »', async () => {
    const liste = deputeListe();
    liste.deputes = Array.from({ length: 70 }, (_, i) => ({
      slug: `depute-${String(i).padStart(2, '0')}`,
      nom: `Député ${String(i).padStart(2, '0')}`,
      nomTri: `Député ${String(i).padStart(2, '0')}`,
      groupe: 'RN',
      departement: '69',
      circonscription: 'Rhône (1)',
    }));
    const { fixture, racine, noms } = await afficher({}, liste);
    const plus = () => Array.from(racine.querySelectorAll('button')).find((b) => b.textContent!.includes('Afficher plus'));

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

    http.expectOne('/api/deputes').flush({ erreur: 'panne' }, { status: 503, statusText: 'Service Unavailable' });
    const racine = await stabiliser(fixture);

    expect(init.status).toBe(503);
    expect(racine.querySelector('fd-alert')).not.toBeNull();
  });
});
