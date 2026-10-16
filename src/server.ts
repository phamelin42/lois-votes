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

// BFF : /api/* sert les fixtures du BFF factice si MOCK_BFF=1 (délai simulé de 150 ms).
// Le vrai BFF (prompt 02) remplacera cette branche ; sans MOCK_BFF, l'API n'est pas encore disponible.
app.use('/api', async (req, res) => {
  if (process.env['MOCK_BFF'] === '1') {
    const reponse = await appelerMock(req.originalUrl);
    res.status(reponse.status).set(reponse.headers).json(reponse.body);
    return;
  }
  res
    .status(503)
    .set({ 'retry-after': '60', 'cache-control': 'no-store' })
    .json({ erreur: 'API indisponible' });
});

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
