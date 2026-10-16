import { deputeListe } from '../../testing/builders';
import { configurerPage, monter, sansEspaces, stabiliser } from '../../testing/page';
import { RecherchePage } from './recherche';

async function chercher(q: string | undefined) {
  const ctx = configurerPage();
  const fixture = monter(RecherchePage, q === undefined ? {} : { q });
  ctx.http.expectOne('/api/deputes').flush(deputeListe());
  const racine = await stabiliser(fixture);
  const section = (titre: string) =>
    Array.from(racine.querySelectorAll('section')).find(
      (s) => s.querySelector('h2')?.textContent?.trim() === titre,
    ) as HTMLElement | undefined;
  return { ...ctx, fixture, racine, section };
}

describe('RecherchePage', () => {
  it('invite à saisir une requête quand elle est vide', async () => {
    const { racine } = await chercher('');

    expect(racine.querySelectorAll('h1')).toHaveLength(1);
    expect(sansEspaces(racine.textContent)).toContain(
      "Saisissez un nom de député ou un mot du titre d'une loi.",
    );
  });

  it('redirige vers le profil quand un seul député répond (302 côté serveur, replaceUrl côté client)', async () => {
    const { init, navigation } = await chercher('martin');

    expect(init.status).toBe(302);
    expect((init.headers as Headers).get('Location')).toBe('/deputes/bruno-martin');
    expect(navigation).toHaveBeenCalledWith('/deputes/bruno-martin', { replaceUrl: true });
  });

  it('trouve ce député même sans accent ni majuscule', async () => {
    const { init } = await chercher('EMILIE');

    expect((init.headers as Headers).get('Location')).toBe('/deputes/emilie-laurent');
  });

  it('montre deux sections « Députés » et « Lois » quand plusieurs députés répondent', async () => {
    const { init, section, navigation } = await chercher('ou'); // Roux, Fournier

    expect(init.status).toBe(200);
    expect(navigation).not.toHaveBeenCalled();
    expect(section('Députés')!.querySelectorAll('a')).toHaveLength(2);
    expect(section('Lois')).toBeDefined();
  });

  it('trouve des lois par un mot de leur titre, sans rediriger', async () => {
    const { init, section } = await chercher('abeilles');

    expect(init.status).toBe(200);
    const lien = section('Lois')!.querySelector('a')!;
    expect(lien.getAttribute('href')).toBe('/lois/DLR5L17N2000');
    expect(lien.textContent).toContain('Proposition de loi visant à protéger les abeilles');
  });

  it('ne redirige pas quand un député et une loi répondent à la fois', async () => {
    const liste = deputeListe();
    liste.loisRecentes.push({
      dossier: 'DLR5L17N3',
      titreCourt: 'Loi Martin sur les marais',
      date: '2025-01-01T00:00:00Z',
    });
    const ctx = configurerPage();
    const fixture = monter(RecherchePage, { q: 'martin' });
    ctx.http.expectOne('/api/deputes').flush(liste);
    await stabiliser(fixture);

    expect(ctx.init.status).toBe(200);
    expect(ctx.navigation).not.toHaveBeenCalled();
  });

  it('dit quand rien ne correspond', async () => {
    const { racine, init } = await chercher('zzzzzz');

    expect(init.status).toBe(200);
    expect(sansEspaces(racine.textContent)).toContain('Aucun résultat pour « zzzzzz »');
  });

  it('répond 503 avec une alerte quand la source est indisponible', async () => {
    const { http, init } = configurerPage();
    const fixture = monter(RecherchePage, { q: 'martin' });

    http
      .expectOne('/api/deputes')
      .flush({ erreur: 'panne' }, { status: 503, statusText: 'Service Unavailable' });
    const racine = await stabiliser(fixture);

    expect(init.status).toBe(503);
    expect(racine.querySelector('fd-alert')).not.toBeNull();
  });
});
