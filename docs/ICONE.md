# Icône du site

L'icône s'affiche dans l'onglet du navigateur, les favoris, l'écran d'accueil d'un téléphone et, si Google le décide, à côté du site dans ses résultats de recherche. Fichiers dans `public/` (copiés à la racine du build par `angular.json`).

## Le dessin

Une **carte arrondie** (le « fuda » de Fuda) couleur `sakura`, cernée d'un liseré `rim`, avec une **coche de vote** épaisse. Aucun trait fin, aucun texte : la coche reste lisible à 16 px. Le dessin porte son propre fond et son propre contour, donc il se lit aussi bien sur un onglet clair que sur un onglet sombre ; le SVG ne contient aucun `prefers-color-scheme`.

Source : `public/favicon.svg` (`viewBox` 64 × 64). Couleurs relevées dans `fuda/styles/tokens.css`, thème Jour :

| Rôle dans le dessin | Token Fuda | Valeur  |
| ------------------- | ---------- | ------- |
| Fond de la carte    | `sakura`   | #F5B1C5 |
| Liseré de la carte  | `rim`      | #5B5486 |
| Coche               | `on-sakura` | #3A3358 |
| Fond de l'icône iOS (opaque) | `surface` | #FDF8F8 |

`theme-color` (barre du navigateur sur mobile) et `theme_color` du manifeste valent `sakura` ; `background_color` du manifeste vaut `surface`. Les littéraux hexadécimaux sont admis dans ces fichiers statiques (le contrôle « aucune valeur en dur » ne porte que sur les `.scss`) ; si les tokens changent, mettre à jour ce tableau, le SVG, `index.html` et le manifeste, puis lancer `npm run icones`.

## Les fichiers

| Fichier                | Contenu                                                                                         | Déclaré par                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `favicon.svg`          | Le dessin vectoriel                                                                             | `<link rel="icon" type="image/svg+xml" sizes="any">`   |
| `favicon.ico`          | Trois PNG, 16, 32 et 48 px, dans un conteneur ICO                                               | `<link rel="icon" sizes="48x48">`                      |
| `icon-192.png`         | PNG 192 px                                                                                      | `<link rel="icon" sizes="192x192">` et manifeste       |
| `icon-512.png`         | PNG 512 px                                                                                      | manifeste                                              |
| `icon-48.png`          | PNG 48 px (le même que l'entrée 48 px de l'ICO)                                                 | aucune balise ; adresse directe                        |
| `apple-touch-icon.png` | PNG 180 px **opaque** : iOS remplit de noir ce qui est transparent. La carte occupe 78 % du côté sur le fond `surface` ; iOS arrondit lui-même les angles | `<link rel="apple-touch-icon">` |
| `site.webmanifest`     | Nom, nom court, `lang: fr`, couleurs, icônes 192 et 512 px et SVG                               | `<link rel="manifest">`                                |

Les PNG et l'ICO ont des angles transparents (sauf `apple-touch-icon.png`). Pas d'icône « maskable » : le dessin est une carte arrondie, pas un motif plein cadre, et une icône masquée la rognerait.

## Générer les fichiers

```
npm run icones
```

