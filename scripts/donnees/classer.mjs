// Classement des scrutins par titre. La logique vit dans src/shared/classer.ts, partagée avec le serveur
// (`src/server/classify.ts` la réexporte) : un seul classement pour le script et pour l'application.
// Node exécute ce fichier TypeScript tel quel (Node ≥ 22.18 : types effacés, pas de transformation).
export { classer, classerTous, lecture, normaliser, titreCourt } from '../../src/shared/classer.ts';
