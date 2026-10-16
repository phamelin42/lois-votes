import type {
  Accueil,
  DeputeDetail,
  DeputeListe,
  LoiDetail,
  ScrutinDetail,
  VoteGroupe,
} from '@contrat';
import { ATTENDU, BASE_FAUSSE, DATAN, DEPUTES_ACTIFS, RIDS, SLUG_INCONNU, VOTES, creerUnivers, votesDe } from './testing/univers.mjs';
import { creerCache } from './cache';
import { creerBff } from './routes';
import { creerLimiteur } from './source/limiter';
import { creerTabulaire } from './source/tabulaire';

type Faux = ReturnType<typeof creerUnivers>;

function monter(faux: Faux = creerUnivers(), maintenant?: () => number) {
  const tabulaire = creerTabulaire({
    base: BASE_FAUSSE,
    fetch: faux.fetch as typeof fetch,
    limiteur: creerLimiteur({ maxParSeconde: 1000 }),
  });
  const bff = creerBff({ tabulaire, cache: creerCache({ maintenant }), maintenant });
  return { faux, bff, appeler: bff.appelerBff };
}

const somme = (c: { pour: number; contre: number; abstention: number; nonvotant: number }) =>
  c.pour + c.contre + c.abstention + c.nonvotant;

function verifierSommes(groupes: VoteGroupe[], compte: Parameters<typeof somme>[0]) {
  const total = groupes.reduce(
    (t, g) => ({
      pour: t.pour + g.compte.pour,
      contre: t.contre + g.compte.contre,
      abstention: t.abstention + g.compte.abstention,
      nonvotant: t.nonvotant + g.compte.nonvotant,
    }),
    { pour: 0, contre: 0, abstention: 0, nonvotant: 0 },
  );
  expect(total).toEqual(compte);
}

