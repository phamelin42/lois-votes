// Le classement des scrutins par titre, le titre court et la lecture sont partagés avec le script
// `scripts/donnees/` : ils vivent dans `src/shared/classer.ts`, que le serveur réexporte ici.
export { classer, classerTous, lecture, titreCourt } from '../shared/classer';
