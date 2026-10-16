import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import type { DeputeListe } from '@contrat';
import { appelerBffActif } from './server/bff';
import { cacheControlPage, enTetesSecurite, extraireScriptsEnLigne } from './server/en-tetes';
import { creerCache } from './server/cache';
import { genererRobots, genererSitemap } from './server/seo';
import { injecterUmami, scriptUmami, sourceUmami } from './server/umami';

const browserDistFolder = join(import.meta.dirname, '../browser');
const ADRESSE_DU_SITE = 'https://quiavotequi.phamelin.fr';

const umamiActif = scriptUmami(process.env) !== '';

const app = express();
const angularApp = new AngularNodeAppEngine();
const sitemap = creerCache();

// Compression des réponses texte (HTML, JSON, JS, CSS). Vercel compresse aussi à son CDN ; ailleurs, c'est le serveur.
app.use(compression());

// En-têtes de sécurité sur toutes les réponses (les pages HTML reçoivent en plus leur propre CSP, voir finaliserPage).
const entetesSecurite = enTetesSecurite({ umamiSrc: sourceUmami(process.env) ?? undefined });
app.use((_req, res, suivant) => {
  res.set(entetesSecurite);
  suivant();
});

// BFF : /api/* interroge l'API tabulaire de data.gouv.fr (src/server/bff.ts), ou les fixtures avec MOCK_BFF=1.
app.use('/api', async (req, res, suivant) => {
  try {
    const reponse = await appelerBffActif(req.originalUrl);
    res.status(reponse.status).set(reponse.headers).json(reponse.body);
  } catch (erreur) {
    suivant(erreur);
  }
});

/**
 * Fichiers du build (noms hachés) : gardés un an par le navigateur et le CDN.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    immutable: true,
    index: false,
    redirect: false,
  }),
);

app.get('/robots.txt', (_req, res) => {
  res
    .type('text/plain')
    .set('Cache-Control', 'public, max-age=86400')
    .send(genererRobots(ADRESSE_DU_SITE));
});

/** Lois récentes et index des députés, en une requête au BFF, gardés un jour. */
async function construireSitemap(): Promise<string> {
  const reponse = await appelerBffActif('/api/deputes');
  if (reponse.status !== 200) throw new Error(`BFF : statut ${reponse.status} pour le sitemap`);
  const liste = reponse.body as DeputeListe;
  return genererSitemap(ADRESSE_DU_SITE, { lois: liste.loisRecentes, deputes: liste.deputes });
}

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const xml = await sitemap.memo('sitemap', 86400, 86400, construireSitemap);
    res
      .type('application/xml')
      .set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
      .send(xml);
  } catch {
    res
      .status(503)
      .set({ 'Cache-Control': 'no-store', 'Retry-After': '60' })
      .json({ erreur: 'Plan du site indisponible' });
  }
});

/**
 * Rendu d'une page HTML. Les scripts en ligne d'Angular (événements rejoués, critical CSS) changent d'une page à
 * l'autre : la CSP autorise donc, pour chaque page, l'empreinte des scripts qu'elle contient. Le script Umami
 * est ajouté dans le <head> quand la mesure est configurée. Le Cache-Control suit le statut.
 */
async function finaliserPage(reponse: Response): Promise<Response> {
  const entetes = new Headers(reponse.headers);
  entetes.set('Cache-Control', cacheControlPage(reponse.status));
  if (!entetes.get('content-type')?.includes('text/html')) {
    return new Response(reponse.body, {
      status: reponse.status,
      statusText: reponse.statusText,
      headers: entetes,
    });
  }
  const html = await reponse.text();
  const securite = enTetesSecurite({
    scriptsEnLigne: extraireScriptsEnLigne(html),
    umamiSrc: sourceUmami(process.env) ?? undefined,
  });
  for (const [nom, valeur] of Object.entries(securite)) entetes.set(nom, valeur);
  entetes.delete('content-length');
  const rendu = umamiActif ? injecterUmami(html, process.env) : html;
  return new Response(rendu, {
    status: reponse.status,
    statusText: reponse.statusText,
    headers: entetes,
  });
}

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) =>
      response ? writeResponseToNodeResponse(await finaliserPage(response), res) : next(),
    )
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
