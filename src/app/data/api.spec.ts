import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Accueil, DeputeDetail, DeputeListe, LoiDetail, ScrutinDetail } from '@contrat';
import { AccueilApi } from './accueil-api';
import { DeputeApi } from './depute-api';
import { LoiApi } from './loi-api';
import { ScrutinApi } from './scrutin-api';

function preparer() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(HttpTestingController);
}

describe('services de données (httpResource)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('AccueilApi charge la page demandée et suit le signal', async () => {
    const http = preparer();
    const page = signal(1);
    const ressource = TestBed.runInInjectionContext(() => TestBed.inject(AccueilApi).page(page));

    TestBed.tick();
    const premiere = http.expectOne('/api/accueil?page=1');
    expect(premiere.request.method).toBe('GET');
    premiere.flush({
      lois: [],
      page: 1,
      pageSuivante: true,
      miseAJour: '2025-01-01T00:00:00Z',
    } satisfies Accueil);
    await vi.waitFor(() => expect(ressource.value()?.pageSuivante).toBe(true));

    page.set(2);
    TestBed.tick();
    http
      .expectOne('/api/accueil?page=2')
      .flush({ lois: [], page: 2, pageSuivante: false, miseAJour: '' } satisfies Accueil);
    await vi.waitFor(() => expect(ressource.value()?.page).toBe(2));
  });

  it('LoiApi interroge /api/lois/:dossier', () => {
    const http = preparer();
    const dossier = signal('DLR5L17N54372');
    const ressource = TestBed.runInInjectionContext(() => TestBed.inject(LoiApi).detail(dossier));

    TestBed.tick();
    http.expectOne('/api/lois/DLR5L17N54372').flush({ dossier: 'DLR5L17N54372' } as LoiDetail);
    expect(ressource.isLoading).toBeDefined();
  });

  it("LoiApi encode le dossier dans l'URL", () => {
    const http = preparer();
    TestBed.runInInjectionContext(() => TestBed.inject(LoiApi).detail(signal('a b/c')));

    TestBed.tick();
    http.expectOne('/api/lois/a%20b%2Fc').flush({});
  });

  it('ScrutinApi interroge /api/scrutins/:numero', () => {
    const http = preparer();
    TestBed.runInInjectionContext(() => TestBed.inject(ScrutinApi).detail(signal('8317')));

    TestBed.tick();
    http.expectOne('/api/scrutins/8317').flush({ numero: 8317 } as ScrutinDetail);
  });

  it('DeputeApi interroge la liste puis un profil', () => {
    const http = preparer();
    const api = TestBed.inject(DeputeApi);
    TestBed.runInInjectionContext(() => api.liste());
    TestBed.runInInjectionContext(() => api.detail(signal('alice-durand')));

    TestBed.tick();
    http
      .expectOne('/api/deputes')
      .flush({ deputes: [], groupes: [], loisRecentes: [] } satisfies DeputeListe);
    http.expectOne('/api/deputes/alice-durand').flush({ slug: 'alice-durand' } as DeputeDetail);
  });

  it("expose l'erreur HTTP sans lever d'exception", async () => {
    const http = preparer();
    const ressource = TestBed.runInInjectionContext(() =>
      TestBed.inject(LoiApi).detail(signal('DLR5L17N0')),
    );

    TestBed.tick();
    http
      .expectOne('/api/lois/DLR5L17N0')
      .flush({ erreur: 'inconnu' }, { status: 404, statusText: 'Not Found' });

    await vi.waitFor(() => expect(ressource.error()).toBeTruthy());
    expect(ressource.hasValue()).toBe(false);
  });

  it('ne lance aucune requête tant que le paramètre est indéfini', () => {
    const http = preparer();
    TestBed.runInInjectionContext(() =>
      TestBed.inject(LoiApi).detail(signal<string | undefined>(undefined)),
    );

    TestBed.tick();
    http.expectNone(() => true);
  });
});