describe('GET /api/accueil', () => {
  it('renvoie les 10 derniers votes finaux, du plus récent au plus ancien', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/accueil?page=1');
    const accueil = reponse.body as Accueil;

    expect(reponse.status).toBe(200);
    expect(accueil.lois.map((l) => l.voteFinal.numero)).toEqual(ATTENDU.accueil.page1);
    expect(accueil.page).toBe(1);
    expect(accueil.pageSuivante).toBe(true);
  });

  it("ne montre qu'une carte par texte et ignore ce qui n'est pas un vote final", async () => {
    const { appeler } = monter();
    const page2 = (await appeler('/api/accueil?page=2')).body as Accueil;

    expect(page2.lois.map((l) => l.voteFinal.numero)).toEqual(ATTENDU.accueil.page2); // 95 remplace 90 ; 115 absent
    expect(page2.pageSuivante).toBe(false);
  });

  it('prend « 1 » comme page par défaut', async () => {
    const { appeler } = monter();
    const defaut = (await appeler('/api/accueil')).body as Accueil;
    expect(defaut.page).toBe(1);
  });

  it('remplit la carte du scrutin 110 : titres, lecture, compte, adoption, groupes', async () => {
    const { appeler } = monter();
    const accueil = (await appeler('/api/accueil?page=1')).body as Accueil;
    const carte = accueil.lois.find((l) => l.voteFinal.numero === 110)!;
    const attendu = ATTENDU.scrutin110;

    expect(carte.dossier).toBe(attendu.dossier);
    expect(carte.titreCourt).toBe(attendu.titreCourt);
    expect(carte.titreOfficiel).toBe(attendu.titreOfficiel);
    expect(carte.lecture).toBe(attendu.lecture);
    expect(carte.statut).toBeNull();
    expect(carte.voteFinal.type).toBe('final');
    expect(carte.voteFinal.compte).toEqual(attendu.compte);
    expect(carte.voteFinal.adopte).toBe(false);
    expect(carte.voteFinal.urlOfficielle).toBe(attendu.urlOfficielle);
    expect(carte.groupes.map((g) => g.groupe.id)).toEqual(attendu.groupes.map((g) => g.id));
    expect(carte.groupes.map((g) => g.position)).toEqual(attendu.groupes.map((g) => g.position));
  });

  it("calcule « adopté » pour un texte dont les pour l'emportent (scrutin 102)", async () => {
    const { appeler } = monter();
    const accueil = (await appeler('/api/accueil?page=1')).body as Accueil;
    const carte = accueil.lois.find((l) => l.voteFinal.numero === 102)!;
    expect(carte.voteFinal.compte).toEqual(ATTENDU.scrutin102.compte);
    expect(carte.voteFinal.adopte).toBe(true);
  });

  it('garde la date du scrutin telle que la source la donne (même instant)', async () => {
    const { appeler } = monter();
    const accueil = (await appeler('/api/accueil?page=1')).body as Accueil;
    const carte = accueil.lois.find((l) => l.voteFinal.numero === 110)!;
    expect(new Date(carte.voteFinal.date).toISOString()).toBe('2025-04-21T22:00:00.000Z');
    expect(Number.isNaN(Date.parse(accueil.miseAJour))).toBe(false);
  });

  it('donne un dossier nul à un vote final sans dossier', async () => {
    const { appeler } = monter();
    const page2 = (await appeler('/api/accueil?page=2')).body as Accueil;
    expect(page2.lois.find((l) => l.voteFinal.numero === 98)?.dossier).toBeNull();
  });

  it('la somme des groupes égale le compte du scrutin, pour chaque carte', async () => {
    const { appeler } = monter();
    for (const page of [1, 2]) {
      const accueil = (await appeler(`/api/accueil?page=${page}`)).body as Accueil;
      for (const carte of accueil.lois) verifierSommes(carte.groupes, carte.voteFinal.compte);
    }
  });

  it('pose Cache-Control : 60 s dans le navigateur (le pré-chargement peut le réutiliser), 30 min en CDN, 1 jour de stale-while-revalidate', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/accueil?page=1');
    expect(reponse.headers['cache-control']).toBe('public, max-age=60, s-maxage=1800, stale-while-revalidate=86400');
  });

  it('refuse une page hors de 1 à 50', async () => {
    const { appeler } = monter();
    for (const page of ['0', '51', 'abc', '-1', '1.5']) {
      const reponse = await appeler(`/api/accueil?page=${page}`);
      expect(reponse.status, `page=${page}`).toBe(404);
      expect(reponse.body).toEqual({ erreur: expect.any(String) });
    }
  });
});

describe('GET /api/lois/:dossier', () => {
  it('détaille une loi à un seul vote sur l\'ensemble', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/lois/DLR5L17N1110');
    const loi = reponse.body as LoiDetail;
    const attendu = ATTENDU.scrutin110;

    expect(reponse.status).toBe(200);
    expect(loi.dossier).toBe('DLR5L17N1110');
    expect(loi.titreCourt).toBe(attendu.titreCourt);
    expect(loi.titreOfficiel).toBe(attendu.titreOfficiel);
    expect(loi.lecture).toBe(attendu.lecture);
    expect(loi.statut).toBeNull();
    expect(loi.urlDossier).toBeNull();
    expect(loi.voteFinal?.numero).toBe(110);
    expect(loi.voteFinal?.groupes.map((g) => g.groupe.id)).toEqual(attendu.groupes.map((g) => g.id));
    expect(loi.lectures).toEqual([]);
    expect(loi.scrutins.map((s) => s.numero)).toEqual(ATTENDU.dossier1110.autresScrutins);
    expect(loi.scrutins.map((s) => s.type)).toEqual(['amendement', 'article', 'amendement']);
    verifierSommes(loi.voteFinal!.groupes, loi.voteFinal!.compte);
  });

  it('prend le vote le plus récent comme vote final et liste les lectures précédentes', async () => {
    const { appeler } = monter();
    const loi = (await appeler('/api/lois/DLR5L17N2000')).body as LoiDetail;

    expect(loi.voteFinal?.numero).toBe(ATTENDU.dossier2000.voteFinal);
    expect(loi.lecture).toBe(ATTENDU.dossier2000.lecture);
    expect(loi.titreCourt).toBe(ATTENDU.dossier2000.titreCourt);
    expect(loi.lectures.map((s) => s.numero)).toEqual(ATTENDU.dossier2000.lectures);
    expect(loi.lectures[0].type).toBe('final');
    expect(loi.scrutins).toEqual([]);
  });

  it('renvoie 404 pour un dossier inconnu ou mal formé', async () => {
    const { appeler } = monter();
    for (const dossier of ['DLR5L17N9999', 'abc', 'dlr5l17n1', 'DL%20X']) {
      const reponse = await appeler(`/api/lois/${dossier}`);
      expect(reponse.status, dossier).toBe(404);
      expect(reponse.body).toEqual({ erreur: expect.any(String) });
    }
  });

  it('pose Cache-Control : 1 h en CDN, 1 jour de stale-while-revalidate', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/lois/DLR5L17N1110');
    expect(reponse.headers['cache-control']).toBe('public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
  });
});

