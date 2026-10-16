import { HttpErrorResponse, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APPELER_BFF, serverApiInterceptor } from './server-api.interceptor';

function preparer(appeler: (url: string) => Promise<{ status: number; headers: Record<string, string>; body: unknown }>) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([serverApiInterceptor])),
      provideHttpClientTesting(),
      { provide: APPELER_BFF, useValue: appeler },
    ],
  });
  return { http: TestBed.inject(HttpClient), controleur: TestBed.inject(HttpTestingController) };
}

describe('intercepteur serveur de /api', () => {
  it('exécute /api/* en mémoire, sans requête réseau', async () => {
    const appeler = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'cache-control': 'public, s-maxage=60' },
      body: { lois: [] },
    });
    const { http, controleur } = preparer(appeler);

    const reponse = await firstValueFrom(http.get('/api/accueil?page=1', { observe: 'response' }));

    expect(appeler).toHaveBeenCalledWith('/api/accueil?page=1');
    expect(reponse).toBeInstanceOf(HttpResponse);
    expect(reponse.status).toBe(200);
    expect(reponse.body).toEqual({ lois: [] });
    expect(reponse.headers.get('cache-control')).toBe('public, s-maxage=60');
    controleur.expectNone(() => true);
  });

  it('ne garde que le chemin et la requête d\'une URL absolue de la même origine', async () => {
    const appeler = vi.fn().mockResolvedValue({ status: 200, headers: {}, body: {} });
    const { http } = preparer(appeler);

    const origine = TestBed.inject(DOCUMENT).location.origin;
    await firstValueFrom(http.get(`${origine}/api/lois/DLR5L17N1?x=1`));

    expect(appeler).toHaveBeenCalledWith('/api/lois/DLR5L17N1?x=1');
  });

  it('transforme un statut d\'erreur en HttpErrorResponse', async () => {
    const appeler = vi.fn().mockResolvedValue({ status: 404, headers: {}, body: { erreur: 'inconnu' } });
    const { http } = preparer(appeler);

    const erreur = await firstValueFrom(http.get('/api/lois/DLR5L17N0')).catch((e) => e);

    expect(erreur).toBeInstanceOf(HttpErrorResponse);
    expect(erreur.status).toBe(404);
    expect(erreur.error).toEqual({ erreur: 'inconnu' });
  });

  it('transmet le 503 et son Retry-After', async () => {
    const appeler = vi.fn().mockResolvedValue({ status: 503, headers: { 'retry-after': '60' }, body: { erreur: 'panne' } });
    const { http } = preparer(appeler);

    const erreur = await firstValueFrom(http.get('/api/deputes')).catch((e) => e);

    expect(erreur.status).toBe(503);
    expect(erreur.headers.get('retry-after')).toBe('60');
  });

  it('laisse passer ce qui n\'est pas /api', async () => {
    const appeler = vi.fn();
    const { http, controleur } = preparer(appeler);

    const resultat = firstValueFrom(http.get('/assets/autre.json'));
    controleur.expectOne('/assets/autre.json').flush({ ok: true });

    expect(await resultat).toEqual({ ok: true });
    expect(appeler).not.toHaveBeenCalled();
  });

  it('ne court-circuite pas un autre hôte dont le chemin commence par /api', async () => {
    const appeler = vi.fn();
    const { http, controleur } = preparer(appeler);

    const resultat = firstValueFrom(http.get('https://exemple.org/api/x'));
    controleur.expectOne('https://exemple.org/api/x').flush({});

    await resultat;
    expect(appeler).not.toHaveBeenCalled();
  });
});
