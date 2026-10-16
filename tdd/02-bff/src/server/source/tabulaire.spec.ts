import { creerFauxTabulaire } from '../testing/faux-tabulaire.mjs';
import { BASE_FAUSSE, RIDS, SCRUTINS, VOTES, creerUnivers } from '../testing/univers.mjs';
import { creerLimiteur } from './limiter';
import { creerTabulaire, ErreurSource } from './tabulaire';

function client(faux = creerUnivers(), options: Record<string, unknown> = {}) {
  const tabulaire = creerTabulaire({
    base: faux.base,
    fetch: faux.fetch as typeof fetch,
    limiteur: creerLimiteur({ maxParSeconde: 1000 }),
    ...options,
  });
  return { faux, tabulaire };
}

describe('client de l\'API tabulaire', () => {
  describe('lignes', () => {
    it('envoie le filtre exact, le tri et la pagination', async () => {
      const { faux, tabulaire } = client();

      const page = await tabulaire.lignes(
        RIDS.scrutins,
        {
          filtres: [{ colonne: 'dossier_ref', op: 'exact', valeur: 'DLR5L17N2000' }],
          tri: { colonne: 'date', ordre: 'desc' },
        },
        { page: 1, pageSize: 10 },
      );

      const { params, rid } = faux.requetes[0];
      expect(rid).toBe(RIDS.scrutins);
      expect(params.get('dossier_ref__exact')).toBe('DLR5L17N2000');
      expect(params.get('date__sort')).toBe('desc');
      expect(params.get('page')).toBe('1');
      expect(params.get('page_size')).toBe('10');
      expect(page.lignes.map((l) => l['id'])).toEqual(['VTANR5L17V95', 'VTANR5L17V90']);
      expect(page.total).toBe(2);
      expect(page.suivante).toBe(false);
    });

    it("transmet l'apostrophe de __contains telle quelle", async () => {
      const { faux, tabulaire } = client();
      const page = await tabulaire.lignes(
        RIDS.scrutins,
        { filtres: [{ colonne: 'title', op: 'contains', valeur: "l'ensemble" }] },
        { pageSize: 200 },
      );
      expect(faux.requetes[0].params.get('title__contains')).toBe("l'ensemble");
      expect(page.total).toBe(16);
    });

    it('joint les valeurs de __in avec des virgules', async () => {
      const { faux, tabulaire } = client();
      await tabulaire.lignes(
        RIDS.votes,
        { filtres: [{ colonne: 'scrutin_id', op: 'in', valeur: ['VTANR5L17V110', 'VTANR5L17V102'] }] },
        { pageSize: 200 },
      );
      expect(faux.requetes[0].params.get('scrutin_id__in')).toBe('VTANR5L17V110,VTANR5L17V102');
    });

    it('indique une page suivante quand il en reste', async () => {
      const { tabulaire } = client();
      const page = await tabulaire.lignes(RIDS.votes, {}, { page: 1, pageSize: 100 });
      expect(page.lignes).toHaveLength(100);
      expect(page.total).toBe(VOTES.length);
      expect(page.suivante).toBe(true);
    });

    it("ne demande jamais plus de 200 lignes par page", async () => {
      const { faux, tabulaire } = client();
      await tabulaire.lignes(RIDS.votes, {}, { pageSize: 5000 });
      expect(Number(faux.requetes[0].params.get('page_size'))).toBeLessThanOrEqual(200);
    });

    it("n'interroge que la base configurée", async () => {
      const { faux, tabulaire } = client();
      await tabulaire.lignes(RIDS.deputes, {}, {});
      expect(faux.requetes.every((r) => r.url.startsWith(BASE_FAUSSE + '/'))).toBe(true);
    });

    it('fusionne deux appels identiques simultanés en une requête', async () => {
      const { faux, tabulaire } = client();
      const requete = { filtres: [{ colonne: 'active', op: 'exact' as const, valeur: true }] };
      const [a, b] = await Promise.all([
        tabulaire.lignes(RIDS.deputes, requete, { pageSize: 200 }),
        tabulaire.lignes(RIDS.deputes, requete, { pageSize: 200 }),
      ]);
      expect(faux.requetes).toHaveLength(1);
      expect(a.total).toBe(11);
      expect(b.total).toBe(11);
    });
  });

  describe('toutesLesLignes', () => {
    it('suit la pagination jusqu\'au bout', async () => {
      const { faux, tabulaire } = client();
      const lignes = await tabulaire.toutesLesLignes(RIDS.votes, {});
      expect(lignes).toHaveLength(VOTES.length);
      expect(faux.requetes.length).toBeGreaterThanOrEqual(2);
      expect(faux.requetes.every((r) => Number(r.params.get('page_size')) <= 200)).toBe(true);
    });

    it('ne dépasse pas 4 requêtes simultanées', async () => {
      const grosseTable = Array.from({ length: 1700 }, (_, i) => ({ n: i }));
      const faux = creerFauxTabulaire([{ rid: 'grosse', lignes: grosseTable }], { base: BASE_FAUSSE });
      const { tabulaire } = client(faux as ReturnType<typeof creerUnivers>);

      const lignes = await tabulaire.toutesLesLignes('grosse', {});

      expect(lignes).toHaveLength(1700);
      expect(faux.maxSimultanees).toBeLessThanOrEqual(4);
    });

    it('découpe une liste __in trop longue et réunit les résultats', async () => {
      const ids = SCRUTINS.slice(0, 12).map((s) => s.id);
      const faux = creerUnivers({ maxValeursIn: 5 });
      const { tabulaire } = client(faux, { maxValeursIn: 5 });

      const lignes = await tabulaire.toutesLesLignes(RIDS.scrutins, {
        filtres: [{ colonne: 'id', op: 'in', valeur: ids }],
      });

      expect(lignes.map((l) => l['id']).sort()).toEqual([...ids].sort());
      const requetesIn = faux.requetes.filter((r) => r.params.has('id__in'));
      expect(requetesIn.length).toBeGreaterThanOrEqual(3);
      for (const r of requetesIn) {
        expect(r.params.get('id__in')!.split(',').length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('compter', () => {
    it('lit meta.total avec une page d\'une ligne', async () => {
      const { faux, tabulaire } = client();
      const total = await tabulaire.compter(RIDS.votes, {
        filtres: [
          { colonne: 'deputy_slug', op: 'exact', valeur: 'david-moreau' },
          { colonne: 'position', op: 'exact', valeur: 'ABSTENTION' },
        ],
      });
      expect(faux.requetes).toHaveLength(1);
      expect(faux.requetes[0].params.get('page_size')).toBe('1');
      expect(total).toBe(VOTES.filter((v) => v.deputy_slug === 'david-moreau' && v.position === 'ABSTENTION').length);
    });

    it('additionne les comptages d\'une liste __in découpée', async () => {
      const ids = SCRUTINS.slice(0, 12).map((s) => s.id);
      const faux = creerUnivers({ maxValeursIn: 5 });
      const { tabulaire } = client(faux, { maxValeursIn: 5 });
      const total = await tabulaire.compter(RIDS.votes, {
        filtres: [{ colonne: 'scrutin_id', op: 'in', valeur: ids }],
      });
      expect(total).toBe(VOTES.filter((v) => ids.includes(v.scrutin_id)).length);
    });
  });

  describe('erreurs', () => {
    it('lève une ErreurSource sur une réponse 5xx', async () => {
      const faux = creerUnivers({ avant: () => new Response('boom', { status: 500 }) });
      const { tabulaire } = client(faux);
      await expect(tabulaire.lignes(RIDS.deputes, {}, {})).rejects.toBeInstanceOf(ErreurSource);
    });

    it('lève une ErreurSource sur une ressource inconnue', async () => {
      const { tabulaire } = client();
      await expect(tabulaire.lignes('rid-inexistant', {}, {})).rejects.toBeInstanceOf(ErreurSource);
    });

    it('lève une ErreurSource quand le réseau échoue', async () => {
      const { tabulaire } = client(creerUnivers(), {
        fetch: () => Promise.reject(new TypeError('fetch failed')),
      });
      await expect(tabulaire.lignes(RIDS.deputes, {}, {})).rejects.toBeInstanceOf(ErreurSource);
    });

    describe('avec horloge factice', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('réessaie après un 429 en respectant Retry-After', async () => {
        let premiere = true;
        const faux = creerUnivers({
          avant: () => {
            if (!premiere) return undefined;
            premiere = false;
            return new Response('trop vite', { status: 429, headers: { 'retry-after': '1' } });
          },
        });
        const { tabulaire } = client(faux);

        const resultat = tabulaire.compter(RIDS.deputes, {});
        await vi.advanceTimersByTimeAsync(1100);

        await expect(resultat).resolves.toBe(12);
        expect(faux.requetes).toHaveLength(2);
      });

      it("abandonne après 8 secondes sans réponse (AbortController + setTimeout)", async () => {
        const { tabulaire } = client(creerUnivers(), {
          fetch: (_url: string, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
            }),
        });

        const resultat = tabulaire.lignes(RIDS.deputes, {}, {});
        const verification = expect(resultat).rejects.toBeInstanceOf(ErreurSource);
        await vi.advanceTimersByTimeAsync(8100);

        await verification;
      });
    });
  });
});