describe('GET /api/scrutins/:numero', () => {
  it('détaille le scrutin 110 : compte, groupes, loi, liste nominative', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/scrutins/110');
    const scrutin = reponse.body as ScrutinDetail;
    const attendu = ATTENDU.scrutin110;

    expect(reponse.status).toBe(200);
    expect(scrutin.numero).toBe(110);
    expect(scrutin.type).toBe('final');
    expect(scrutin.titre).toBe(attendu.titreOfficiel);
    expect(scrutin.compte).toEqual(attendu.compte);
    expect(scrutin.adopte).toBe(false);
    expect(scrutin.urlOfficielle).toBe(attendu.urlOfficielle);
    expect(scrutin.loi).toEqual({ dossier: attendu.dossier, titreCourt: attendu.titreCourt });
    expect(scrutin.groupes.map((g) => [g.groupe.id, g.position, g.compte])).toEqual(
      attendu.groupes.map((g) => [g.id, g.position, g.compte]),
    );
    verifierSommes(scrutin.groupes, scrutin.compte);

    const parGroupeEtPosition = (groupeId: string, position: string) =>
      scrutin.nominatif
        .find((n) => n.groupeId === groupeId && n.position === position)
        ?.deputes.map((d) => d.slug)
        .sort();
    expect(parGroupeEtPosition('RN', 'pour')).toEqual(['alice-durand', 'bruno-martin', 'claire-petit']);
    expect(parGroupeEtPosition('RN', 'abstention')).toEqual(['david-moreau']);
    expect(parGroupeEtPosition('LFI-NFP', 'nonvotant')).toEqual(['ibrahim-garnier']);
    expect(parGroupeEtPosition('NI', 'pour')).toEqual(['julie-fournier']);
    expect(parGroupeEtPosition('NI', 'abstention')).toEqual([SLUG_INCONNU]);
    const total = scrutin.nominatif.reduce((t, n) => t + n.deputes.length, 0);
    expect(total).toBe(somme(scrutin.compte));
  });

  it('donne le nom complet des députés connus', async () => {
    const { appeler } = monter();
    const scrutin = (await appeler('/api/scrutins/110')).body as ScrutinDetail;
    const alice = scrutin.nominatif.flatMap((n) => n.deputes).find((d) => d.slug === 'alice-durand');
    expect(alice?.nom).toBe('Alice Durand');
  });

  it('rattache un scrutin sans dossier à aucune loi', async () => {
    const { appeler } = monter();
    const motion = (await appeler('/api/scrutins/50')).body as ScrutinDetail;
    expect(motion.type).toBe('motion');
    expect(motion.loi).toBeNull();
    expect(motion.adopte).toBe(false);
  });

  it('renvoie 404 pour un numéro inconnu ou invalide', async () => {
    const { appeler } = monter();
    for (const numero of ['999999', 'abc', '-3', '1.5', '']) {
      const reponse = await appeler(`/api/scrutins/${numero}`);
      expect(reponse.status, numero).toBe(404);
    }
  });

  it('pose Cache-Control : 1 jour en CDN, 1 semaine de stale-while-revalidate', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/scrutins/110');
    expect(reponse.headers['cache-control']).toBe('public, max-age=60, s-maxage=86400, stale-while-revalidate=604800');
  });
});

