// @vitest-environment node
import { entier, liste, lireActeur, lireOrgane, lirePosition, lireScrutin } from './lire.mjs';

// Les bruts ci-dessous sont des extraits réels de l'archive (scrutin 8317, acteur PA720468, organe PO845401),
// réduits mais gardant leurs particularités : objets à la place de listes d'un élément, `null`, chaînes.
const votant = (pa: string, plus: Record<string, string> = {}) => ({
  acteurRef: pa,
  mandatRef: 'PM1',
  parDelegation: 'false',
  numPlace: '001',
  ...plus,
});

const brutScrutin = () => ({
  scrutin: {
    uid: 'VTANR5L17V8317',
    numero: '8317',
    dateScrutin: '2026-07-16',
    typeVote: { codeTypeVote: 'SPO', libelleTypeVote: 'scrutin public ordinaire' },
    sort: { code: 'rejeté', libelle: "L'Assemblée nationale n'a pas adopté" },
    titre:
      "l'amendement n° 770 de Mme Parmentier à l'article premier du projet de loi relatif à la protection des enfants (première lecture).",
    objet: { dossierLegislatif: { libelle: 'Projet de loi', dossierRef: 'DLR5L17N54372' } },
    syntheseVote: {
      nombreVotants: '124',
      decompte: {
        nonVotants: '2',
        pour: '37',
        contre: '87',
        abstentions: '0',
        nonVotantsVolontaires: '0',
      },
    },
    ventilationVotes: {
      organe: {
        groupes: {
          groupe: [
            {
              organeRef: 'PO845401',
              nombreMembresGroupe: '122',
              vote: {
                positionMajoritaire: 'pour',
                decompteVoix: {
                  nonVotants: '1',
                  pour: '2',
                  contre: '0',
                  abstentions: '0',
                  nonVotantsVolontaires: '0',
                },
                decompteNominatif: {
                  // un seul non-votant : un objet, pas un tableau
                  nonVotants: { votant: votant('PA720468', { causePositionVote: 'PSE' }) },
                  pours: { votant: [votant('PA794562'), votant('PA793158')] },
                  contres: null,
                  abstentions: null,
                },
              },
            },
            {
              organeRef: 'PO0',
              nombreMembresGroupe: '10',
              vote: {
                positionMajoritaire: 'Contre',
                decompteVoix: {
                  nonVotants: '0',
                  pour: '0',
                  contre: '1',
                  abstentions: '1',
                  nonVotantsVolontaires: '1',
                },
                decompteNominatif: {
                  nonVotants: null,
                  pours: null,
                  contres: { votant: votant('PA1') },
                  abstentions: { votant: votant('PA2') },
                },
              },
            },
          ],
        },
      },
    },
    miseAuPoint: {
      nonVotants: [null, null],
      pours: null,
      abstentions: [null, null],
      nonVotantsVolontaires: [null, null],
      contres: null,
      dysfonctionnement: { nonVotants: null, pour: null },
    },
  },
});

describe('liste et entier', () => {
  it('ramène null, un objet seul et un tableau à un tableau sans null', () => {
    expect(liste(null)).toEqual([]);
    expect(liste(undefined)).toEqual([]);
    expect(liste({ a: 1 })).toEqual([{ a: 1 }]);
    expect(liste([{ a: 1 }, { a: 2 }])).toEqual([{ a: 1 }, { a: 2 }]);
    expect(liste([null, { a: 1 }])).toEqual([{ a: 1 }]);
  });

  it('lit les entiers écrits en chaîne, 0 quand ils manquent, et refuse le reste', () => {
    expect(entier('37')).toBe(37);
    expect(entier(null)).toBe(0);
    expect(entier('')).toBe(0);
    expect(() => entier('abc')).toThrow(/entier attendu/);
  });
});

describe('lirePosition', () => {
  it('ignore la casse et le pluriel', () => {
    expect(lirePosition('pour')).toBe('pour');
    expect(lirePosition('Contre')).toBe('contre');
    expect(lirePosition('ABSTENTION')).toBe('abstention');
    expect(lirePosition('abstentions')).toBe('abstention');
    expect(lirePosition('nonVotant')).toBe('nonvotant');
  });

  it('renvoie null pour le reste', () => {
    expect(lirePosition(null)).toBeNull();
    expect(lirePosition('')).toBeNull();
    expect(lirePosition('peut-être')).toBeNull();
  });
});

