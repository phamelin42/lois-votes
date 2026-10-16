export interface OptionsCache {
  /** Nombre d'entrées gardées ; la moins récemment utilisée sort la première. */
  taille?: number;
  /** Horloge en millisecondes (injectable pour les tests). */
  maintenant?: () => number;
}

export interface Cache {
  /**
   * Renvoie la valeur en cache si elle est fraîche (`ttl`, en secondes). Pendant la fenêtre `stale`, elle
   * est servie et rafraîchie en arrière-plan. Au-delà, ou sans valeur, `charger` est appelé ; si cela
   * échoue, la valeur périmée reste servie. Les échecs ne sont jamais mémorisés.
   */
  memo<T>(cle: string, ttl: number, stale: number, charger: () => Promise<T>): Promise<T>;
}

interface Entree {
  valeur: unknown;
  /** Fin de la fraîcheur, en ms. */
  fraiche: number;
  /** Fin de la fenêtre stale, en ms. */
  perimee: number;
}

export function creerCache({
  taille = 500,
  maintenant = () => Date.now(),
}: OptionsCache = {}): Cache {
  const entrees = new Map<string, Entree>();
  /** Chargements en cours, par clé : les appels simultanés les partagent. */
  const enVol = new Map<string, Promise<unknown>>();

  function memoriser(cle: string, valeur: unknown, ttl: number, stale: number): void {
    const instant = maintenant();
    entrees.delete(cle);
    entrees.set(cle, {
      valeur,
      fraiche: instant + ttl * 1000,
      perimee: instant + (ttl + stale) * 1000,
    });
    while (entrees.size > taille) {
      const plusAncienne = entrees.keys().next().value;
      if (plusAncienne === undefined) break;
      entrees.delete(plusAncienne);
    }
  }

  function lancer<T>(
    cle: string,
    ttl: number,
    stale: number,
    charger: () => Promise<T>,
  ): Promise<T> {
    const enCoursPourCle = enVol.get(cle);
    if (enCoursPourCle) return enCoursPourCle as Promise<T>;
    let chargement: Promise<T>;
    try {
      chargement = Promise.resolve(charger());
    } catch (erreur) {
      chargement = Promise.reject(erreur);
    }
    const promesse = chargement.then((valeur) => {
      memoriser(cle, valeur, ttl, stale);
      return valeur;
    });
    enVol.set(cle, promesse);
    const oublier = () => {
      if (enVol.get(cle) === promesse) enVol.delete(cle);
    };
    promesse.then(oublier, oublier);
    return promesse;
  }

  return {
    memo<T>(cle: string, ttl: number, stale: number, charger: () => Promise<T>): Promise<T> {
      const entree = entrees.get(cle);
      if (entree) {
        // Une lecture rend la clé la plus récente.
        entrees.delete(cle);
        entrees.set(cle, entree);
      }
      const instant = maintenant();
      if (entree && instant < entree.fraiche) return Promise.resolve(entree.valeur as T);
      if (entree && instant < entree.perimee) {
        lancer(cle, ttl, stale, charger).catch(() => undefined);
        return Promise.resolve(entree.valeur as T);
      }
      const chargement = lancer(cle, ttl, stale, charger);
      return entree ? chargement.catch(() => entree.valeur as T) : chargement;
    },
  };
}
