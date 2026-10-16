import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { configurerPage, monter, sansEspaces } from '../../testing/page';
import { AProposPage } from './a-propos';

function afficher() {
  configurerPage();
  const fixture = monter(AProposPage);
  return sansEspaces((fixture.nativeElement as HTMLElement).textContent);
}

describe('AProposPage', () => {
  it('a un seul h1 et un titre de page', () => {
    configurerPage();
    const fixture = monter(AProposPage);

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('h1')).toHaveLength(1);
    expect(TestBed.inject(Title).getTitle()).toContain('À propos');
  });

  it('cite la source des données et sa licence', () => {
    const texte = afficher();

    expect(texte).toContain('data.gouv.fr');
    expect(texte).toContain('NosParlementaires');
    expect(texte).toContain('Datan');
    expect(texte).toContain('Licence Ouverte 2.0');
    expect(texte).toMatch(/quotidien/i);
  });

  it('signale que la position est rattachée au groupe actuel du député', () => {
    expect(afficher()).toMatch(/groupe actuel/i);
  });

  it('explique les notions : vote final, amendement, motion de censure', () => {
    const texte = afficher();

    expect(texte).toMatch(/vote final/i);
    expect(texte).toMatch(/amendement/i);
    expect(texte).toMatch(/motion de censure/i);
  });

  it('explique comment « adopté » et « rejeté » sont déterminés, et que ce n\'est pas une loi promulguée', () => {
    const texte = afficher();

    expect(texte).toMatch(/adopt/i);
    expect(texte).toMatch(/promulgu/i);
  });

  it('explique pourquoi on parle de participation et non de présence', () => {
    const texte = afficher();

    expect(texte).toMatch(/participation/i);
    expect(texte).toMatch(/présence/i);
  });

  it('mentionne la mesure d\'audience Umami sans cookie', () => {
    const texte = afficher();

    expect(texte).toContain('Umami');
    expect(texte).toMatch(/sans cookie/i);
  });
});
