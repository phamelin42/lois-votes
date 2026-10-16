/** Mesure d'audience Umami, sans cookie. Active seulement si `UMAMI_WEBSITE_ID` est défini à l'exécution. */

const SRC_PAR_DEFAUT = 'https://cloud.umami.is/script.js';

type Environnement = Record<string, string | undefined>;

const ECHAPPEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const echapper = (valeur: string): string => valeur.replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c]);

/** Adresse du script Umami si la mesure est configurée et que l'adresse est en https ; sinon null. */
export function sourceUmami(env: Environnement): string | null {
  const identifiant = env['UMAMI_WEBSITE_ID'];
  if (!identifiant) return null;
  const src = env['UMAMI_SRC'] || SRC_PAR_DEFAUT;
  return src.startsWith('https://') ? src : null;
}

/** Balise `<script>` de Umami, ou chaîne vide quand la mesure n'est pas configurée. */
export function scriptUmami(env: Environnement): string {
  const src = sourceUmami(env);
  if (src === null) return '';
  const identifiant = env['UMAMI_WEBSITE_ID'] ?? '';
  return `<script defer src="${echapper(src)}" data-website-id="${echapper(identifiant)}"></script>`;
}

/** Ajoute le script juste avant `</head>`, une seule fois. Sans configuration, la page est rendue telle quelle. */
export function injecterUmami(html: string, env: Environnement): string {
  const script = scriptUmami(env);
  if (script === '' || html.includes(script)) return html;
  return html.replace('</head>', `${script}</head>`);
}
