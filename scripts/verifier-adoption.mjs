#!/usr/bin/env node
// Vérifie la règle d'adoption de « Qui a voté quoi ? » contre le champ officiel `sort.code`.
//
// Règle testée (voir docs/PLAN.md « Constats » §1 et docs/API.md) :
//   - cas général : adopté si pour > contre ;
//   - motion de censure : adoptée seulement si pour >= 289 (majorité absolue des membres).
//
// Entrées (aucune clé API, aucune dépendance) :
//   - décomptes : l'API tabulaire de data.gouv.fr (ressource « Scrutins AN » de NosParlementaires)
//     ou, avec --source=export, l'export public https://nosparlementaires.fr/opendata/scrutins_an.json ;
//   - vérité : l'archive officielle Scrutins.json.zip de l'Assemblée nationale, lue sans bibliothèque
//     (lecture du répertoire central du zip + node:zlib). Utilisée pour ce contrôle seulement.
//
// Usage :
//   node scripts/verifier-adoption.mjs [--source=tabulaire|export] [--officiel=<chemin ou URL>]
//        [--min=200] [--rid=<rid>] [--base=<URL de l'API tabulaire>] [--sortie=<fichier.json>]
//
// Code de sortie : 0 si au moins --min scrutins sont comparés, toutes les motions de censure
// comprises, et si le taux d'accord vaut 100 % ; 1 sinon (le détail des exceptions est affiché) ; 2 en cas d'erreur d'accès.
// Derrière un proxy d'entreprise : NODE_USE_ENV_PROXY=1 (Node ≥ 22.21) et NODE_EXTRA_CA_CERTS.

import fs from 'node:fs';
import zlib from 'node:zlib';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
  }),
);
const SOURCE = args.source ?? 'tabulaire';
const OFFICIEL =
  args.officiel ??
  'https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip';
const MIN = Number(args.min ?? 200);
const BASE = (args.base ?? 'https://tabular-api.data.gouv.fr/api').replace(/\/$/, '');
const RID_SCRUTINS = args.rid ?? '341c15dc-0cc3-4bcf-8954-8f4b519b7a4d';
const EXPORT_URL = 'https://nosparlementaires.fr/opendata/scrutins_an.json';
const SEUIL_MOTION = 289;
const PAUSE_MS = 250; // au plus 4 requêtes par seconde vers l'API tabulaire

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET avec nouveaux essais espacés de 2, 4, 8 puis 16 s (coupures de connexion intermittentes). */
async function obtenir(url) {
  let derniere;
  for (let i = 0; i < 5; i++) {
    if (i > 0) await dormir(2000 * 2 ** (i - 1));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (res.status === 429 || res.status >= 500) {
        derniere = new Error(`HTTP ${res.status}`);
        const apres = Number(res.headers.get('retry-after'));
        if (apres > 0) await dormir(apres * 1000);
        continue;
      }
      if (!res.ok)
        throw Object.assign(new Error(`HTTP ${res.status} pour ${url}`), { definitif: true });
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (e.definitif) throw e;
      derniere = e;
    }
  }
  throw new Error(`échec après 5 essais : ${url} (${derniere?.cause?.code ?? derniere?.message})`);
}

async function lireFichierOuUrl(source) {
  return /^https?:\/\//.test(source) ? obtenir(source) : fs.readFileSync(source);
}

/** Décomptes depuis l'API tabulaire : pages de 200 (maximum de l'API), triées par date décroissante. */
async function scrutinsTabulaire() {
  const lignes = [];
  for (let page = 1; ; page++) {
    const corps = JSON.parse(
      (
        await obtenir(`${BASE}/resources/${RID_SCRUTINS}/data/?page=${page}&page_size=200`)
      ).toString('utf8'),
    );
    lignes.push(...corps.data);
    if (lignes.length >= corps.meta.total || corps.data.length === 0) break;
    await dormir(PAUSE_MS);
  }
  return lignes;
}

async function scrutinsExport() {
  return JSON.parse((await obtenir(EXPORT_URL)).toString('utf8'));
}

