// Aides communes aux specs de pages : HTTP simulé, statut de réponse serveur, blocs @defer manuels.
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RESPONSE_INIT, Type } from '@angular/core';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

export function configurerPage(avecInit = true) {
  const init: ResponseInit = { status: 200, headers: new Headers() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      ...(avecInit ? [{ provide: RESPONSE_INIT, useValue: init }] : []),
    ],
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });
  const navigation = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  return { http: TestBed.inject(HttpTestingController), init, navigation };
}

export function monter<T>(type: Type<T>, entrees: Record<string, unknown> = {}): ComponentFixture<T> {
  const fixture = TestBed.createComponent(type);
  for (const [cle, valeur] of Object.entries(entrees)) fixture.componentRef.setInput(cle, valeur);
  fixture.detectChanges();
  return fixture;
}

/** Laisse les ressources HTTP se résoudre puis rend le résultat. */
export async function stabiliser(fixture: ComponentFixture<unknown>): Promise<HTMLElement> {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    TestBed.tick();
    fixture.detectChanges();
  }
  return fixture.nativeElement as HTMLElement;
}

export const sansEspaces = (texte: string | null | undefined) => (texte ?? '').replace(/\s+/g, ' ').trim();
