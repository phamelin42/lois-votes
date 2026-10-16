import { creerLimiteur, ErreurDebit } from './limiter';

const attente = () => {
  let fin!: (valeur?: unknown) => void;
  const promesse = new Promise((resolve) => (fin = resolve));
  return { promesse, fin };
};

describe('limiteur de requêtes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exécute une tâche et renvoie son résultat', async () => {
    const limiteur = creerLimiteur();
    await expect(limiteur.executer('a', async () => 42)).resolves.toBe(42);
  });

  it('limite à 4 tâches simultanées par défaut', async () => {
    const limiteur = creerLimiteur({ maxParSeconde: 1000 });
    let enCours = 0;
    let max = 0;
    const portes = Array.from({ length: 10 }, attente);
    const resultats = portes.map((porte, i) =>
      limiteur.executer(`cle-${i}`, async () => {
        enCours++;
        max = Math.max(max, enCours);
        await porte.promesse;
        enCours--;
      }),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(enCours).toBe(4);
    for (const porte of portes) {
      porte.fin();
      await vi.advanceTimersByTimeAsync(0);
    }
    await Promise.all(resultats);
    expect(max).toBe(4);
  });

  it('respecte maxSimultanees quand on le change', async () => {
    const limiteur = creerLimiteur({ maxSimultanees: 2, maxParSeconde: 1000 });
    let enCours = 0;
    let max = 0;
    const portes = Array.from({ length: 6 }, attente);
    const resultats = portes.map((porte, i) =>
      limiteur.executer(`cle-${i}`, async () => {
        enCours++;
        max = Math.max(max, enCours);
        await porte.promesse;
        enCours--;
      }),
    );
    for (const porte of portes) {
      await vi.advanceTimersByTimeAsync(0);
      porte.fin();
    }
    await Promise.all(resultats);
    expect(max).toBe(2);
  });

  it('démarre au plus 10 tâches par seconde par défaut', async () => {
    const limiteur = creerLimiteur({ maxSimultanees: 100 });
    const departs: number[] = [];
    const resultats = Array.from({ length: 25 }, (_, i) =>
      limiteur.executer(`cle-${i}`, async () => {
        departs.push(Date.now());
      }),
    );

    await vi.advanceTimersByTimeAsync(3000);
    await Promise.all(resultats);

    expect(departs).toHaveLength(25);
    for (const depart of departs) {
      const dansLaSeconde = departs.filter((d) => d >= depart && d < depart + 1000).length;
      expect(dansLaSeconde).toBeLessThanOrEqual(10);
    }
  });

  it('fusionne les tâches identiques en vol', async () => {
    const limiteur = creerLimiteur();
    const porte = attente();
    const tache = vi.fn(async () => {
      await porte.promesse;
      return 'résultat';
    });

    const a = limiteur.executer('meme-cle', tache);
    const b = limiteur.executer('meme-cle', tache);
    await vi.advanceTimersByTimeAsync(0);
    porte.fin();

    expect(await Promise.all([a, b])).toEqual(['résultat', 'résultat']);
    expect(tache).toHaveBeenCalledTimes(1);
  });

  it('relance une tâche déjà terminée', async () => {
    const limiteur = creerLimiteur();
    const tache = vi.fn(async () => 'x');
    await limiteur.executer('cle', tache);
    await limiteur.executer('cle', tache);
    expect(tache).toHaveBeenCalledTimes(2);
  });

  it('réessaie une fois après Retry-After sur une ErreurDebit', async () => {
    const limiteur = creerLimiteur();
    const tache = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ErreurDebit(429, 3))
      .mockResolvedValueOnce('ok');

    const resultat = limiteur.executer('cle', tache);
    await vi.advanceTimersByTimeAsync(2900);
    expect(tache).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);

    await expect(resultat).resolves.toBe('ok');
    expect(tache).toHaveBeenCalledTimes(2);
  });

  it('attend 2 secondes sans Retry-After', async () => {
    const limiteur = creerLimiteur();
    const tache = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ErreurDebit(503))
      .mockResolvedValueOnce('ok');

    const resultat = limiteur.executer('cle', tache);
    await vi.advanceTimersByTimeAsync(1900);
    expect(tache).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);

    await expect(resultat).resolves.toBe('ok');
  });

  it('ne réessaie qu\'une seule fois', async () => {
    const limiteur = creerLimiteur();
    const tache = vi.fn<() => Promise<string>>().mockRejectedValue(new ErreurDebit(429, 1));

    const resultat = limiteur.executer('cle', tache);
    const verification = expect(resultat).rejects.toBeInstanceOf(ErreurDebit);
    await vi.advanceTimersByTimeAsync(5000);

    await verification;
    expect(tache).toHaveBeenCalledTimes(2);
  });

  it('ne réessaie pas les autres erreurs', async () => {
    const limiteur = creerLimiteur();
    const tache = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('réseau'));

    await expect(limiteur.executer('cle', tache)).rejects.toThrow('réseau');
    expect(tache).toHaveBeenCalledTimes(1);
  });

  it('libère la place d\'une tâche en erreur', async () => {
    const limiteur = creerLimiteur({ maxSimultanees: 1, maxParSeconde: 1000 });
    await expect(limiteur.executer('a', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(limiteur.executer('b', async () => 'ok')).resolves.toBe('ok');
  });
});