`scripts/icones.mjs` lit `public/favicon.svg`, le rastérise avec le Chromium de Playwright (déjà installé pour les tests e2e ; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/chrome` pour en désigner un autre) et écrit les PNG et l'ICO (conteneur écrit à la main : en-tête, répertoire, puis les PNG). **Les fichiers générés sont versionnés** : le build de Vercel ne génère rien. Le script est déterministe : deux exécutions de suite donnent les mêmes octets. Un autre Chromium peut rastériser avec de petites différences de pixels ; ce n'est pas un défaut, mais relire alors les images avant de les versionner.

`scripts/icones.spec.ts` contrôle l'en-tête et le répertoire de l'ICO, les signatures et dimensions des PNG, le manifeste (JSON valide, icônes qui existent à la taille annoncée) et les fichiers cités par `src/index.html`. `e2e/icones.spec.ts` contrôle le service : statut, `Content-Type`, `Cache-Control`, balises dans le HTML rendu sans JavaScript, CSP.

## Service et cache

Les fichiers de `public/` sont à la racine et **non hachés** : leur adresse doit rester stable (Google le demande pour le favicon) alors que leur contenu peut changer. Ils ne reçoivent donc **pas** le `Cache-Control: public, max-age=31536000, immutable` des fichiers du build, mais **`public, max-age=86400`** (un jour).

- Serveur Express (`src/server.ts`, `cacheControlFichier` dans `src/server/en-tetes.ts`) : `express.static` pose l'en-tête, puis `setHeaders` le remplace pour les fichiers de `FICHIERS_PUBLICS`. Ajouter un fichier dans `public/` exige de l'ajouter à cette liste (la spec le vérifie).
- Vercel (`vercel.json`) : un dossier `public/` est le dossier de sortie statique d'un projet sans framework ; Vercel sert donc ces fichiers **lui-même**, avant la réécriture `/(.*)` vers la fonction (le système de fichiers a priorité sur les réécritures). Le bloc `headers` de `vercel.json` leur donne le même `Cache-Control`. Les types viennent de l'extension du fichier. Ce comportement vient de la documentation de Vercel ; il n'a pas pu être exécuté depuis cet environnement, il se vérifie après le déploiement avec `curl -sI https://quiavotequoi.phamelin.fr/favicon.ico`.
- CSP : `img-src 'self'` et `default-src 'self'` (le manifeste) suffisent, rien à changer. `robots.txt` autorise tout, donc Googlebot et Googlebot-Image peuvent lire les icônes et la page d'accueil. Le plan du site ne change pas.

## Ce que demande Google

Page officielle, relue le 20/10/2026 (dernière mise à jour indiquée : 28/08/2026) : <https://developers.google.com/search/docs/appearance/favicon-in-search>.

- Une balise `<link>` dans l'en-tête de la **page d'accueil**, avec `rel="icon"` (ou `shortcut icon`, `apple-touch-icon`, `apple-touch-icon-precomposed`) et un `href` relatif ou absolu.
- Un seul favicon par site, un site étant défini par son nom d'hôte. La page d'accueil doit être celle du domaine (ou du sous-domaine), pas d'un sous-répertoire.
- **Googlebot-Image** doit pouvoir explorer le fichier du favicon et **Googlebot** la page d'accueil (rien ne doit les bloquer).
- Icône **carrée** (1:1) d'**au moins 8 × 8 px** ; la page recommande une icône **plus grande que 48 × 48 px**. Formats pris en charge : BMP, GIF, ICO, PNG, JPEG, PPM, TIFF. **Le SVG n'y figure pas** : c'est pourquoi le site déclare aussi un ICO (48 px) et un PNG (192 px) en plus du SVG, que les navigateurs préfèrent.
- Adresse du favicon **stable**, icône représentative du site, rien d'inapproprié.
- Le délai d'exploration va de quelques jours à plusieurs semaines. On peut demander l'indexation de la page d'accueil avec l'outil d'inspection d'URL de la Search Console.

**Ce qui n'est pas garanti** : Google précise qu'un favicon n'est pas garanti dans les résultats, même si tout est respecté. Le délai d'apparition n'est pas maîtrisable. Quelle icône Google retient quand plusieurs sont déclarées n'est pas documenté : ne pas promettre qu'il choisira l'ICO, le PNG ou le SVG. Aucune règle de la page ne parle de « multiples de 48 » : ne pas l'écrire.

## Après un changement d'icône

Les navigateurs gardent l'icône un jour (voir ci-dessus). Pour Google : garder les mêmes adresses, puis demander la réindexation de la page d'accueil dans la Search Console (voir le README).
