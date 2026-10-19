import { TestBed } from '@angular/core/testing';
import type { LiensDepute } from '@contrat';
import { deputeDetail } from '../../testing/builders';
import { AppDeputeLiens } from './depute-liens';

const SANS_LIEN: LiensDepute = {
  assemblee: 'https://www.assemblee-nationale.fr/dyn/deputes/PA1001',
  hatvp: null,
  wikipedia: null,
  siteWeb: null,
  x: null,
  facebook: null,
};

function monter(liens: LiensDepute) {
  const fixture = TestBed.createComponent(AppDeputeLiens);
  fixture.componentRef.setInput('liens', liens);
  fixture.detectChanges();
  const racine = fixture.nativeElement as HTMLElement;
  const liensAffiches = Array.from(racine.querySelectorAll('a'));
  return { racine, liensAffiches, libelles: liensAffiches.map((a) => a.textContent!.trim()) };
}

describe('AppDeputeLiens', () => {
  it('affiche les liens connus, avec leurs libellés', () => {
    const { libelles, liensAffiches } = monter(deputeDetail().liens);

    expect(libelles).toEqual([
      "Fiche à l'Assemblée (nouvel onglet)",
      'Déclarations HATVP (nouvel onglet)',
      'Page Wikipédia (nouvel onglet)',
      'Site web (nouvel onglet)',
      'Compte X (nouvel onglet)',
      'Page Facebook (nouvel onglet)',
    ]);
    expect(liensAffiches.map((a) => a.getAttribute('href'))).toEqual([
      'https://www.assemblee-nationale.fr/dyn/deputes/PA1001',
      'https://www.hatvp.fr/pages_nominatives/durand-alice',
      'https://fr.wikipedia.org/wiki/Alice_Durand',
      'https://www.alice-durand.fr/',
      'https://x.com/aliceDurand',
      'https://www.facebook.com/alice.durand',
    ]);
  });

  it("n'affiche pas un lien absent : la fiche de l'Assemblée reste seule, sans adresse devinée", () => {
    const { libelles, racine } = monter(SANS_LIEN);

    expect(libelles).toEqual(["Fiche à l'Assemblée (nouvel onglet)"]);
    expect(racine.textContent).not.toMatch(/HATVP|Wikipédia|Facebook|Compte X|Site web/);
    expect(racine.innerHTML).not.toMatch(/null|undefined/);
  });

  it('omet chaque lien absent indépendamment des autres', () => {
    const { libelles } = monter({ ...SANS_LIEN, wikipedia: 'https://fr.wikipedia.org/wiki/X' });

    expect(libelles).toEqual([
      "Fiche à l'Assemblée (nouvel onglet)",
      'Page Wikipédia (nouvel onglet)',
    ]);
  });

  it('ouvre chaque lien dans un nouvel onglet, avec rel="noopener noreferrer"', () => {
    const { liensAffiches } = monter(deputeDetail().liens);

    expect(liensAffiches).toHaveLength(6);
    for (const lien of liensAffiches) {
      expect(lien.getAttribute('target')).toBe('_blank');
      const rel = lien.getAttribute('rel')!.split(/\s+/);
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    }
  });

  it('annonce « (nouvel onglet) » aux lecteurs d’écran, sans l’afficher à l’écran', () => {
    const { racine } = monter(deputeDetail().liens);
    const mentions = Array.from(racine.querySelectorAll('.app-depute-liens__onglet'));

    expect(mentions).toHaveLength(6);
    expect(mentions.every((m) => m.textContent!.trim() === '(nouvel onglet)')).toBe(true);
  });

  it('est une liste nommée « Liens externes »', () => {
    const { racine } = monter(deputeDetail().liens);

    expect(racine.querySelector('ul')!.getAttribute('aria-label')).toBe('Liens externes');
    expect(racine.querySelectorAll('li')).toHaveLength(6);
  });
});
