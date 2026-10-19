// @vitest-environment node
import { lireActeur, lireOrgane, lireScrutin } from './lire.mjs';
import { organesCites, reduireActeur, reduireOrgane, reduireScrutin } from './fixtures.mjs';

const votant = (pa: string, plus: Record<string, string> = {}) => ({
  acteurRef: pa,
  mandatRef: 'PM1',
  parDelegation: 'false',
  numPlace: '001',
  ...plus,
});

const brut = () => ({
  scrutin: {
    '@xmlns': 'http://schemas.assemblee-nationale.fr/referentiel',
    uid: 'VTANR5L17V5',
    numero: '5',
    seanceRef: 'RUANR5L17S2026IDS30861',
    dateScrutin: '2026-07-16',
    typeVote: { codeTypeVote: 'SPO' },
    sort: { code: 'adopté' },
    titre: "l'ensemble du projet de loi X (première lecture).",
    objet: { dossierLegislatif: { dossierRef: 'DLR5L17N1' } },
    demandeur: { texte: 'Président' },
    syntheseVote: {
      nombreVotants: '5',
      suffragesExprimes: '4',
      nbrSuffragesRequis: '3',
      annonce: "L'Assemblée nationale a adopté",
      decompte: {
        nonVotants: '1',
        pour: '3',
        contre: '1',
        abstentions: '1',
        nonVotantsVolontaires: '0',
      },
    },
    ventilationVotes: {
      organe: {
        organeRef: 'PO838901',
        groupes: {
          groupe: [
            {
              organeRef: 'PO1',
              nombreMembresGroupe: '40',
              vote: {
                positionMajoritaire: 'pour',
                decompteVoix: {
                  nonVotants: '1',
                  pour: '2',
                  contre: '0',
                  abstentions: '1',
                  nonVotantsVolontaires: '1',
                },
                decompteNominatif: {
                  nonVotants: { votant: votant('PA9', { causePositionVote: 'PSE' }) },
                  pours: { votant: [votant('PA1'), votant('PA2')] },
                  contres: null,
                  abstentions: { votant: votant('PA3') },
                },
              },
            },
            {
              organeRef: 'PO2',
              nombreMembresGroupe: '30',
              vote: {
                positionMajoritaire: 'contre',
                decompteVoix: {
                  nonVotants: '0',
                  pour: '1',
                  contre: '1',
                  abstentions: '0',
                  nonVotantsVolontaires: '0',
                },
                decompteNominatif: {
                  nonVotants: null,
                  pours: { votant: votant('PA4') },
                  contres: { votant: votant('PA5') },
                  abstentions: null,
                },
              },
            },
          ],
        },
      },
    },
    miseAuPoint: {
      nonVotants: [null, null],
      pours: [null, { votant: votant('PA5') }],
      abstentions: [null, null],
      nonVotantsVolontaires: [null, null],
      contres: null,
      dysfonctionnement: {
        nonVotants: null,
        pour: null,
        contre: { votant: votant('PA2') },
        abstentions: null,
      },
    },
    lieuVote: 'Salons',
  },
});

