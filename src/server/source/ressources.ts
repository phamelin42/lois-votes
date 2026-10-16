/**
 * Identifiants (rid) des fichiers de data.gouv.fr utilisés par le BFF.
 *
 * ⚠ Les valeurs par défaut sont PROVISOIRES : les vrais rid n'ont pas pu être relevés (data.gouv.fr
 * injoignable pendant le prompt 00). Elles sont identiques aux identifiants du faux serveur de test
 * (testing/univers.mjs), ce qui fait que les specs de routes passent sans configuration. Sur la vraie source,
 * elles ne correspondent à aucune ressource : chaque appel répond 404 et le BFF 503 tant qu'on ne les surcharge
 * pas par RID_SCRUTINS, RID_VOTES, RID_DEPUTES, RID_DATAN_DEPUTES, RID_DATAN_GROUPES.
 * Pour les confirmer : exécuter le prompt 00 (réseau data.gouv.fr), puis reporter les rid dans docs/API.md.
 */
export interface Rids {
  scrutins: string;
  votes: string;
  deputes: string;
  datanDeputes: string;
  datanGroupes: string;
}

const DEFAUTS: Rids = {
  scrutins: 'rid-scrutins',
  votes: 'rid-votes',
  deputes: 'rid-deputes',
  datanDeputes: 'rid-datan-deputes',
  datanGroupes: 'rid-datan-groupes',
};

const VARIABLES: Record<keyof Rids, string> = {
  scrutins: 'RID_SCRUTINS',
  votes: 'RID_VOTES',
  deputes: 'RID_DEPUTES',
  datanDeputes: 'RID_DATAN_DEPUTES',
  datanGroupes: 'RID_DATAN_GROUPES',
};

/** Lit les rid dans l'environnement ; une variable vide ou absente garde la valeur par défaut. */
export function lireRessources(env: Record<string, string | undefined>): Rids {
  const rids = { ...DEFAUTS };
  for (const cle of Object.keys(VARIABLES) as (keyof Rids)[]) {
    rids[cle] = env[VARIABLES[cle]] || DEFAUTS[cle];
  }
  return rids;
}
