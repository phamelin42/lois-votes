const RACINE_PHOTOS = 'https://www.assemblee-nationale.fr/dyn/static/tribun/17/photos/carre';

/**
 * Photo officielle d'un député (carrée), à partir de son numéro d'acteur (`DeputeIndex.pa`, sans préfixe « PA »).
 * Le fichier porte le numéro seul : avec le préfixe (`PA720468.jpg`), le site de l'Assemblée répond 404, donc un
 * préfixe reçu par erreur est retiré. Partagé par le serveur (`DeputeDetail.photo`) et par l'application (liste).
 */
export function photoDe(pa: string): string {
  return `${RACINE_PHOTOS}/${pa.replace(/^PA/, '')}.jpg`;
}