describe('lireScrutin', () => {
  it('lit le numéro, la date, le titre, le type de vote, le sort et le dossier', () => {
    const scrutin = lireScrutin(brutScrutin());
    expect(scrutin).toMatchObject({
      numero: 8317,
      date: '2026-07-16',
      codeTypeVote: 'SPO',
      sortCode: 'rejeté',
      dossier: 'DLR5L17N54372',
      compte: { pour: 37, contre: 87, abstention: 0, nonvotant: 2 },
    });
    expect(scrutin.titre).toContain("l'amendement n° 770");
  });

  it('lit les listes nominatives, y compris celles réduites à un objet ou à null', () => {
    const [rn, po0] = lireScrutin(brutScrutin()).groupes;
    expect(rn.votants).toEqual({
      pour: ['PA794562', 'PA793158'],
      contre: [],
      abstention: [],
      nonvotant: ['PA720468'],
    });
    expect(rn.compte).toEqual({ pour: 2, contre: 0, abstention: 0, nonvotant: 1 });
    expect(po0.votants.contre).toEqual(['PA1']);
    expect(po0.votants.abstention).toEqual(['PA2']);
  });

  it("garde l'organe tel quel (« PO0 ») et lit la position officielle sans tenir compte de la casse", () => {
    const [rn, po0] = lireScrutin(brutScrutin()).groupes;
    expect(rn).toMatchObject({
      organeRef: 'PO845401',
      nombreMembres: 122,
      positionOfficielle: 'pour',
    });
    expect(po0).toMatchObject({ organeRef: 'PO0', positionOfficielle: 'contre' });
  });

  it('accepte un groupe unique (objet au lieu de tableau)', () => {
    const brut = brutScrutin();
    brut.scrutin.ventilationVotes.organe.groupes.groupe = brut.scrutin.ventilationVotes.organe
      .groupes.groupe[0] as never;
    expect(lireScrutin(brut).groupes).toHaveLength(1);
  });

  it("n'a pas de dossier quand l'objet n'en désigne aucun", () => {
    const brut = brutScrutin();
    (brut.scrutin.objet as { dossierLegislatif: unknown }).dossierLegislatif = null;
    expect(lireScrutin(brut).dossier).toBeNull();
    delete (brut.scrutin as { objet?: unknown }).objet;
    expect(lireScrutin(brut).dossier).toBeNull();
  });

  it('détecte une mise au point seulement quand un député y figure', () => {
    expect(lireScrutin(brutScrutin()).miseAuPoint).toBe(false);
    const brut = brutScrutin();
    brut.scrutin.miseAuPoint.pours = { votant: votant('PA9') } as never;
    expect(lireScrutin(brut).miseAuPoint).toBe(true);
    const mixte = brutScrutin();
    mixte.scrutin.miseAuPoint.abstentions = [null, { votant: votant('PA9') }] as never;
    expect(lireScrutin(mixte).miseAuPoint).toBe(true);
  });

  it('compte aussi un dysfonctionnement de boîtier parmi les mises au point', () => {
    const brut = brutScrutin();
    (brut.scrutin.miseAuPoint.dysfonctionnement as Record<string, unknown>)['contre'] = {
      votant: votant('PA9'),
    };
    expect(lireScrutin(brut).miseAuPoint).toBe(true);
  });

  it("n'a pas de groupe quand la ventilation manque", () => {
    const brut = brutScrutin();
    delete (brut.scrutin as { ventilationVotes?: unknown }).ventilationVotes;
    expect(lireScrutin(brut).groupes).toEqual([]);
  });

  it('refuse un scrutin illisible avec un message clair', () => {
    expect(() => lireScrutin({})).toThrow(/clé « scrutin » absente/);
    const sansNumero = brutScrutin();
    sansNumero.scrutin.numero = 'x';
    expect(() => lireScrutin(sansNumero)).toThrow(/numéro de scrutin invalide/);
    const sansDate = brutScrutin();
    sansDate.scrutin.dateScrutin = '16/07/2026';
    expect(() => lireScrutin(sansDate)).toThrow(/scrutin 8317 : date invalide/);
  });
});

