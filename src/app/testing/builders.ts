// Fabriques de données conformes à src/shared/contrat.ts, pour les specs des composants et des pages.
import type {
  Accueil,
  Compte,
  DeputeDetail,
  DeputeListe,
  Groupe,
  LoiCarte,
  LoiDetail,
  ScrutinDetail,
  ScrutinResume,
  VoteGroupe,
} from '@contrat';

export const RN: Groupe = {
  id: 'PO845401',
  abrege: 'RN',
  libelle: 'Rassemblement National',
  couleur: '#1b3a8a',
};
export const SOC: Groupe = {
  id: 'PO845419',
  abrege: 'SOC',
  libelle: 'Socialistes et apparentés',
  couleur: '#e4002b',
};
export const LFI: Groupe = {
  id: 'PO845413',
  abrege: 'LFI-NFP',
  libelle: 'La France insoumise - Nouveau Front Populaire',
  couleur: '#c4001d',
};
export const NI: Groupe = {
  id: 'PO840056',
  abrege: 'NI',
  libelle: 'Non inscrits',
  couleur: null,
};
/** Deux organes officiels portent l'abrégé « UDR » : le groupe d'origine (2024) et celui recréé en 2025. */
export const UDR_2024: Groupe = {
  id: 'PO847173',
  abrege: 'UDR',
  libelle: 'UDR',
  couleur: '#3367a7',
};
export const UDR_2025: Groupe = {
  id: 'PO872880',
  abrege: 'UDR',
  libelle: 'Union des droites pour la République',
  couleur: '#3367a7',
};

export const compte = (pour = 312, contre = 201, abstention = 18, nonvotant = 46): Compte => ({
  pour,
  contre,
  abstention,
  nonvotant,
});

export function voteGroupe(
  groupe: Groupe,
  position: VoteGroupe['position'],
  c: Partial<Compte> = {},
): VoteGroupe {
  return { groupe, position, compte: { pour: 0, contre: 0, abstention: 0, nonvotant: 0, ...c } };
}

export const groupes = (): VoteGroupe[] => [
  voteGroupe(RN, 'pour', { pour: 3, abstention: 1 }),
  voteGroupe(LFI, 'contre', { contre: 2, nonvotant: 1 }),
  voteGroupe(SOC, 'contre', { contre: 3 }),
  voteGroupe(NI, 'partage', { pour: 1, abstention: 1 }),
];

export function scrutin(numero = 8317, surcharge: Partial<ScrutinResume> = {}): ScrutinResume {
  return {
    numero,
    date: '2024-10-07T22:00:00+00:00',
    titre: "l'ensemble du projet de loi relatif à la sobriété foncière (première lecture)",
    type: 'final',
    adopte: true,
    compte: compte(),
    urlOfficielle: `https://www.assemblee-nationale.fr/dyn/17/scrutins/${numero}`,
    ...surcharge,
  };
}

export function loiCarte(
  dossier: string | null = 'DLR5L17N54372',
  numero = 8317,
  surcharge: Partial<LoiCarte> = {},
): LoiCarte {
  return {
    dossier,
    titreCourt: 'Projet de loi relatif à la sobriété foncière',
    titreOfficiel:
      "l'ensemble du projet de loi relatif à la sobriété foncière, adopté par le Sénat après engagement de la procédure accélérée (première lecture)",
    lecture: 'première lecture',
    statut: null,
    voteFinal: scrutin(numero),
    groupes: groupes(),
    ...surcharge,
  };
}

export function accueil(nombre = 2, page = 1, pageSuivante = false): Accueil {
  return {
    lois: Array.from({ length: nombre }, (_, i) =>
      loiCarte(`DLR5L17N${50000 + page * 100 + i}`, 8000 + page * 100 + i, {
        titreCourt: `Loi numéro ${page}-${i + 1}`,
      }),
    ),
    page,
    pageSuivante,
    miseAJour: '2025-01-15T09:00:00Z',
  };
}

