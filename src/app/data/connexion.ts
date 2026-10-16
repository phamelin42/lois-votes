/** Sous-ensemble de l'API Network Information (non typée dans lib.dom). */
interface InformationsConnexion {
  saveData?: boolean;
  effectiveType?: string;
}

function connexion(): InformationsConnexion | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: InformationsConnexion }).connection;
}

/** Vrai quand l'utilisateur demande d'économiser les données : on ne précharge rien. */
export function economiseDonnees(): boolean {
  return connexion()?.saveData === true;
}

/** Vrai sur une connexion trop lente pour précharger du code : économiseur de données ou 2g. */
export function connexionLimitee(): boolean {
  return economiseDonnees() || connexion()?.effectiveType === '2g';
}
