// Point d'entrée de la fonction Vercel : le serveur SSR construit par `npm run build` (voir vercel.json).
export { reqHandler as default } from '../dist/lois-votes/server/server.mjs';