export function loiDetail(surcharge: Partial<LoiDetail> = {}): LoiDetail {
  return {
    dossier: 'DLR5L17N54372',
    titreCourt: 'Projet de loi relatif à la sobriété foncière',
    titreOfficiel: "l'ensemble du projet de loi relatif à la sobriété foncière (première lecture)",
    lecture: 'première lecture',
    statut: null,
    urlDossier: null,
    voteFinal: { ...scrutin(8317), groupes: groupes() },
    lectures: [],
    scrutins: [],
    ...surcharge,
  };
}

export function scrutinDetail(surcharge: Partial<ScrutinDetail> = {}): ScrutinDetail {
  return {
    ...scrutin(8317),
    loi: { dossier: 'DLR5L17N54372', titreCourt: 'Projet de loi relatif à la sobriété foncière' },
    groupes: groupes(),
    nominatif: [
      {
        groupeId: 'PO845401',
        position: 'pour',
        deputes: [{ slug: 'alice-durand', nom: 'Alice Durand' }],
      },
      {
        groupeId: 'PO845419',
        position: 'contre',
        deputes: [{ slug: 'emilie-laurent', nom: 'Émilie Laurent' }],
      },
    ],
    ...surcharge,
  };
}

export function deputeListe(): DeputeListe {
  const d = (
    slug: string,
    nom: string,
    nomTri: string,
    groupe: string | null,
    departement: string,
    circonscription: string,
  ) => ({
    slug,
    nom,
    nomTri,
    groupe,
    departement,
    circonscription,
  });
  return {
    deputes: [
      d('alice-durand', 'Alice Durand', 'Durand', 'RN', '69', 'Rhône (7)'),
      d('bruno-martin', 'Bruno Martin', 'Martin', 'RN', '13', 'Bouches-du-Rhône (3)'),
      d('elodie-roux', 'Élodie Roux', 'Roux', 'LFI-NFP', '75', 'Paris (11)'),
      d('emilie-laurent', 'Émilie Laurent', 'Laurent', 'SOC', '69', 'Rhône (2)'),
      d('julie-fournier', 'Julie Fournier', 'Fournier', null, '69', 'Rhône (1)'),
    ],
    groupes: [RN, SOC, LFI, NI],
    loisRecentes: [
      {
        dossier: 'DLR5L17N54372',
        titreCourt: 'Projet de loi relatif à la sobriété foncière',
        date: '2025-01-10T22:00:00+00:00',
      },
      {
        dossier: 'DLR5L17N2000',
        titreCourt: 'Proposition de loi visant à protéger les abeilles',
        date: '2024-12-10T22:00:00+00:00',
      },
    ],
  };
}

export function deputeDetail(surcharge: Partial<DeputeDetail> = {}): DeputeDetail {
  return {
    slug: 'alice-durand',
    nom: 'Alice Durand',
    photo: 'https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre/1001.jpg',
    groupe: RN,
    circonscription: 'Rhône (7)',
    urlFiche: 'https://www.assemblee-nationale.fr/dyn/deputes/PA1001',
    taux: { participation: 0.91, abstention: 0.12, loyaute: 0.99 },
    dernieresLois: [
      {
        loi: {
          dossier: 'DLR5L17N54372',
          titreCourt: 'Projet de loi relatif à la sobriété foncière',
        },
        numero: 8317,
        date: '2024-10-07T22:00:00+00:00',
        position: 'abstention',
        positionGroupe: 'pour',
        adopte: true,
      },
      {
        loi: {
          dossier: 'DLR5L17N2000',
          titreCourt: 'Proposition de loi visant à protéger les abeilles',
        },
        numero: 8200,
        date: '2024-09-01T22:00:00+00:00',
        position: 'pour',
        positionGroupe: 'pour',
        adopte: true,
      },
      {
        loi: { dossier: null, titreCourt: 'Texte sans dossier' },
        numero: 8100,
        date: '2024-08-01T22:00:00+00:00',
        position: null,
        positionGroupe: null,
        adopte: false,
      },
    ],
    ...surcharge,
  };
}
