import { TestBed } from '@angular/core/testing';
import type { DeputeDetail } from '@contrat';
import { deputeDetail, NI, RN } from '../../testing/builders';
import { sansEspaces } from '../../testing/page';
import { AppDeputeProfil } from './depute-profil';

function monter(surcharge: Partial<DeputeDetail> = {}) {
  const fixture = TestBed.createComponent(AppDeputeProfil);
  fixture.componentRef.setInput('depute', deputeDetail(surcharge));
  fixture.detectChanges();
  const racine = fixture.nativeElement as HTMLElement;
  /** Les lignes « libellé : valeur » du bloc. */
  const lignes = () =>
    Object.fromEntries(
      Array.from(racine.querySelectorAll('.app-depute-profil__ligne')).map((l) => [
        sansEspaces(l.querySelector('dt')!.textContent),
        sansEspaces(l.querySelector('dd')!.textContent),
      ]),
    );
  return { racine, lignes };
}

describe('AppDeputeProfil', () => {
  it("écrit la naissance avec l'âge et le lieu, sans « né(e) »", () => {
    const { lignes, racine } = monter();

    expect(lignes()['Naissance']).toBe('13 avril 1973 (52 ans), à Beauvais');
    expect(racine.textContent).not.toMatch(/\bnée?\b|né\(e\)/i);
  });

  it('contracte « à Le Havre » en « au Havre » et garde le pays étranger', () => {
    expect(
      monter({ naissance: { date: '1980-02-01', age: 46, lieu: 'Le Havre' } }).lignes()[
        'Naissance'
      ],
    ).toBe('1 février 1980 (46 ans), au Havre');
    expect(
      monter({ naissance: { date: '1960-01-02', age: 66, lieu: 'Alger (Algérie)' } }).lignes()[
        'Naissance'
      ],
    ).toBe('2 janvier 1960 (66 ans), à Alger (Algérie)');
  });

  it("n'écrit pas le lieu quand il est inconnu, ni la ligne sans naissance", () => {
    expect(
      monter({ naissance: { date: '1969-02-25', age: 57, lieu: null } }).lignes()['Naissance'],
    ).toBe('25 février 1969 (57 ans)');
    expect(monter({ naissance: null }).lignes()['Naissance']).toBeUndefined();
  });

  it("donne l'âge au décès d'un député décédé, sur la ligne « Décès »", () => {
    const { lignes } = monter({
      naissance: { date: '1966-03-04', age: 59, lieu: 'Lyon' },
      deces: '2025-07-07',
    });

    expect(lignes()['Naissance']).toBe('4 mars 1966, à Lyon');
    expect(lignes()['Décès']).toBe('7 juillet 2025 (à 59 ans)');
  });

  it('montre la profession, la circonscription et le parti de rattachement', () => {
    const { lignes } = monter();

    expect(lignes()['Profession']).toBe('Conseillère en communication');
    expect(lignes()['Circonscription']).toBe('Rhône (7)');
    expect(lignes()['Parti de rattachement']).toBe('Rassemblement national');
  });

  it("omet les lignes dont l'information manque", () => {
    const { lignes } = monter({
      naissance: null,
      profession: null,
      circonscription: null,
      mandat: null,
      groupes: [],
      fonctions: [],
      partiRattachement: null,
    });

    expect(lignes()).toEqual({});
  });

  it('dit « En cours depuis » pour un mandat en cours et donne les législatures', () => {
    const { lignes } = monter();

    expect(lignes()['Mandat de député']).toBe('En cours depuis le 30 juin 2024');
    expect(lignes()['Législatures']).toBe('16ᵉ et 17ᵉ législatures');
  });

  it('écrit « Du … au … » pour un mandat terminé et accorde « législature » au singulier', () => {
    const { lignes } = monter({
      mandat: { depuis: '2024-06-30', fin: '2026-01-10', legislatures: [17] },
    });

    expect(lignes()['Mandat de député']).toBe('Du 30 juin 2024 au 10 janvier 2026');
    expect(lignes()['Législatures']).toBe('17ᵉ législature');
  });

  it('liste trois législatures avec une virgule et « et »', () => {
    const { lignes } = monter({
      mandat: { depuis: '2024-06-30', fin: null, legislatures: [15, 16, 17] },
    });

    expect(lignes()['Législatures']).toBe('15ᵉ, 16ᵉ et 17ᵉ législatures');
  });

  it("détaille l'historique des groupes, du plus ancien au plus récent", () => {
    const { racine } = monter({
      groupes: [
        { groupe: NI, debut: '2024-07-01', fin: '2024-07-18' },
        { groupe: RN, debut: '2024-07-19', fin: null },
      ],
    });
    const items = Array.from(racine.querySelectorAll('.app-depute-profil__ligne:has(dt) li')).map(
      (li) => sansEspaces(li.textContent),
    );

    expect(items.slice(0, 2)).toEqual([
      'Non inscrits (NI), du 1 juillet 2024 au 18 juillet 2024',
      'Rassemblement National (RN), depuis le 19 juillet 2024',
    ]);
  });

  it("n'écrit pas deux fois l'Assemblée pour une fonction du bureau, mais nomme la commission", () => {
    const { racine, lignes } = monter();
    const fonctions = Array.from(racine.querySelectorAll('.app-depute-profil__ligne')).find((l) =>
      l.querySelector('dt')!.textContent!.startsWith('Fonction'),
    )!;
    const items = Array.from(fonctions.querySelectorAll('li')).map((li) =>
      sansEspaces(li.textContent),
    );

    expect(items).toEqual([
      "Vice-présidente de l'Assemblée nationale, depuis le 1 octobre 2025",
      'Membre, Commission des affaires étrangères, depuis le 20 juillet 2024',
    ]);
    expect(Object.keys(lignes())).toContain('Fonctions');
  });

  it('accorde « Fonction » au singulier', () => {
    const { lignes } = monter({
      fonctions: [{ organe: 'Commission des finances', qualite: 'Membre', depuis: '2025-02-01' }],
    });

    expect(lignes()['Fonction']).toBe('Membre, Commission des finances, depuis le 1 février 2025');
  });

  it("n'écrit jamais « présence » ni de valeur indéfinie", () => {
    const { racine } = monter();

    expect(racine.textContent).not.toMatch(/présence|undefined|null|NaN/i);
  });
});
