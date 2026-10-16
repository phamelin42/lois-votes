import { HttpErrorResponse } from '@angular/common/http';
import { RESPONSE_INIT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { statutDePage } from './statut-de-page';

function preparer(init: ResponseInit | null = { status: 200 }) {
  TestBed.configureTestingModule({ providers: [{ provide: RESPONSE_INIT, useValue: init }] });
  return init;
}

const ressource = (erreur?: unknown) => ({ error: signal(erreur) });

describe('statutDePage', () => {
  it('répond 404 quand la ressource renvoie 404', () => {
    const init = preparer()!;
    const res = ressource();
    TestBed.runInInjectionContext(() => statutDePage(res));

    res.error.set(new HttpErrorResponse({ status: 404 }));
    TestBed.tick();

    expect(init.status).toBe(404);
  });

  it('répond 503 quand la source est indisponible', () => {
    const init = preparer()!;
    const res = ressource(new HttpErrorResponse({ status: 503 }));
    TestBed.runInInjectionContext(() => statutDePage(res));

    TestBed.tick();

    expect(init.status).toBe(503);
  });

  it('répond 503 pour toute autre erreur serveur ou réseau', () => {
    const init = preparer()!;
    const res = ressource(new HttpErrorResponse({ status: 500 }));
    TestBed.runInInjectionContext(() => statutDePage(res));

    TestBed.tick();

    expect(init.status).toBe(503);
  });

  it('laisse 200 quand tout va bien', () => {
    const init = preparer()!;
    TestBed.runInInjectionContext(() => statutDePage(ressource()));

    TestBed.tick();

    expect(init.status).toBe(200);
  });

  it('ne fait rien dans le navigateur (pas de RESPONSE_INIT)', () => {
    preparer(null);
    const res = ressource(new HttpErrorResponse({ status: 404 }));

    expect(() => {
      TestBed.runInInjectionContext(() => statutDePage(res));
      TestBed.tick();
    }).not.toThrow();
  });
});
