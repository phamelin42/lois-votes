#!/usr/bin/env node
// `npm run donnees` : télécharge les archives officielles de l'Assemblée nationale, les réduit et écrit `data/`.
// `DONNEES_DEPUIS=fixtures npm run donnees` lit à la place le mini-jeu `src/server/fixtures/officiel/`.
// Le script échoue (code 1) si la source est injoignable ou incohérente : l'ancien déploiement reste alors en ligne.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { construire, SEUILS_OFFICIELS } from './construire.mjs';
import { ecrireAtomique } from './ecrire.mjs';
import { lireActeur, lireOrgane, lireScrutin } from './lire.mjs';
import { estOrgane, ouvrirArchives } from './telecharger.mjs';
import { chargerWikipedia } from './wikipedia.mjs';

const texte = new TextDecoder();
const json = (octets) => JSON.parse(texte.decode(octets));

const secondes = (debut) => `${((performance.now() - debut) / 1000).toFixed(1)} s`;
const mo = (octets) => `${(octets / 1024 / 1024).toFixed(0)} Mo`;

/**
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {string} [options.destination] Dossier produit.
 * @param {string} [options.cache] Dossier de cache des archives.
 * @param {string} [options.fixtures]
 * @param {(message: string) => void} [options.journal]
 * @param {typeof fetch} [options.fetch]
 * @param {number[]} [options.pausesWikidata] Pauses entre deux essais de Wikidata (ms).
 * @param {Date} [options.maintenant]
 */
export async function executer({
  env = process.env,
  destination = 'data',
  cache = join('.cache', 'officiel'),
  fixtures = join('src', 'server', 'fixtures', 'officiel'),
  journal = console.log,
  fetch: requete,
  pausesWikidata,
  maintenant = new Date(),
} = {}) {
  const depuis = env['DONNEES_DEPUIS'] || 'officiel';
  const debut = performance.now();
  journal(`[donnees] source : ${depuis}`);

  const archives = await ouvrirArchives({
    depuis,
    cache,
    fixtures,
    fetch: requete,
    journal: (m) => journal(`[donnees] ${m}`),
  });
  journal(`[donnees] archives prêtes en ${secondes(debut)}`);

  // Les liens Wikipédia (Wikidata, source facultative) se cherchent pendant la lecture des archives.
  const wikipedia = chargerWikipedia({
    depuis,
    fixtures,
    fetch: requete,
    pauses: pausesWikidata,
    journal: (m) => journal(`[donnees] ${m}`),
  });

  const lecture = performance.now();
  const scrutins = [];
  for (const [nom, octets] of archives.scrutins()) {
    try {
      scrutins.push(lireScrutin(json(octets)));
    } catch (erreur) {
      throw new Error(`${nom} : ${erreur.message}`, { cause: erreur });
    }
  }
  const acteurs = [];
  const organes = [];
  for (const [nom, octets] of archives.acteurs()) {
    try {
      if (estOrgane(nom)) organes.push(lireOrgane(json(octets)));
      else acteurs.push(lireActeur(json(octets)));
    } catch (erreur) {
      throw new Error(`${nom} : ${erreur.message}`, { cause: erreur });
    }
  }
  journal(
    `[donnees] lu : ${scrutins.length} scrutins, ${acteurs.length} acteurs, ${organes.length} organes en ${secondes(lecture)}`,
  );

  const { liens: liensWikipedia, avertissements } = await wikipedia;

  // Le mini-jeu de fixtures est petit par construction : les seuils du plan ne s'y appliquent pas.
  const seuils = depuis === 'fixtures' ? { scrutins: 1, deputes: 1 } : SEUILS_OFFICIELS;
  const reduction = performance.now();
  const { donnees, fichiers } = construire({
    scrutins,
    acteurs,
    organes,
    sources: archives.sources,
    wikipedia: liensWikipedia,
    avertissements,
    maintenant,
    seuils,
  });
  journal(`[donnees] réduit en ${secondes(reduction)}`);

  ecrireAtomique(destination, fichiers);
  const { meta } = donnees;
  const stat = meta.statistiques;
  journal(
    `[donnees] ${destination}/ écrit : ${meta.scrutins} scrutins (${stat.adoptes} adoptés, ${stat.rejetes} rejetés), ` +
      `${meta.deputes} députés, ${meta.groupes} groupes ; ${stat.sansDossier} scrutins sans dossier, ` +
      `${stat.misesAuPoint} avec mise au point, ${stat.groupesRattaches} entrées de groupe rattachées` +
      (stat.nonVotantsCorriges.length
        ? `, non-votants corrigés : scrutin(s) ${stat.nonVotantsCorriges.join(', ')}`
        : ''),
  );
  for (const [qui, c] of Object.entries(stat.couverture)) {
    const part = (n) => `${n} (${c.deputes ? Math.round((n * 100) / c.deputes) : 0} %)`;
    journal(
      `[donnees] couverture, ${qui === 'actifs' ? 'députés en mandat' : 'tous les députés'} (${c.deputes}) : ` +
        `Wikipédia ${part(c.wikipedia)}, HATVP ${part(c.hatvp)}, profession ${part(c.profession)}, ` +
        `naissance ${part(c.naissance)}, site ${part(c.siteWeb)}, X ${part(c.x)}, Facebook ${part(c.facebook)}`,
    );
  }
  if (meta.avertissements.length)
    journal(`[donnees] avertissements : ${meta.avertissements.join(', ')}`);
  journal(
    `[donnees] terminé en ${secondes(debut)} (mémoire maximale ${mo(process.resourceUsage().maxRSS * 1024)})`,
  );
  return donnees;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executer().catch((erreur) => {
    console.error(`[donnees] ÉCHEC : ${erreur.message}`);
    if (erreur.cause && erreur.cause !== erreur)
      console.error(`[donnees] cause : ${erreur.cause.message ?? erreur.cause}`);
    process.exit(1);
  });
}
