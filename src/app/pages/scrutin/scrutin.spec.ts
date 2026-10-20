import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { LFI, SOC, scrutinDetail } from '../../testing/builders';
import { configurerPage, monter, sansEspaces, stabiliser } from '../../testing/page';
import { ScrutinPage } from './scrutin';

async function afficher(detail = scrutinDetail()) {
  const ctx = configurerPage();
  const fixture = monter(ScrutinPage, { numero: '8317' });
  ctx.http.expectOne('/api/scrutins/8317').flush(detail);
  const racine = await stabiliser(fixture);
  return { ...ctx, fixture, racine };
}

describe('ScrutinPage', () => {
  it('montre le titre officiel, le résultat, la barre et le tableau par groupe', async () => {
    const { racine } = await afficher();

    expect(racine.querySelectorAll('h1')).toHaveLength(1);
    expect(sansEspaces(racine.querySelector('h1')!.textContent)).toContain(
      "l'ensemble du projet de loi relatif à la sobriété foncière",
    );
    expect(racine.querySelector('fd-badge')!.textContent!.trim()).toBe("Adopté par l'Assemblée");
    expect(racine.querySelector('app-vote-bar')).not.toBeNull();
    expect(racine.querySelector('app-group-table table')).not.toBeNull();
    expect(racine.querySelector('time')).not.toBeNull();
  });

  it('écrit « Vote solennel » et sa phrase pour un scrutin solennel', async () => {
    const { racine } = await afficher(scrutinDetail({ solennel: true }));

    expect(sansEspaces(racine.querySelector('.app-scrutin__resultat')!.textContent)).toContain(
      'Vote solennel',
    );
    expect(sansEspaces(racine.textContent)).toContain(
      'Vote solennel : tous les députés sont convoqués.',
    );
  });

  it('écrit « Vote ordinaire » et sa phrase pour un scrutin ordinaire', async () => {
    const { racine } = await afficher(scrutinDetail({ solennel: false }));

    expect(sansEspaces(racine.querySelector('.app-scrutin__resultat')!.textContent)).toContain(
      'Vote ordinaire',
    );
    expect(sansEspaces(racine.textContent)).toContain(
      "Vote ordinaire : en séance, seuls les députés présents dans l'hémicycle votent.",
    );
  });

  it("écrit combien de députés en mandat n'ont pas voté", async () => {
    const { racine } = await afficher();

    // 577 en mandat, 531 votants : 46 n'ont pas voté.
    expect(sansEspaces(racine.querySelector('app-vote-bar')!.textContent)).toContain(
      "46 n'ont pas voté sur 577 en mandat",
    );
  });

  it('nomme les groupes sans aucun votant sous le tableau', async () => {
    const { racine } = await afficher(scrutinDetail({ groupesSansVotant: [LFI, SOC] }));

    expect(sansEspaces(racine.querySelector('app-group-table')!.textContent)).toContain(
      'Groupes sans aucun votant sur ce scrutin : LFI-NFP, SOC.',
    );
  });

  it("n'écrit pas la note quand aucun groupe n'est sans votant", async () => {
    const { racine } = await afficher();

    expect(sansEspaces(racine.textContent)).not.toContain('Groupes sans aucun votant');
  });

  it('renvoie vers la loi quand elle est connue, et vers la page officielle', async () => {
    const { racine } = await afficher();
    const liens = Array.from(racine.querySelectorAll('a'));

    expect(liens.find((a) => a.getAttribute('href') === '/lois/DLR5L17N54372')).toBeDefined();
    expect(
      liens.find(
        (a) => a.getAttribute('href') === 'https://www.assemblee-nationale.fr/dyn/17/scrutins/8317',
      ),
    ).toBeDefined();
  });

  it('ne propose pas de lien vers une loi absente', async () => {
    const { racine } = await afficher(scrutinDetail({ loi: null }));

    expect(
      Array.from(racine.querySelectorAll('a')).some((a) =>
        a.getAttribute('href')?.startsWith('/lois/'),
      ),
    ).toBe(false);
  });

  it('propose la liste nominative derrière un bouton', async () => {
    const { racine } = await afficher();

    expect(
      Array.from(racine.querySelectorAll('button')).some((b) =>
        b.textContent!.includes('Voir comment chaque député a voté'),
      ),
    ).toBe(true);
  });

  it("a un fil d'Ariane et un titre de page", async () => {
    const { racine } = await afficher();

    expect(racine.querySelector('fd-breadcrumb')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toContain('Qui a voté quoi ?');
  });

  it('répond 404 pour un scrutin inconnu', async () => {
    const { http, init } = configurerPage();
    const fixture = monter(ScrutinPage, { numero: '999' });

    http
      .expectOne('/api/scrutins/999')
      .flush({ erreur: 'inconnu' }, { status: 404, statusText: 'Not Found' });
    const racine = await stabiliser(fixture);

    expect(init.status).toBe(404);
    expect(racine.querySelector('fd-empty-state')).not.toBeNull();
  });
});
