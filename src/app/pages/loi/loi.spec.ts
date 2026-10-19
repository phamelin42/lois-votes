import { By, Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { AppPrefetch } from '../../data/prefetch';
import { LFI, loiDetail, scrutin } from '../../testing/builders';
import { configurerPage, monter, sansEspaces, stabiliser } from '../../testing/page';
import { LoiPage } from './loi';

async function afficher(detail = loiDetail()) {
  const ctx = configurerPage();
  const fixture = monter(LoiPage, { dossier: 'DLR5L17N54372' });
  ctx.http.expectOne('/api/lois/DLR5L17N54372').flush(detail);
  const racine = await stabiliser(fixture);
  return { ...ctx, fixture, racine };
}

describe('LoiPage', () => {
  it('annonce le titre court, le titre officiel et la lecture', async () => {
    const { racine } = await afficher();

    expect(racine.querySelectorAll('h1')).toHaveLength(1);
    expect(racine.querySelector('h1')!.textContent!.trim()).toBe(
      'Projet de loi relatif à la sobriété foncière',
    );
    expect(sansEspaces(racine.textContent)).toContain(
      "l'ensemble du projet de loi relatif à la sobriété foncière",
    );
    expect(sansEspaces(racine.textContent)).toContain('première lecture');
  });

  it("renvoie vers le scrutin sur le site de l'Assemblée", async () => {
    const { racine } = await afficher();
    const lien = Array.from(racine.querySelectorAll('a')).find((a) =>
      a.textContent!.includes("Voir le scrutin sur le site de l'Assemblée"),
    )!;

    expect(lien.getAttribute('href')).toBe(
      'https://www.assemblee-nationale.fr/dyn/17/scrutins/8317',
    );
  });

  it('montre le bloc « Vote final » : date, résultat, barre et tableau par groupe', async () => {
    const { racine } = await afficher();

    expect(sansEspaces(racine.querySelector('h2')!.textContent)).toContain('Vote final');
    expect(racine.querySelector('fd-badge')!.textContent!.trim()).toBe("Adopté par l'Assemblée");
    expect(racine.querySelector('app-vote-bar')).not.toBeNull();
    expect(racine.querySelector('app-group-table table')).not.toBeNull();
    expect(racine.querySelector('time')).not.toBeNull();
  });

  it("écrit combien de députés en mandat n'ont pas voté sur le vote final", async () => {
    const { racine } = await afficher();

    expect(sansEspaces(racine.querySelector('app-vote-bar')!.textContent)).toContain(
      "46 n'ont pas voté sur 577 en mandat",
    );
  });

  it('nomme les groupes sans aucun votant du vote final', async () => {
    const detail = loiDetail();
    detail.voteFinal = { ...detail.voteFinal!, groupesSansVotant: [LFI] };
    const { racine } = await afficher(detail);

    expect(sansEspaces(racine.querySelector('app-group-table')!.textContent)).toContain(
      'Groupes sans aucun votant sur ce scrutin : LFI-NFP.',
    );
  });

  it("n'affiche aucun statut, que la source ne fournit pas", async () => {
    const { racine } = await afficher();

    expect(sansEspaces(racine.textContent)).not.toMatch(/statut/i);
  });

  it("prévient quand il n'y a pas encore de vote sur l'ensemble", async () => {
    const { racine } = await afficher(loiDetail({ voteFinal: null }));

    expect(sansEspaces(racine.textContent)).toContain(
      "Pas encore de vote sur l'ensemble du texte.",
    );
    expect(racine.querySelector('app-group-table')).toBeNull();
  });

  it("propose la liste nominative derrière un bouton (bloc différé à l'interaction)", async () => {
    const { racine } = await afficher();
    const bouton = Array.from(racine.querySelectorAll('button')).find((b) =>
      b.textContent!.includes('Voir comment chaque député a voté'),
    );

    expect(bouton).toBeDefined();
  });

  it('liste les lectures précédentes avec un lien vers chaque scrutin', async () => {
    const lecture = scrutin(8100, { date: '2024-06-10T22:00:00+00:00', adopte: false });
    const { racine } = await afficher(loiDetail({ lectures: [lecture] }));
    const section = Array.from(racine.querySelectorAll('section, div')).find((s) =>
      s.querySelector('h2')?.textContent?.includes('Lectures précédentes'),
    )!;

    expect(section).toBeDefined();
    expect(section.querySelector('a')!.getAttribute('href')).toBe('/scrutins/8100');
    expect(section.textContent).toContain("Rejeté par l'Assemblée");
  });

  it("n'écrit pas « Lectures précédentes » sans lecture précédente", async () => {
    const { racine } = await afficher();

    expect(sansEspaces(racine.textContent)).not.toContain('Lectures précédentes');
  });

  it('annonce « Autres scrutins du texte » quand il y en a', async () => {
    const autres = [
      scrutin(8320, { type: 'amendement', titre: "l'amendement n° 12 de M. Dupont" }),
    ];
    const { racine } = await afficher(loiDetail({ scrutins: autres }));

    expect(sansEspaces(racine.textContent)).toContain('Autres scrutins du texte');
  });

  it("a un fil d'Ariane", async () => {
    const { racine } = await afficher();

    expect(racine.querySelector('fd-breadcrumb')).not.toBeNull();
  });

  it('pose appPrefetch sur les liens vers les scrutins', async () => {
    const { fixture } = await afficher(loiDetail({ lectures: [scrutin(8100)] }));
    const urls = fixture.debugElement
      .queryAll(By.directive(AppPrefetch))
      .map((d) => d.injector.get(AppPrefetch).appPrefetch());

    expect(urls).toContain('/api/scrutins/8100');
  });

  it('pose le titre de la page', async () => {
    await afficher();

    expect(TestBed.inject(Title).getTitle()).toContain(
      'Projet de loi relatif à la sobriété foncière',
    );
    expect(TestBed.inject(Title).getTitle()).toContain('Qui a voté quoi ?');
  });

  it('répond 404 et montre un état vide quand la loi est inconnue', async () => {
    const { http, init } = configurerPage();
    const fixture = monter(LoiPage, { dossier: 'DLR5L17N0' });

    http
      .expectOne('/api/lois/DLR5L17N0')
      .flush({ erreur: 'inconnu' }, { status: 404, statusText: 'Not Found' });
    const racine = await stabiliser(fixture);

    expect(init.status).toBe(404);
    expect(racine.querySelector('fd-empty-state')).not.toBeNull();
  });

  it('répond 503 et montre une alerte quand la source est indisponible', async () => {
    const { http, init } = configurerPage();
    const fixture = monter(LoiPage, { dossier: 'DLR5L17N1' });

    http
      .expectOne('/api/lois/DLR5L17N1')
      .flush({ erreur: 'panne' }, { status: 503, statusText: 'Service Unavailable' });
    const racine = await stabiliser(fixture);

    expect(init.status).toBe(503);
    expect(racine.querySelector('fd-alert')!.textContent).toContain(
      'Données momentanément indisponibles, réessayez dans une minute.',
    );
  });
});