describe('GET /api/deputes', () => {
  it('renvoie l\'index des députés actifs', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/deputes');
    const liste = reponse.body as DeputeListe;

    expect(reponse.status).toBe(200);
    expect(liste.deputes).toHaveLength(DEPUTES_ACTIFS.length);
    expect(liste.deputes.some((d) => d.slug === 'karim-girard')).toBe(false);
    expect(liste.deputes.find((d) => d.slug === 'elodie-roux')).toEqual({
      slug: 'elodie-roux',
      nom: 'Élodie Roux',
      nomTri: 'Roux',
      groupe: 'LFI-NFP',
      departement: '75',
      circonscription: 'Paris (11)',
    });
    expect(liste.deputes.find((d) => d.slug === 'julie-fournier')?.groupe).toBeNull();
  });

  it('liste les groupes (avec couleur officielle) et les textes récents', async () => {
    const { appeler } = monter();
    const liste = (await appeler('/api/deputes')).body as DeputeListe;

    const abreges = liste.groupes.map((g) => g.abrege);
    expect(abreges).toEqual(expect.arrayContaining(['RN', 'SOC', 'LFI-NFP']));
    expect(liste.groupes.find((g) => g.abrege === 'RN')?.couleur).toMatch(/^#[0-9a-f]{6}$/i);
    expect(liste.loisRecentes).toHaveLength(ATTENDU.loisRecentes);
    expect(liste.loisRecentes[0]).toEqual({
      dossier: 'DLR5L17N1111',
      titreCourt: expect.stringContaining('Proposition de loi'),
      date: expect.any(String),
    });
    const dates = liste.loisRecentes.map((l) => Date.parse(l.date));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('pose Cache-Control : 6 h en CDN, 1 jour de stale-while-revalidate', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/deputes');
    expect(reponse.headers['cache-control']).toBe('public, max-age=60, s-maxage=21600, stale-while-revalidate=86400');
  });
});

describe('GET /api/deputes/:slug', () => {
  it('détaille un député joint à Datan : photo, taux, fiche', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/deputes/david-moreau');
    const depute = reponse.body as DeputeDetail;

    expect(reponse.status).toBe(200);
    expect(depute.slug).toBe('david-moreau');
    expect(depute.nom).toBe('David Moreau');
    expect(depute.groupe?.abrege).toBe('RN');
    expect(depute.groupe?.libelle).toBe('Rassemblement National');
    expect(depute.circonscription).toBe('Var (4)');
    expect(depute.photo).toMatch(ATTENDU.deputeDavid.photo);
    expect(depute.photo).toContain('1004');
    expect(depute.urlFiche).toMatch(/^https:\/\/www\.assemblee-nationale\.fr\/.*PA1004/);
    expect(depute.taux.participation).toBe(ATTENDU.deputeDavid.participation);
    expect(depute.taux.loyaute).toBe(ATTENDU.deputeDavid.loyaute);
  });

  it("calcule le taux d'abstention par comptage : abstentions / (pour + contre + abstention)", async () => {
    const { appeler } = monter();
    const depute = (await appeler('/api/deputes/david-moreau')).body as DeputeDetail;

    const votes = votesDe('david-moreau');
    const abstentions = votes.filter((v) => v.position === 'ABSTENTION').length;
    const suffrages = votes.filter((v) => v.position !== 'NONVOTANT').length;
    expect(abstentions).toBeGreaterThan(0);
    expect(depute.taux.abstention).toBeCloseTo(abstentions / suffrages, 10);
  });

  it('donne ses votes sur les 10 derniers votes finaux, avec la position de son groupe', async () => {
    const { appeler } = monter();
    const depute = (await appeler('/api/deputes/david-moreau')).body as DeputeDetail;

    expect(depute.dernieresLois.map((v) => v.numero)).toEqual(ATTENDU.accueil.page1);
    const sur110 = depute.dernieresLois.find((v) => v.numero === 110)!;
    expect(sur110).toMatchObject({
      position: ATTENDU.deputeDavid.sur110.position,
      positionGroupe: ATTENDU.deputeDavid.sur110.positionGroupe,
      adopte: ATTENDU.deputeDavid.sur110.adopte,
      loi: { dossier: 'DLR5L17N1110', titreCourt: ATTENDU.scrutin110.titreCourt },
    });
    const sur111 = depute.dernieresLois.find((v) => v.numero === 111)!;
    expect(sur111.position).toBe(sur111.positionGroupe);
  });

  it("joint à Datan sans tenir compte de la casse ni des accents", async () => {
    const { appeler } = monter();
    const depute = (await appeler('/api/deputes/elodie-roux')).body as DeputeDetail;
    expect(depute.taux.participation).toBe(ATTENDU.deputeJointureAccents.participation);
    expect(depute.photo).not.toBeNull();
  });

  it('renvoie des valeurs nulles quand Datan ne connaît pas le député', async () => {
    const { appeler } = monter();
    const depute = (await appeler(`/api/deputes/${ATTENDU.deputeSansDatan}`)).body as DeputeDetail;

    expect(depute.photo).toBeNull();
    expect(depute.taux.participation).toBeNull();
    expect(depute.taux.loyaute).toBeNull();
    expect(depute.urlFiche).toContain(ATTENDU.deputeSansDatan);
    expect(depute.taux.abstention).not.toBeNull(); // calculé à partir des votes, sans Datan
  });

  it('accepte un score de loyauté nul côté Datan', async () => {
    const { appeler } = monter();
    const depute = (await appeler('/api/deputes/julie-fournier')).body as DeputeDetail;
    expect(depute.taux.loyaute).toBeNull();
    expect(depute.groupe).toEqual({ id: 'NI', abrege: 'NI', libelle: 'Non inscrits', couleur: null });
  });

  it('renvoie 404 pour un député inconnu ou un slug invalide', async () => {
    const { appeler } = monter();
    for (const slug of ['personne-inconnue', 'Alice_Durand', '..%2Fetc', 'a b']) {
      const reponse = await appeler(`/api/deputes/${slug}`);
      expect(reponse.status, slug).toBe(404);
      expect(reponse.body).toEqual({ erreur: expect.any(String) });
    }
  });

  it('pose Cache-Control : 1 h en CDN, 1 jour de stale-while-revalidate', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/deputes/david-moreau');
    expect(reponse.headers['cache-control']).toBe('public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
  });
});

