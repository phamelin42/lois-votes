import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { appelerMock } from './server/mock-bff';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Routes /api/* (BFF).
 * - `MOCK_BFF=1` : fixtures de src/server/fixtures/bff/ avec un délai de 150 ms.
 * - sinon : le vrai BFF (prompt 02) n'est pas encore branché, la route répond 503.
 */
if (process.env['MOCK_BFF'] === '1') {
  app.get('/api/{*splat}', async (req, res) => {
    const reponse = await appelerMock(req.originalUrl);
    res.status(reponse.statut).set(reponse.entetes).json(reponse.corps);
  });
} else {
  app.use('/api', (_req, res) => {
    res
      .status(503)
      .set({ 'Retry-After': '60', 'Cache-Control': 'no-store' })
      .json({ erreur: 'BFF indisponible : lancer le serveur avec MOCK_BFF=1.' });
  });
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
