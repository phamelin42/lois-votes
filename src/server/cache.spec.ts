import { creerCache } from './cache';

// ttl et stale sont en secondes ; l'horloge injectée est en millisecondes.
function horloge(debut = 1_000_000) {
  let maintenant = debut;
  return {
    maintenant: () => maintenant,
    avancer: (secondes: number) => {
      maintenant += secondes * 1000;
    },
  };
}

describe('cache mémoire (memo)', () => {
  it('charge une fois puis sert la valeur tant que le ttl court', async () => {
    const h = horloge();
    const cache = creerCache({ maintenant: h.maintenant });
    const charger = vi.fn().mockResolvedValue('a');

    expect(await cache.memo('cle', 60, 600, charger)).toBe('a');
    h.avancer(59);
    expect(await cache.memo('cle', 60, 600, charger)).toBe('a');
    expect(charger).toHaveBeenCalledTimes(1);
  });

  it('fusionne les appels simultanés en un seul chargement', async () => {
    const cache = creerCache();
    let fin!: (valeur: string) => void;
    const charger = vi.fn(() => new Promise<string>((resolve) => (fin = resolve)));

    const a = cache.memo('cle', 60, 600, charger);
    const b = cache.memo('cle', 60, 600, charger);
    fin('x');

    expect(await Promise.all([a, b])).toEqual(['x', 'x']);
    expect(charger).toHaveBeenCalledTimes(1);
  });

  it('sert la valeur périmée pendant la fenêtre stale et rafraîchit en arrière-plan', async () => {
    const h = horloge();
    const cache = creerCache({ maintenant: h.maintenant });
    const charger = vi.fn().mockResolvedValueOnce('ancien').mockResolvedValueOnce('nouveau');

    await cache.memo('cle', 60, 600, charger);
    h.avancer(120); // périmé, mais encore dans la fenêtre stale

    expect(await cache.memo('cle', 60, 600, charger)).toBe('ancien');
    await vi.waitFor(() => expect(charger).toHaveBeenCalledTimes(2));
    expect(await cache.memo('cle', 60, 600, charger)).toBe('nouveau');
    expect(charger).toHaveBeenCalledTimes(2);
  });

  it('ne lance qu\'un seul rafraîchissement pour plusieurs lectures périmées', async () => {
    const h = horloge();
    const cache = creerCache({ maintenant: h.maintenant });
    let fin!: (valeur: string) => void;
    const charger = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('ancien')
      .mockImplementationOnce(() => new Promise((resolve) => (fin = resolve)));

    await cache.memo('cle', 60, 600, charger);
    h.avancer(120);
    await Promise.all([cache.memo('cle', 60, 600, charger), cache.memo('cle', 60, 600, charger)]);
    fin('nouveau');

    expect(charger).toHaveBeenCalledTimes(2);
  });

  it('garde la valeur périmée quand le rafraîchissement échoue', async () => {
    const h = horloge();
    const cache = creerCache({ maintenant: h.maintenant });
    const charger = vi.fn().mockResolvedValueOnce('ancien').mockRejectedValue(new Error('source en panne'));

    await cache.memo('cle', 60, 600, charger);
    h.avancer(120);

    expect(await cache.memo('cle', 60, 600, charger)).toBe('ancien');
    await vi.waitFor(() => expect(charger).toHaveBeenCalledTimes(2));
    expect(await cache.memo('cle', 60, 600, charger)).toBe('ancien');
  });

  it('sert encore la valeur périmée quand la source est en erreur, même hors fenêtre stale', async () => {
    const h = horloge();
    const cache = creerCache({ maintenant: h.maintenant });
    const charger = vi.fn().mockResolvedValueOnce('ancien').mockRejectedValue(new Error('source en panne'));

    await cache.memo('cle', 60, 600, charger);
    h.avancer(10_000); // bien au-delà de ttl + stale

    expect(await cache.memo('cle', 60, 600, charger)).toBe('ancien');
  });

  it('attend le rechargement hors fenêtre stale quand la source répond', async () => {
    const h = horloge();
    const cache = creerCache({ maintenant: h.maintenant });
    const charger = vi.fn().mockResolvedValueOnce('ancien').mockResolvedValueOnce('nouveau');

    await cache.memo('cle', 60, 600, charger);
    h.avancer(10_000);

    expect(await cache.memo('cle', 60, 600, charger)).toBe('nouveau');
  });

  it("rejette sans valeur en cache et ne mémorise pas l'échec", async () => {
    const cache = creerCache();
    const charger = vi.fn().mockRejectedValueOnce(new Error('panne')).mockResolvedValueOnce('ok');

    await expect(cache.memo('cle', 60, 600, charger)).rejects.toThrow('panne');
    expect(await cache.memo('cle', 60, 600, charger)).toBe('ok');
  });

  it('isole les clés', async () => {
    const cache = creerCache();
    expect(await cache.memo('a', 60, 600, async () => 1)).toBe(1);
    expect(await cache.memo('b', 60, 600, async () => 2)).toBe(2);
  });

  it('évince l\'entrée la moins récemment utilisée au-delà de la taille', async () => {
    const cache = creerCache({ taille: 2 });
    const chargerA = vi.fn().mockResolvedValue('a');
    await cache.memo('a', 60, 600, chargerA);
    await cache.memo('b', 60, 600, async () => 'b');
    await cache.memo('a', 60, 600, chargerA); // « a » redevient la plus récente
    await cache.memo('c', 60, 600, async () => 'c'); // évince « b »

    await cache.memo('a', 60, 600, chargerA);
    expect(chargerA).toHaveBeenCalledTimes(1);

    const chargerB = vi.fn().mockResolvedValue('b2');
    expect(await cache.memo('b', 60, 600, chargerB)).toBe('b2');
  });

  it('garde 500 entrées par défaut', async () => {
    const cache = creerCache();
    const premier = vi.fn().mockResolvedValue(0);
    await cache.memo('0', 60, 600, premier);
    for (let i = 1; i <= 499; i++) await cache.memo(String(i), 60, 600, async () => i);
    await cache.memo('0', 60, 600, premier);
    expect(premier).toHaveBeenCalledTimes(1);
  });
});