describe('économie de requêtes', () => {
  it('une 2ᵉ requête identique ne touche pas la source', async () => {
    const { faux, appeler } = monter();
    for (const url of ['/api/accueil?page=1', '/api/lois/DLR5L17N1110', '/api/scrutins/110', '/api/deputes', '/api/deputes/david-moreau']) {
      await appeler(url);
      const apres = faux.requetes.length;
      await appeler(url);
      expect(faux.requetes.length, url).toBe(apres);
    }
  });

  it("ne dépasse pas 200 lignes par page et reste dans la base", async () => {
    const { faux, appeler } = monter();
    await appeler('/api/accueil?page=1');
    await appeler('/api/deputes/david-moreau');
    expect(faux.requetes.length).toBeGreaterThan(0);
    for (const requete of faux.requetes) {
      expect(requete.url.startsWith(BASE_FAUSSE + '/')).toBe(true);
      expect(Number(requete.params.get('page_size') ?? '20')).toBeLessThanOrEqual(200);
    }
  });

  it("n'interroge jamais plus de 4 requêtes à la fois", async () => {
    const { faux, appeler } = monter();
    await Promise.all([appeler('/api/accueil?page=1'), appeler('/api/deputes'), appeler('/api/lois/DLR5L17N1110')]);
    expect(faux.maxSimultanees).toBeLessThanOrEqual(4);
  });

  it("lit les votes par paquets __in sur les scrutins demandés, pas toute la table", async () => {
    const { faux, appeler } = monter();
    await appeler('/api/accueil?page=1');
    const votes = faux.requetesVers(RIDS.votes);
    expect(votes.length).toBeGreaterThan(0);
    expect(votes.every((r) => r.params.has('scrutin_id__in'))).toBe(true);
  });

  it('compte les abstentions avec des requêtes page_size=1, sans télécharger les votes', async () => {
    const { faux, appeler } = monter();
    await appeler('/api/deputes/david-moreau');
    const comptages = faux.requetesVers(RIDS.votes).filter((r) => r.params.get('page_size') === '1');
    expect(comptages.length).toBeGreaterThanOrEqual(2);
    expect(DATAN.length).toBeGreaterThan(0);
    expect(VOTES.length).toBeGreaterThan(200); // la table complète ne tient pas dans une page de 200
  });
});