/** Lit toutes les entrées .json d'un zip (méthodes stored ou deflate), sans bibliothèque. */
function* entreesZip(tampon) {
  let eocd = -1;
  for (let i = tampon.length - 22; i >= Math.max(0, tampon.length - 65_557); i--) {
    if (tampon.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('archive zip invalide (fin de répertoire introuvable)');
  const nombre = tampon.readUInt16LE(eocd + 10);
  let p = tampon.readUInt32LE(eocd + 16);
  for (let n = 0; n < nombre; n++) {
    if (tampon.readUInt32LE(p) !== 0x02014b50)
      throw new Error('archive zip invalide (entrée du répertoire)');
    const methode = tampon.readUInt16LE(p + 10);
    const taille = tampon.readUInt32LE(p + 20);
    const longNom = tampon.readUInt16LE(p + 28);
    const longExtra = tampon.readUInt16LE(p + 30);
    const longCom = tampon.readUInt16LE(p + 32);
    const local = tampon.readUInt32LE(p + 42);
    const nom = tampon.toString('utf8', p + 46, p + 46 + longNom);
    p += 46 + longNom + longExtra + longCom;
    if (!nom.endsWith('.json')) continue;
    const debut = local + 30 + tampon.readUInt16LE(local + 26) + tampon.readUInt16LE(local + 28);
    const brut = tampon.subarray(debut, debut + taille);
    yield { nom, contenu: methode === 0 ? brut : zlib.inflateRawSync(brut) };
  }
}

function officiel(tampon) {
  const parId = new Map();
  for (const { contenu } of entreesZip(tampon)) {
    const s = JSON.parse(contenu.toString('utf8')).scrutin;
    parId.set(s.uid, { code: s.sort.code, type: s.typeVote.codeTypeVote });
  }
  return parId;
}

/** La règle testée. `motion` vient du titre (le site ne dispose pas du type de vote officiel). */
function estMotion(titre) {
  return /^la motion de censure/i.test(titre.trim());
}
function adopteCalcule(ligne) {
  return estMotion(ligne.title) ? ligne.pour >= SEUIL_MOTION : ligne.pour > ligne.contre;
}

async function main() {
  console.log(
    `Source des décomptes : ${SOURCE}${SOURCE === 'tabulaire' ? ` (${BASE}, rid ${RID_SCRUTINS})` : ` (${EXPORT_URL})`}`,
  );
  console.log(`Vérité officielle : ${OFFICIEL}`);
  const [lignes, tampon] = await Promise.all([
    SOURCE === 'export' ? scrutinsExport() : scrutinsTabulaire(),
    lireFichierOuUrl(OFFICIEL),
  ]);
  const vrai = officiel(tampon);
  console.log(`Scrutins reçus : ${lignes.length} ; scrutins officiels : ${vrai.size}`);

  let compares = 0,
    accords = 0,
    sansOfficiel = 0;
  const motions = { comparees: 0, accord: 0 };
  const exceptions = [];
  for (const l of lignes) {
    const o = vrai.get(l.id);
    if (!o) {
      sansOfficiel++;
      continue;
    }
    compares++;
    const calcule = adopteCalcule(l);
    const attendu = o.code === 'adopté';
    const motion = estMotion(l.title);
    if (motion) motions.comparees++;
    if (calcule === attendu) {
      accords++;
      if (motion) motions.accord++;
    } else {
      exceptions.push({
        id: l.id,
        date: String(l.date).slice(0, 10),
        motion,
        typeOfficiel: o.type,
        pour: l.pour,
        contre: l.contre,
        abstention: l.abstention,
        calcule: calcule ? 'adopté' : 'rejeté',
        officiel: o.code,
        titre: l.title.slice(0, 110),
      });
    }
  }
  // Cohérence du repérage des motions avec le type de vote officiel (MOC).
  const motionsOfficielles = [...vrai.values()].filter((v) => v.type === 'MOC').length;
  const taux = compares ? (100 * accords) / compares : 0;
  console.log(`\nComparés : ${compares} (sans équivalent officiel : ${sansOfficiel})`);
  console.log(`Accord : ${accords}/${compares} = ${taux.toFixed(2)} %`);
  console.log(
    `Motions de censure : ${motions.accord}/${motions.comparees} en accord (type officiel MOC : ${motionsOfficielles})`,
  );
  console.log(`Exceptions : ${exceptions.length}`);
  for (const e of exceptions)
    console.log(
      `  ${e.id} ${e.date} pour=${e.pour} contre=${e.contre} abst=${e.abstention} calcule=${e.calcule} officiel=${e.officiel} (${e.typeOfficiel}) ${e.titre}`,
    );
  if (args.sortie)
    fs.writeFileSync(
      args.sortie,
      JSON.stringify({ compares, accords, taux, motions, motionsOfficielles, exceptions }, null, 2),
    );

  const ok = compares >= MIN && motions.comparees === motionsOfficielles && exceptions.length === 0;
  if (compares < MIN) console.log(`\nÉCHEC : moins de ${MIN} scrutins comparés.`);
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => {
  console.error(`Erreur : ${e.message}`);
  process.exitCode = 2;
});
