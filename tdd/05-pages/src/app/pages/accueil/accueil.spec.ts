import { Title } from '@angular/platform-browser';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppPrefetch } from '../../data/prefetch';
import { accueil } from '../../testing/builders';
import { configurerPage, monter, stabiliser } from '../../testing/page';
import { AccueilPage } from './accueil';

const boutonPlus = (racine: HTMLElement) =>
  Array.from(racine.querySelectorAll('button')).find((b) => b.textContent!.includes('Voir plus')) as HTMLButtonElement | undefined;

describe('AccueilPage', () => {
  it('charge la première page et affiche les cartes', async () => {
    const { http } = configurerPage();
    const fixture = monter(AccueilPage);

    http.expectOne('/api/accueil?page=1').flush(accueil(2, 1, true));
    const racine = await stabiliser(fixture);

    expect(racine.querySelectorAll('app-loi-card')).toHaveLength(2);
    expect(racine.querySelector('h1')!.textContent).toContain('Les dernières lois votées');
  });

  it('« Voir plus » ajoute la page suivante à la liste, sans la remplacer ni toucher à l\'URL', async () => {
    const { http } = configurerPage();
    const fixture = monter(AccueilPage);
    http.expectOne('/api/accueil?page=1').flush(accueil(2, 1, true));
    const racine = await stabiliser(fixture);

    boutonPlus(racine)!.click();
    TestBed.tick();
    http.expectOne('/api/accueil?page=2').flush(accueil(1, 2, false));
    await stabiliser(fixture);

    const titres = Array.from(racine.querySelectorAll('.app-loi-card__titre')).map((t) => t.textContent!.trim());
    expect(titres).toEqual(['Loi numéro 1-1', 'Loi numéro 1-2', 'Loi numéro 2-1']);
    expect(boutonPlus(racine)).toBeUndefined();
    expect(TestBed.inject(Router).url).not.toContain('page');
  });

  it('pose appPrefetch sur chaque carte, vers la route de données de la loi', async () => {
    const { http } = configurerPage();
    const fixture = monter(AccueilPage);
    const donnees = accueil(2, 1, false);
    http.expectOne('/api/accueil?page=1').flush(donnees);
    await stabiliser(fixture);

    const urls = fixture.debugElement
      .queryAll(By.directive(AppPrefetch))
      .map((d) => d.injector.get(AppPrefetch).appPrefetch());
    expect(urls).toEqual(donnees.lois.map((l) => `/api/lois/${l.dossier}`));
  });

  it('pose le titre et la description de la page', async () => {
    const { http } = configurerPage();
    const fixture = monter(AccueilPage);
    http.expectOne('/api/accueil?page=1').flush(accueil(1));
    await stabiliser(fixture);

    expect(TestBed.inject(Title).getTitle()).toContain('Qui a voté quoi ?');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')?.length).toBeGreaterThan(20);
  });

  it('répond 503 et affiche une alerte quand la source est indisponible', async () => {
    const { http, init } = configurerPage();
    const fixture = monter(AccueilPage);

    http.expectOne('/api/accueil?page=1').flush({ erreur: 'panne' }, { status: 503, statusText: 'Service Unavailable' });
    const racine = await stabiliser(fixture);

    expect(racine.querySelector('fd-alert')!.textContent).toContain('Données momentanément indisponibles');
    expect(init.status).toBe(503);
  });
});