describe('robustesse', () => {
  const PANNE = () => new Response('indisponible', { status: 500 });

  it('répond 503 avec Retry-After et no-store quand la source est en panne sans cache', async () => {
    const { appeler } = monter(creerUnivers({ avant: PANNE }));
    for (const url of ['/api/accueil?page=1', '/api/lois/DLR5L17N1110', '/api/scrutins/110', '/api/deputes', '/api/deputes/david-moreau']) {
      const reponse = await appeler(url);
      expect(reponse.status, url).toBe(503);
      expect(reponse.headers['retry-after']).toBe('60');
      expect(reponse.headers['cache-control']).toBe('no-store');
      expect(reponse.body).toEqual({ erreur: expect.any(String) });
    }
  });

  it('sert la valeur périmée quand la source tombe après une première réponse', async () => {
    let horloge = 1_000_000;
    let enPanne = false;
    const faux = creerUnivers({ avant: () => (enPanne ? PANNE() : undefined) });
    const { appeler } = monter(faux, () => horloge);

    const avant = await appeler('/api/accueil?page=1');
    expect(avant.status).toBe(200);

    horloge += 3 * 24 * 3600 * 1000; // bien au-delà du ttl et de la fenêtre stale
    enPanne = true;
    const apres = await appeler('/api/accueil?page=1');

    expect(apres.status).toBe(200);
    expect(apres.body).toEqual(avant.body);
  });

  it('ne met pas en cache une erreur : la reprise de la source est immédiate', async () => {
    let enPanne = true;
    const faux = creerUnivers({ avant: () => (enPanne ? PANNE() : undefined) });
    const { appeler } = monter(faux);

    expect((await appeler('/api/deputes')).status).toBe(503);
    enPanne = false;
    expect((await appeler('/api/deputes')).status).toBe(200);
  });

  it('se rétablit après un 429 de la source', async () => {
    vi.useFakeTimers();
    try {
      let premiere = true;
      const faux = creerUnivers({
        avant: () => {
          if (!premiere) return undefined;
          premiere = false;
          return new Response('trop vite', { status: 429, headers: { 'retry-after': '1' } });
        },
      });
      const { appeler } = monter(faux);

      const reponse = appeler('/api/deputes');
      await vi.advanceTimersByTimeAsync(1500);

      expect((await reponse).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('appelerBff', () => {
  it('a la signature attendue par le rendu serveur', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/deputes');
    expect(typeof reponse.status).toBe('number');
    expect(reponse.headers).toEqual(expect.objectContaining({ 'cache-control': expect.any(String) }));
    expect(reponse.body).toBeTypeOf('object');
  });

  it('renvoie 404 pour une route /api inconnue', async () => {
    const { appeler } = monter();
    const reponse = await appeler('/api/inconnue');
    expect(reponse.status).toBe(404);
    expect(reponse.body).toEqual({ erreur: expect.any(String) });
  });

  it('accepte une URL absolue', async () => {
    const { appeler } = monter();
    const reponse = await appeler('http://localhost:4000/api/scrutins/110');
    expect(reponse.status).toBe(200);
  });
});