describe('reduireScrutin', () => {
  it('garde les seuls votants retenus et recalcule les décomptes du groupe et du scrutin', () => {
    const reduit = reduireScrutin(brut(), new Set(['PA1', 'PA3', 'PA5', 'PA9']));
    const lu = lireScrutin(reduit);
    expect(lu.groupes[0].votants).toEqual({
      pour: ['PA1'],
      contre: [],
      abstention: ['PA3'],
      nonvotant: ['PA9'],
    });
    expect(lu.groupes[0].compte).toEqual({ pour: 1, contre: 0, abstention: 1, nonvotant: 1 });
    expect(lu.groupes[1].votants).toEqual({
      pour: [],
      contre: ['PA5'],
      abstention: [],
      nonvotant: [],
    });
    expect(lu.compte).toEqual({ pour: 1, contre: 1, abstention: 1, nonvotant: 1 });
  });

  it("garde les particularités de l'archive : un seul votant est un objet, une liste vide est null", () => {
    const { scrutin } = reduireScrutin(brut(), new Set(['PA1', 'PA2', 'PA3', 'PA9']));
    const nominatif = scrutin.ventilationVotes.organe.groupes.groupe[0].vote.decompteNominatif;
    expect(Array.isArray(nominatif.pours.votant)).toBe(true);
    expect(Array.isArray(nominatif.abstentions.votant)).toBe(false);
    expect(nominatif.contres).toBeNull();
    expect(
      scrutin.ventilationVotes.organe.groupes.groupe[1].vote.decompteNominatif.pours,
    ).toBeNull();
  });

  it("garde l'identité du scrutin (titre, date, dossier, résultat officiel, position officielle) et retire l'inutile", () => {
    const { scrutin } = reduireScrutin(brut(), new Set(['PA1']));
    expect(scrutin).toMatchObject({
      numero: '5',
      dateScrutin: '2026-07-16',
      titre: "l'ensemble du projet de loi X (première lecture).",
      sort: { code: 'adopté' },
      objet: { dossierLegislatif: { dossierRef: 'DLR5L17N1' } },
    });
    expect(scrutin.ventilationVotes.organe.groupes.groupe[1].vote.positionMajoritaire).toBe(
      'contre',
    );
    expect(scrutin['@xmlns']).toBeUndefined();
    expect(scrutin.demandeur).toBeUndefined();
    expect(scrutin.seanceRef).toBeUndefined();
  });

  it('recalcule votants, suffrages et majorité requise', () => {
    const { scrutin } = reduireScrutin(brut(), new Set(['PA1', 'PA2', 'PA4', 'PA5']));
    expect(scrutin.syntheseVote).toMatchObject({
      nombreVotants: '4',
      suffragesExprimes: '4',
      nbrSuffragesRequis: '3',
    });
  });

  it('réduit aussi la mise au point, qui garde sa forme quand elle devient vide', () => {
    const avec = reduireScrutin(brut(), new Set(['PA5'])).scrutin.miseAuPoint;
    expect(lireScrutin(reduireScrutin(brut(), new Set(['PA5']))).miseAuPoint).toBe(true);
    expect(avec.pours).toEqual({ votant: votant('PA5') });
    const sans = reduireScrutin(brut(), new Set(['PA1']));
    expect(sans.scrutin.miseAuPoint.pours).toEqual([null, null]);
    expect(lireScrutin(sans).miseAuPoint).toBe(false);
  });

  it('réduit aussi le dysfonctionnement de boîtier, qui compte comme une mise au point', () => {
    const avec = reduireScrutin(brut(), new Set(['PA2'])).scrutin.miseAuPoint;
    expect(avec.dysfonctionnement.contre).toEqual({ votant: votant('PA2') });
    expect(lireScrutin(reduireScrutin(brut(), new Set(['PA2']))).miseAuPoint).toBe(true);
    const sans = reduireScrutin(brut(), new Set(['PA1'])).scrutin.miseAuPoint;
    expect(sans.dysfonctionnement).toEqual({
      nonVotants: null,
      pour: null,
      contre: null,
      abstentions: null,
    });
    expect(lireScrutin(reduireScrutin(brut(), new Set(['PA1']))).miseAuPoint).toBe(false);
  });

  it("garde une incohérence de l'archive sur les non-votants, pour que la correction soit testée", () => {
    const incoherent = brut();
    incoherent.scrutin.syntheseVote.decompte.nonVotants = '10';
    const lu = lireScrutin(reduireScrutin(incoherent, new Set(['PA1', 'PA9'])));
    expect(lu.compte.nonvotant).toBe(10);
    expect(lu.groupes.reduce((n, g) => n + g.compte.nonvotant, 0)).toBe(1);
  });

  it("ne modifie pas le brut d'origine", () => {
    const original = brut();
    const copie = structuredClone(original);
    reduireScrutin(original, new Set(['PA1']));
    expect(original).toEqual(copie);
  });
});

