/** Réponse de la source qui demande de ralentir (429 ou 503), avec le délai de Retry-After s'il est connu. */
export class ErreurDebit extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSecondes?: number,
  ) {
    super(`La source limite le débit (HTTP ${status})`);
    this.name = 'ErreurDebit';
  }
}

export interface OptionsLimiteur {
  /** Requêtes en cours au maximum. */
  maxSimultanees?: number;
  /** Démarrages au maximum sur une fenêtre glissante d'une seconde. */
  maxParSeconde?: number;
}

export interface Limiteur {
  /**
   * Exécute `tache` sous les limites. Deux appels simultanés avec la même `cle` partagent une seule
   * exécution. Une ErreurDebit déclenche un unique nouvel essai après Retry-After (2 s par défaut).
   */
  executer<T>(cle: string, tache: () => Promise<T>): Promise<T>;
}

const FENETRE_MS = 1000;
const DELAI_REPRISE_PAR_DEFAUT_S = 2;
/** Plafond de l'attente demandée par la source, pour ne pas bloquer une requête indéfiniment. */
const DELAI_REPRISE_MAX_MS = 10_000;

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function creerLimiteur({
  maxSimultanees = 4,
  maxParSeconde = 10,
}: OptionsLimiteur = {}): Limiteur {
  let enCours = 0;
  const enAttente: (() => void)[] = [];
  const departs: number[] = [];
  const enVol = new Map<string, Promise<unknown>>();

  async function obtenirPlace(): Promise<void> {
    if (enCours < maxSimultanees) {
      enCours++;
    } else {
      // La place est transmise directement par libererPlace : enCours ne change pas.
      await new Promise<void>((resolve) => enAttente.push(resolve));
    }
    for (;;) {
      const maintenant = Date.now();
      while (departs.length > 0 && departs[0] <= maintenant - FENETRE_MS) departs.shift();
      if (departs.length < maxParSeconde) {
        departs.push(maintenant);
        return;
      }
      await attendre(departs[0] + FENETRE_MS - maintenant);
    }
  }

  function libererPlace(): void {
    const suivant = enAttente.shift();
    if (suivant) suivant();
    else enCours--;
  }

  async function unEssai<T>(tache: () => Promise<T>): Promise<T> {
    await obtenirPlace();
    try {
      return await tache();
    } finally {
      libererPlace();
    }
  }

  async function essayer<T>(tache: () => Promise<T>): Promise<T> {
    try {
      return await unEssai(tache);
    } catch (erreur) {
      if (!(erreur instanceof ErreurDebit)) throw erreur;
      const attente = (erreur.retryAfterSecondes ?? DELAI_REPRISE_PAR_DEFAUT_S) * 1000;
      await attendre(Math.min(attente, DELAI_REPRISE_MAX_MS));
      return unEssai(tache);
    }
  }

  return {
    executer<T>(cle: string, tache: () => Promise<T>): Promise<T> {
      const enCoursPourCle = enVol.get(cle);
      if (enCoursPourCle) return enCoursPourCle as Promise<T>;
      const promesse = essayer(tache);
      enVol.set(cle, promesse);
      const oublier = () => {
        if (enVol.get(cle) === promesse) enVol.delete(cle);
      };
      promesse.then(oublier, oublier);
      return promesse;
    },
  };
}
