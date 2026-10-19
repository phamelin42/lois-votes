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

  it("cite l'Assemblée nationale comme seule origine des données, et sa licence", () => {
    const texte = afficher();

    expect(texte).toContain('data.assemblee-nationale.fr');
    expect(texte).toContain('Licence Ouverte 2.0');
    expect(texte).not.toMatch(/data\.gouv|NosParlementaires|Datan/i);
  });

  it('annonce la mise à jour nocturne', () => {
    expect(afficher()).toMatch(/chaque nuit/i);
  });

  it("définit la participation, l'abstention et le vote avec son groupe", () => {
    const texte = afficher();

    expect(texte).toContain('Participation aux scrutins');
    expect(texte).toContain("Taux d'abstention");
    expect(texte).toContain('Vote avec son groupe');
    expect(texte).toMatch(/calculés par le site, d'après les scrutins publics/);
  });

  it('signale la fiche au groupe actuel et les scrutins au groupe du jour du vote', () => {
    const texte = afficher();

    expect(texte).toMatch(/groupe actuel/i);
    expect(texte).toMatch(/le jour du vote/i);
  });

  it('signale que les mises au point ne sont pas appliquées', () => {
    expect(afficher()).toMatch(/n'applique pas les mises au point/i);
  });

  it('explique les notions : vote final, amendement, motion de censure', () => {
    const texte = afficher();

    expect(texte).toMatch(/vote final/i);
    expect(texte).toMatch(/amendement/i);
    expect(texte).toMatch(/motion de censure/i);
  });

  it("explique comment « adopté » et « rejeté » sont déterminés, et que ce n'est pas une loi promulguée", () => {
    const texte = afficher();

    expect(texte).toMatch(/adopt/i);
    expect(texte).toMatch(/promulgu/i);
  });

  it('explique pourquoi on parle de participation et non de présence', () => {
    const texte = afficher();

    expect(texte).toMatch(/participation/i);
    expect(texte).toMatch(/présence/i);
  });

  it("définit « ont voté » et « n'ont pas voté » et explique ces mots plutôt que « présents » et « absents »", () => {
    const texte = afficher();

    expect(texte).toContain('Ont voté');
    expect(texte).toContain("N'ont pas voté");
    expect(texte).toMatch(/ne veut donc pas dire/);
    expect(texte).toMatch(/voter par délégation/);
    expect(texte).toMatch(/Groupes sans aucun votant/);
  });

  it("mentionne la mesure d'audience Umami sans cookie", () => {
    const texte = afficher();

    expect(texte).toContain('Umami');
    expect(texte).toMatch(/sans cookie/i);
  });
});
