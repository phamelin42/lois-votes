import { By, Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { AppPrefetch } from '../../data/prefetch';
import { deputeDetail } from '../../testing/builders';
import { configurerPage, monter, sansEspaces, stabiliser } from '../../testing/page';
import { DeputePage } from './depute';

async function afficher(detail = deputeDetail()) {
  const ctx = configurerPage();
  const fixture = monter(DeputePage, { slug: 'alice-durand' });
  ctx.http.expectOne('/api/deputes/alice-durand').flush(detail);
  const racine = await stabiliser(fixture);
  return { ...ctx, fixture, racine };
}

const tuile = (racine: HTMLElement, titre: string) =>
  Array.from(racine.querySelectorAll('.app-depute__tuile')).find((t) =>
    t.textContent!.includes(titre),
  ) as HTMLElement | undefined;

describe('DeputePage', () => {
  it('annonce le nom en h1, le parti et la circonscription', async () => {
    const { racine } = await afficher();

    expect(racine.querySelectorAll('h1')).toHaveLength(1);
    expect(racine.querySelector('h1')!.textContent!.trim()).toBe('Alice Durand');
    expect(racine.querySelector('app-group-pill')).not.toBeNull();
    expect(sansEspaces(racine.textContent)).toContain('Rassemblement National');
    expect(sansEspaces(racine.textContent)).toContain('Rhône (7)');
  });

  it('affiche la photo officielle, chargée en priorité (LCP)', async () => {
    const { racine } = await afficher();
    const image = racine.querySelector('img')!;

    expect(image.getAttribute('src')).toContain('/photos/carre/1001.jpg');
    expect(image.getAttribute('width')).toBe('160');
    expect(image.getAttribute('fetchpriority')).toBe('high');
  });

  it('se rabat sur les initiales sans photo', async () => {
    const { racine } = await afficher(deputeDetail({ photo: null }));

    expect(racine.querySelector('img')).toBeNull();
    expect(racine.querySelector('fd-avatar')).not.toBeNull();
  });

  it('renvoie vers la fiche officielle', async () => {
    const { racine } = await afficher();

    expect(
      Array.from(racine.querySelectorAll('a')).some(
        (a) => a.getAttribute('href') === 'https://www.assemblee-nationale.fr/dyn/deputes/PA1001',
      ),
    ).toBe(true);
  });

  it('montre les trois chiffres clés avec leur nom exact', async () => {
    const { racine } = await afficher();

    expect(sansEspaces(tuile(racine, 'Participation aux scrutins')!.textContent)).toContain('91 %');
    expect(sansEspaces(tuile(racine, "Taux d'abstention")!.textContent)).toContain('12 %');
    expect(sansEspaces(tuile(racine, 'Vote avec son groupe')!.textContent)).toContain('99 %');
  });

  it('accompagne chaque chiffre de sa source', async () => {
    const { racine } = await afficher();

    expect(sansEspaces(tuile(racine, 'Participation aux scrutins')!.textContent)).toContain(
      'Datan',
    );
  });

  it('écrit « — » quand un chiffre est inconnu', async () => {
    const { racine } = await afficher(
      deputeDetail({ taux: { participation: null, abstention: null, loyaute: null } }),
    );

    expect(sansEspaces(tuile(racine, 'Participation aux scrutins')!.textContent)).toContain('—');
    expect(sansEspaces(tuile(racine, 'Vote avec son groupe')!.textContent)).toContain('—');
  });

  it("n'écrit jamais « présence » : on parle de participation aux scrutins", async () => {
    const { racine } = await afficher();

    expect(sansEspaces(racine.textContent)).not.toMatch(/présence/i);
  });

  it('tabule ses votes sur les 10 dernières lois', async () => {
    const { racine } = await afficher();
    const lignes = Array.from(racine.querySelectorAll('tbody tr'));

    expect(sansEspaces(racine.textContent)).toContain('Ses votes sur les 10 dernières lois');
    expect(lignes).toHaveLength(3);
    expect(lignes[0].querySelector('a')!.getAttribute('href')).toBe('/lois/DLR5L17N54372');
    expect(lignes[0].querySelectorAll('app-position')).toHaveLength(2); // sa position, celle de son groupe
    expect(lignes[0].textContent).toContain("Adopté par l'Assemblée");
  });

  it("renvoie vers le scrutin quand le vote n'a pas de dossier", async () => {
    const { racine } = await afficher();
    const derniere = racine.querySelectorAll('tbody tr')[2];

    expect(derniere.querySelector('a')!.getAttribute('href')).toBe('/scrutins/8100');
    expect(derniere.textContent).toContain("Rejeté par l'Assemblée");
  });

  it('écrit « Différent de son groupe » (pas seulement une couleur) quand les positions diffèrent', async () => {
    const { racine } = await afficher();
    const lignes = Array.from(racine.querySelectorAll('tbody tr'));

    expect(lignes[0].textContent).toContain('Différent de son groupe');
    expect(lignes[1].textContent).not.toContain('Différent de son groupe');
    expect(lignes[2].textContent).not.toContain('Différent de son groupe');
  });

  it('pose appPrefetch vers les lois et scrutins de ses votes', async () => {
    const { fixture } = await afficher();
    const urls = fixture.debugElement
      .queryAll(By.directive(AppPrefetch))
      .map((d) => d.injector.get(AppPrefetch).appPrefetch());

    expect(urls).toEqual(expect.arrayContaining(['/api/lois/DLR5L17N54372', '/api/scrutins/8100']));
  });

  it("a un fil d'Ariane et un titre de page avec son nom", async () => {
    const { racine } = await afficher();

    expect(racine.querySelector('fd-breadcrumb')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toContain('Alice Durand');
  });

  it('répond 404 pour un député inconnu', async () => {
    const { http, init } = configurerPage();
    const fixture = monter(DeputePage, { slug: 'personne' });

    http
      .expectOne('/api/deputes/personne')
      .flush({ erreur: 'inconnu' }, { status: 404, statusText: 'Not Found' });
    const racine = await stabiliser(fixture);

    expect(init.status).toBe(404);
    expect(racine.querySelector('fd-empty-state')).not.toBeNull();
  });
});