describe('reduireActeur et reduireOrgane', () => {
  const acteur = {
    acteur: {
      uid: { '@xsi:type': 'IdActeur_type', '#text': 'PA720468' },
      etatCivil: {
        ident: { civ: 'M.', prenom: 'Sébastien', nom: 'Chenu', alpha: 'Chenu', trigramme: 'SCE' },
        infoNaissance: { dateNais: '1973-04-13' },
      },
      profession: { libelleCourant: 'Conseiller' },
      adresses: { adresse: [{ uid: 'AD1' }] },
      mandats: {
        mandat: [
          {
            uid: 'PM1',
            acteurRef: 'PA720468',
            legislature: '16',
            typeOrgane: 'GP',
            dateDebut: '2022-06-29',
            dateFin: '2024-06-09',
            organes: { organeRef: 'PO800520' },
          },
          {
            uid: 'PM2',
            acteurRef: 'PA720468',
            legislature: '17',
            typeOrgane: 'GP',
            dateDebut: '2024-07-19',
            dateFin: null,
            organes: { organeRef: 'PO845401' },
          },
          {
            uid: 'PM3',
            acteurRef: 'PA720468',
            legislature: '17',
            typeOrgane: 'DELEGBUREAU',
            dateDebut: '2025-12-10',
            dateFin: null,
            organes: { organeRef: 'PO876724' },
          },
          {
            uid: 'PM4',
            acteurRef: 'PA720468',
            legislature: '17',
            typeOrgane: 'ASSEMBLEE',
            dateDebut: '2024-06-30',
            dateFin: null,
            organes: { organeRef: 'PO838901' },
            election: {
              lieu: {
                region: 'Hauts-de-France',
                departement: 'Nord',
                numDepartement: '59',
                numCirco: '19',
              },
              causeMandat: 'élections générales',
            },
            collaborateurs: { collaborateur: [{ nom: 'X' }] },
          },
        ],
      },
    },
  };

  it("ne garde que l'identité et les mandats GP et ASSEMBLEE de la 17ᵉ législature", () => {
    const lu = lireActeur(reduireActeur(acteur));
    expect(lu.pa).toBe('PA720468');
    expect(lu.mandats.map((m) => [m.uid, m.type])).toEqual([
      ['PM2', 'GP'],
      ['PM4', 'ASSEMBLEE'],
    ]);
    expect(lu.mandats[1].lieu).toEqual({
      departement: 'Nord',
      numDepartement: '59',
      numCirco: '19',
    });
    expect(JSON.stringify(reduireActeur(acteur))).not.toMatch(/collaborateur|trigramme/);
  });

  describe('fiche enrichie', () => {
    const riche = () => {
      const brut = structuredClone(acteur);
      Object.assign(brut.acteur, {
        uri_hatvp: 'https://www.hatvp.fr/pages_nominatives/chenu-sebastien',
        adresses: {
          adresse: [
            {
              uid: 'AD1',
              typeLibelle: 'Adresse officielle',
              ville: 'Paris 07 SP',
              codePostal: '75355',
            },
            { uid: 'AD2', typeLibelle: 'Téléphone', valElec: '01.40.63.01.03' },
            { uid: 'AD3', typeLibelle: 'Mèl', valElec: 'depute@assemblee-nationale.fr' },
            { uid: 'AD4', typeLibelle: 'Twitter', valElec: '@sebchenu', poids: null },
            { uid: 'AD5', typeLibelle: 'Facebook', valElec: 'chenu.sebastien' },
            { uid: 'AD6', typeLibelle: 'Site internet', valElec: 'www.exemple.fr' },
            { uid: 'AD7', typeLibelle: 'Linkedin', valElec: '/in/sebchenu' },
          ],
        },
      });
      Object.assign(brut.acteur.etatCivil, { dateDeces: { '@xsi:nil': 'true' } });
      const mandats = brut.acteur.mandats.mandat as Record<string, unknown>[];
      mandats.push(
        {
          uid: 'PM10',
          acteurRef: 'PA720468',
          legislature: '15',
          typeOrgane: 'ASSEMBLEE',
          dateDebut: '2017-06-18',
          dateFin: '2022-06-21',
          organes: { organeRef: 'PO717460' },
          election: { lieu: { departement: 'Nord', numDepartement: '59', numCirco: '19' } },
        },
        {
          uid: 'PM11',
          acteurRef: 'PA720468',
          legislature: '17',
          typeOrgane: 'BUREAU',
          dateDebut: '2025-10-01',
          dateFin: null,
          organes: { organeRef: 'PO419604' },
          infosQualite: {
            codeQualite: 'Vice-Président',
            libQualite: "Vice-président de l'Assemblée nationale",
            libQualiteSex: "Vice-présidente de l'Assemblée nationale",
            autre: 'x',
          },
        },
        {
          uid: 'PM12',
          acteurRef: 'PA720468',
          legislature: '17',
          typeOrgane: 'COMPER',
          dateDebut: '2024-07-20',
          dateFin: null,
          organes: { organeRef: 'PO419610' },
          infosQualite: { codeQualite: 'Membre', libQualite: 'Membre' },
        },
        {
          uid: 'PM13',
          acteurRef: 'PA720468',
          legislature: null,
          typeOrgane: 'PARPOL',
          dateDebut: '2025-12-03',
          dateFin: null,
          organes: { organeRef: 'PO761239' },
        },
        {
          uid: 'PM14',
          acteurRef: 'PA720468',
          legislature: null,
          typeOrgane: 'PARPOL',
          dateDebut: '2017-12-01',
          dateFin: '2018-11-30',
          organes: { organeRef: 'PO684946' },
        },
        {
          uid: 'PM15',
          acteurRef: 'PA720468',
          legislature: '16',
          typeOrgane: 'COMPER',
          dateDebut: '2022-06-30',
          dateFin: '2024-06-09',
          organes: { organeRef: 'PO800000' },
        },
        {
          uid: 'PM16',
          acteurRef: 'PA720468',
          legislature: '17',
          typeOrgane: 'CMP',
          dateDebut: '2025-01-01',
          dateFin: null,
          organes: { organeRef: 'PO900000' },
        },
      );
      return brut;
    };

    it('garde naissance, décès, profession et adresse HATVP, et les lit avec lireActeur', () => {
      const lu = lireActeur(reduireActeur(riche()));

      expect(lu).toMatchObject({
        naissance: { date: '1973-04-13', lieu: null },
        deces: null,
        profession: 'Conseiller',
        hatvp: 'https://www.hatvp.fr/pages_nominatives/chenu-sebastien',
      });
    });

    it('ne garde des adresses que le site, X et Facebook : ni téléphone, ni e-mail, ni adresse postale', () => {
      const reduit = reduireActeur(riche());
      const texte = JSON.stringify(reduit);

      expect(texte).not.toMatch(/01\.40|depute@|Paris|75355|Linkedin|Téléphone|Mèl/);
      expect(lireActeur(reduit).liens).toEqual({
        siteWeb: 'https://www.exemple.fr/',
        x: 'https://x.com/sebchenu',
        facebook: 'https://www.facebook.com/chenu.sebastien',
      });
    });

    it('garde les mandats de député de toutes les législatures, de groupe, de bureau, de commission et le parti en cours', () => {
      const lu = lireActeur(reduireActeur(riche()));

      expect(lu.mandats.map((m) => [m.uid, m.type])).toEqual([
        ['PM2', 'GP'],
        ['PM4', 'ASSEMBLEE'],
        ['PM10', 'ASSEMBLEE'],
        ['PM11', 'BUREAU'],
        ['PM12', 'COMPER'],
        ['PM13', 'PARPOL'],
      ]);
      expect(lu.mandats.find((m) => m.uid === 'PM11')?.qualite).toBe(
        "Vice-présidente de l'Assemblée nationale",
      );
      expect(lu.mandats.find((m) => m.uid === 'PM12')?.qualite).toBe('Membre');
    });

    it("garde l'adresse HATVP absente de l'archive (objet xsi:nil) telle quelle : elle se lit comme absente", () => {
      const brut = riche();
      Object.assign(brut.acteur, { uri_hatvp: { '@xsi:nil': 'true' } });

      expect(reduireActeur(brut).acteur).toHaveProperty('uri_hatvp');
      expect(lireActeur(reduireActeur(brut)).hatvp).toBeNull();
    });

    it('liste les organes cités par les mandats de bureau, de commission et de parti gardés', () => {
      const reduit = reduireActeur(riche());

      expect([...organesCites([reduit])].sort()).toEqual(['PO419604', 'PO419610', 'PO761239']);
    });
  });

  it("écrit un mandat unique comme un objet, comme l'archive", () => {
    const un = structuredClone(acteur);
    un.acteur.mandats.mandat = [un.acteur.mandats.mandat[1]];
    expect(Array.isArray(reduireActeur(un).acteur.mandats.mandat)).toBe(false);
    expect(lireActeur(reduireActeur(un)).mandats).toHaveLength(1);
  });

  it("réduit un organe aux champs lus, avec la casse de l'abrégé officiel", () => {
    const organe = {
      organe: {
        uid: 'PO845439',
        codeType: 'GP',
        libelle: 'Écologiste et Social',
        libelleAbrege: 'EcoS',
        libelleAbrev: 'ECOS',
        viMoDe: { dateDebut: '2024-07-18', dateFin: null },
        legislature: '17',
        preseance: '6',
        couleurAssociee: '#77AA79',
        secretariat: { secretaire01: null },
      },
    };
    const reduit = reduireOrgane(organe);
    expect(JSON.stringify(reduit)).not.toContain('secretariat');
    expect(lireOrgane(reduit)).toMatchObject({
      id: 'PO845439',
      abrege: 'EcoS',
      couleur: '#77AA79',
      preseance: 6,
      debut: '2024-07-18',
      fin: null,
    });
  });
});
