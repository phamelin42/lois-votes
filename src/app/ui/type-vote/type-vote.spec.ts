import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import type { ScrutinResume } from '@contrat';
import { AppTypeVote } from './type-vote';

function monter(scrutin: Pick<ScrutinResume, 'solennel' | 'type'>, phrase = false) {
  const fixture = TestBed.createComponent(AppTypeVote);
  fixture.componentRef.setInput('scrutin', scrutin);
  fixture.componentRef.setInput('phrase', phrase);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AppTypeVote', () => {
  it('écrit « Vote solennel » dans un badge pour un scrutin public solennel', () => {
    const racine = monter({ solennel: true, type: 'final' });

    expect(racine.querySelector('fd-badge')!.textContent!.trim()).toBe('Vote solennel');
  });

  it('écrit « Vote ordinaire » dans un badge pour un scrutin public ordinaire', () => {
    const racine = monter({ solennel: false, type: 'amendement' });

    expect(racine.querySelector('fd-badge')!.textContent!.trim()).toBe('Vote ordinaire');
  });

  it("n'ajoute la phrase que sur demande", () => {
    expect(monter({ solennel: true, type: 'final' }).querySelector('p')).toBeNull();
  });

  it('explique le vote solennel : tous les députés sont convoqués', () => {
    const racine = monter({ solennel: true, type: 'final' }, true);

    expect(racine.querySelector('p')!.textContent!.trim()).toBe(
      'Vote solennel : tous les députés sont convoqués.',
    );
  });

  it("explique le vote ordinaire : en séance, seuls les députés présents dans l'hémicycle votent", () => {
    const racine = monter({ solennel: false, type: 'final' }, true);

    expect(racine.querySelector('p')!.textContent!.trim()).toBe(
      "Vote ordinaire : en séance, seuls les députés présents dans l'hémicycle votent.",
    );
  });

  it("n'affiche rien pour une motion de censure : ce n'est ni un vote solennel ni un vote ordinaire", () => {
    const racine = monter({ solennel: false, type: 'motion' }, true);

    expect(racine.querySelector('fd-badge')).toBeNull();
    expect(racine.querySelector('p')).toBeNull();
  });

  it("ne porte pas l'information par la couleur seule : le texte est écrit dans les deux cas", () => {
    for (const solennel of [true, false]) {
      const racine = monter({ solennel, type: 'final' });
      expect(racine.querySelector('fd-badge')!.textContent!.trim()).toMatch(
        /^Vote (solennel|ordinaire)$/,
      );
    }
  });

  it("n'a pas de style en dur : son hôte ne dessine rien", () => {
    expect(readFileSync('src/app/ui/type-vote/type-vote.scss', 'utf8')).toMatch(
      /display:\s*contents/,
    );
  });
});