const brutActeur = (mandats: unknown) => ({
  acteur: {
    uid: { '@xsi:type': 'IdActeur_type', '#text': 'PA720468' },
    etatCivil: { ident: { civ: 'M.', prenom: 'Sébastien', nom: 'Chenu', alpha: 'Chenu' } },
    mandats: { mandat: mandats },
  },
});

const mandatGp = {
  uid: 'PM845750',
  legislature: '17',
  typeOrgane: 'GP',
  dateDebut: '2024-07-19',
  dateFin: null,
  organes: { organeRef: 'PO845401' },
};

const mandatAssemblee = {
  uid: 'PM840333',
  legislature: '17',
  typeOrgane: 'ASSEMBLEE',
  dateDebut: '2024-06-30',
  dateFin: null,
  organes: { organeRef: 'PO838901' },
  election: {
    lieu: { region: 'Hauts-de-France', departement: 'Nord', numDepartement: '59', numCirco: '19' },
  },
};

describe('lireActeur', () => {
  it("lit l'identifiant dans l'objet {#text} et les mandats", () => {
    const acteur = lireActeur(brutActeur([mandatGp, mandatAssemblee]));
    expect(acteur).toMatchObject({ pa: 'PA720468', prenom: 'Sébastien', nom: 'Chenu' });
    expect(acteur.mandats).toEqual([
      {
        uid: 'PM845750',
        type: 'GP',
        legislature: '17',
        debut: '2024-07-19',
        fin: null,
        organe: 'PO845401',
        lieu: null,
      },
      {
        uid: 'PM840333',
        type: 'ASSEMBLEE',
        legislature: '17',
        debut: '2024-06-30',
        fin: null,
        organe: 'PO838901',
        lieu: { departement: 'Nord', numDepartement: '59', numCirco: '19' },
      },
    ]);
  });

  it('accepte un mandat unique (objet) et une absence de mandats', () => {
    expect(lireActeur(brutActeur(mandatGp)).mandats).toHaveLength(1);
    const sans = brutActeur(null);
    sans.acteur.mandats = null as never;
    expect(lireActeur(sans).mandats).toEqual([]);
  });

  it('accepte un identifiant en chaîne simple', () => {
    const brut = brutActeur([]);
    brut.acteur.uid = 'PA1' as never;
    expect(lireActeur(brut).pa).toBe('PA1');
  });

  it('refuse un acteur sans identifiant', () => {
    expect(() => lireActeur({})).toThrow(/clé « acteur » absente/);
    const brut = brutActeur([]);
    delete (brut.acteur as { uid?: unknown }).uid;
    expect(() => lireActeur(brut)).toThrow(/sans identifiant/);
  });
});

describe('lireOrgane', () => {
  const brut = {
    organe: {
      uid: 'PO845425',
      codeType: 'GP',
      libelle: 'Droite Républicaine',
      libelleAbrege: 'DR',
      libelleAbrev: 'DR',
      viMoDe: { dateDebut: '2024-07-18', dateFin: null },
      legislature: '17',
      preseance: '5',
      couleurAssociee: '#8CB0DC',
    },
  };

  it("lit l'abrégé officiel avec sa casse (libelleAbrege, pas libelleAbrev)", () => {
    expect(
      lireOrgane({ organe: { ...brut.organe, libelleAbrege: 'EcoS', libelleAbrev: 'ECOS' } })
        .abrege,
    ).toBe('EcoS');
  });

  it('lit identifiant, type, libellé, couleur, dates et préséance', () => {
    expect(lireOrgane(brut)).toEqual({
      id: 'PO845425',
      codeType: 'GP',
      legislature: '17',
      abrege: 'DR',
      libelle: 'Droite Républicaine',
      couleur: '#8CB0DC',
      debut: '2024-07-18',
      fin: null,
      preseance: 5,
    });
  });

  it('tolère les champs absents', () => {
    const minimal = lireOrgane({
      organe: { uid: 'PO1', codeType: 'COMPER', libelle: 'Commission' },
    });
    expect(minimal).toMatchObject({
      abrege: 'Commission',
      couleur: null,
      debut: null,
      fin: null,
      legislature: null,
      preseance: 999,
    });
  });
});
