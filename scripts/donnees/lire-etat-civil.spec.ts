// @vitest-environment node
import {
  chaine,
  dateIso,
  lireFacebook,
  lireHatvp,
  lireLiensWeb,
  lireNaissance,
  lireProfession,
  lireSiteWeb,
  lireX,
} from './lire.mjs';

// Un champ vide de l'archive n'est pas `null` : c'est un objet `{ "@xsi:nil": "true" }`.
const NIL = { '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance', '@xsi:nil': 'true' };

describe('chaine', () => {
  it("ne garde que du texte : l'archive écrit un champ vide { @xsi:nil } et pas null", () => {
    expect(chaine('Beauvais')).toBe('Beauvais');
    expect(chaine('  Beauvais ')).toBe('Beauvais');
    expect(chaine(NIL)).toBeNull();
    expect(chaine(null)).toBeNull();
    expect(chaine(undefined)).toBeNull();
    expect(chaine('   ')).toBeNull();
    expect(chaine(42)).toBeNull();
  });

  it("lit le texte d'un élément qui porte des attributs", () => {
    expect(chaine({ '@xsi:type': 'x', '#text': 'PO1' })).toBe('PO1');
  });
});

describe('dateIso', () => {
  it('accepte une date qui existe et refuse le reste', () => {
    expect(dateIso('1973-04-13')).toBe('1973-04-13');
    expect(dateIso('2024-02-29')).toBe('2024-02-29');
    expect(dateIso('2025-02-29')).toBeNull();
    expect(dateIso('1973-13-01')).toBeNull();
    expect(dateIso('13/04/1973')).toBeNull();
    expect(dateIso(NIL)).toBeNull();
  });
});

describe('lireNaissance', () => {
  it('lit la date et le lieu (la ville seule pour la France)', () => {
    expect(
      lireNaissance({
        infoNaissance: {
          dateNais: '1973-04-13',
          villeNais: 'Beauvais',
          depNais: 'Oise',
          paysNais: 'France',
        },
      }),
    ).toEqual({ date: '1973-04-13', lieu: 'Beauvais' });
  });

  it("ajoute le pays entre parenthèses quand il n'est pas la France", () => {
    expect(
      lireNaissance({
        infoNaissance: { dateNais: '1960-01-02', villeNais: 'Alger', paysNais: 'Algérie' },
      }),
    ).toEqual({ date: '1960-01-02', lieu: 'Alger (Algérie)' });
  });

  it('garde la date quand la ville est un champ vide (xsi:nil)', () => {
    expect(
      lireNaissance({
        infoNaissance: { dateNais: '1969-02-25', villeNais: NIL, depNais: NIL, paysNais: NIL },
      }),
    ).toEqual({ date: '1969-02-25', lieu: null });
  });

  it('renvoie null sans date valide', () => {
    expect(lireNaissance({ infoNaissance: { villeNais: 'Beauvais' } })).toBeNull();
    expect(lireNaissance({ infoNaissance: { dateNais: NIL } })).toBeNull();
    expect(lireNaissance({})).toBeNull();
    expect(lireNaissance(undefined)).toBeNull();
  });
});

describe('lireProfession', () => {
  it('lit le libellé courant', () => {
    expect(lireProfession({ libelleCourant: 'Conseiller en communication' })).toBe(
      'Conseiller en communication',
    );
  });

  it("retire le code INSEE que l'archive met parfois devant", () => {
    expect(lireProfession({ libelleCourant: '(33) - Cadre de la fonction publique' })).toBe(
      'Cadre de la fonction publique',
    );
  });

  it('renvoie null quand la profession manque', () => {
    expect(lireProfession({ libelleCourant: NIL })).toBeNull();
    expect(lireProfession({ libelleCourant: '(33) - ' })).toBeNull();
    expect(lireProfession(undefined)).toBeNull();
  });
});

describe('lireHatvp', () => {
  it('garde une adresse de page nominative de la HATVP', () => {
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/chenu-sebastien')).toBe(
      'https://www.hatvp.fr/pages_nominatives/chenu-sebastien',
    );
  });

  it('écarte les adresses réelles que le site de la HATVP ne sert pas (parenthèses, accent : 404)', () => {
    expect(
      lireHatvp('https://www.hatvp.fr/pages_nominatives/martin-(gironde)-alexandra-26044'),
    ).toBeNull();
    expect(
      lireHatvp('https://www.hatvp.fr/pages_nominatives/martin-(alpes-maritimes)-alexandra'),
    ).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/echaniz-iñaki-24343')).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/echaniz-i%C3%B1aki-24343')).toBeNull();
  });

  it('garde un nom avec un numéro, comme le site en produit pour les homonymes', () => {
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/echaniz-inaki-24343')).toBe(
      'https://www.hatvp.fr/pages_nominatives/echaniz-inaki-24343',
    );
  });

  it("renvoie null quand elle manque : { @xsi:nil } et non null dans l'archive", () => {
    expect(lireHatvp(NIL)).toBeNull();
    expect(lireHatvp(null)).toBeNull();
    expect(lireHatvp(undefined)).toBeNull();
  });

  it("refuse toute autre adresse : jamais d'adresse devinée ni détournée", () => {
    expect(lireHatvp('http://www.hatvp.fr/pages_nominatives/chenu-sebastien')).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr.example.com/pages_nominatives/x')).toBeNull();
    expect(lireHatvp('https://example.com/pages_nominatives/chenu-sebastien')).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/')).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/a b')).toBeNull();
    expect(lireHatvp('javascript:alert(1)')).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/x"onclick="y')).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/x?y=1')).toBeNull();
    expect(lireHatvp('https://www.hatvp.fr/pages_nominatives/x/y')).toBeNull();
  });
});

describe('lireX', () => {
  it('lit un identifiant avec ou sans arobase', () => {
    expect(lireX('@sebchenu')).toBe('https://x.com/sebchenu');
    expect(lireX('sebchenu')).toBe('https://x.com/sebchenu');
    expect(lireX('@ECiotti')).toBe('https://x.com/ECiotti');
  });

  it('lit une adresse de x.com ou de twitter.com', () => {
    expect(lireX('https://twitter.com/sebchenu')).toBe('https://x.com/sebchenu');
    expect(lireX('https://x.com/sebchenu/')).toBe('https://x.com/sebchenu');
  });

  it('refuse un texte libre ou un identifiant invalide', () => {
    expect(lireX('@X : x.com/BrigitteBareges')).toBeNull();
    expect(lireX('@un compte avec espaces')).toBeNull();
    expect(lireX('@identifiant_beaucoup_trop_long')).toBeNull();
    expect(lireX('https://example.com/sebchenu')).toBeNull();
    expect(lireX('')).toBeNull();
    expect(lireX(NIL)).toBeNull();
  });
});

describe('lireFacebook', () => {
  it('lit un nom de page', () => {
    expect(lireFacebook('chenu.sebastien')).toBe('https://www.facebook.com/chenu.sebastien');
    expect(lireFacebook('DavidHabib64')).toBe('https://www.facebook.com/DavidHabib64');
  });

  it('lit une adresse facebook.com et la forme people/<nom>/<numéro>', () => {
    expect(lireFacebook('https://www.facebook.com/chenu.sebastien')).toBe(
      'https://www.facebook.com/chenu.sebastien',
    );
    expect(lireFacebook('people/Val%C3%A9rie-L%C3%A9tard/100058007233955')).toBe(
      'https://www.facebook.com/people/Val%C3%A9rie-L%C3%A9tard/100058007233955',
    );
  });

  it('refuse ce qui ne ressemble pas à une page : accents, espaces, chemins, autres sites', () => {
    expect(lireFacebook('Stéphane-Travert-2017-256137114468103')).toBeNull();
    expect(lireFacebook('page avec espaces')).toBeNull();
    expect(lireFacebook('a/b/c')).toBeNull();
    expect(lireFacebook('abc')).toBeNull();
    expect(lireFacebook('https://example.com/chenu.sebastien')).toBeNull();
    expect(lireFacebook(NIL)).toBeNull();
  });
});

describe('lireSiteWeb', () => {
  it('garde une adresse https valide', () => {
    expect(lireSiteWeb('https://www.darmanin.fr')).toBe('https://www.darmanin.fr/');
    expect(lireSiteWeb('https://jerome-guedj.fr/blog')).toBe('https://jerome-guedj.fr/blog');
  });

  it('ajoute https:// à un nom de domaine nu, même avec une barre en trop devant ou derrière', () => {
    expect(lireSiteWeb('www.david-habib.fr')).toBe('https://www.david-habib.fr/');
    expect(lireSiteWeb('/www.veroniquebesse.fr')).toBe('https://www.veroniquebesse.fr/');
    expect(lireSiteWeb('clementine-autain.fr/')).toBe('https://clementine-autain.fr/');
    expect(lireSiteWeb('laurentmarcangeli.corsica')).toBe('https://laurentmarcangeli.corsica/');
  });

  it('refuse le texte libre, les autres schémas, les identifiants, les ports et les domaines sans point', () => {
    expect(lireSiteWeb('http://www.exemple.fr')).toBeNull();
    expect(lireSiteWeb('ftp://www.exemple.fr')).toBeNull();
    expect(lireSiteWeb('javascript:alert(1)')).toBeNull();
    expect(lireSiteWeb('mon site officiel')).toBeNull();
    expect(lireSiteWeb('https://user:mdp@exemple.fr')).toBeNull();
    expect(lireSiteWeb('https://exemple.fr:8080')).toBeNull();
    expect(lireSiteWeb('https://localhost')).toBeNull();
    expect(lireSiteWeb('https://exemple')).toBeNull();
    expect(lireSiteWeb(NIL)).toBeNull();
    expect(lireSiteWeb('')).toBeNull();
  });
});

describe('lireLiensWeb', () => {
  const adresse = (typeLibelle: string, valElec: unknown) => ({ typeLibelle, valElec });

  it('ne lit que le site, X et Facebook : jamais téléphone, e-mail, adresse postale ni autres réseaux', () => {
    const liens = lireLiensWeb({
      adresse: [
        { typeLibelle: 'Adresse officielle', ville: 'Paris 07 SP', codePostal: '75355' },
        adresse('Téléphone', '01.40.63.01.03'),
        adresse('Mèl', 'depute@assemblee-nationale.fr'),
        adresse('Instagram', 'sebchenu'),
        adresse('Linkedin', '/in/sebchenu'),
        adresse('Site internet', 'www.exemple.fr'),
        adresse('Twitter', '@sebchenu'),
        adresse('Facebook', 'chenu.sebastien'),
      ],
    });

    expect(liens).toEqual({
      siteWeb: 'https://www.exemple.fr/',
      x: 'https://x.com/sebchenu',
      facebook: 'https://www.facebook.com/chenu.sebastien',
    });
    expect(JSON.stringify(liens)).not.toMatch(/01\.40|depute@|Paris/);
  });

  it('accepte une adresse unique (objet), aucune adresse, ou des valeurs inexploitables', () => {
    expect(lireLiensWeb({ adresse: adresse('Twitter', '@sebchenu') }).x).toBe(
      'https://x.com/sebchenu',
    );
    expect(lireLiensWeb(null)).toEqual({ siteWeb: null, x: null, facebook: null });
    expect(lireLiensWeb({ adresse: [adresse('Twitter', '@X : x.com/Machin')] }).x).toBeNull();
  });

  it('retient la première valeur valide quand une rubrique est répétée', () => {
    expect(
      lireLiensWeb({
        adresse: [
          adresse('Twitter', 'pas valide du tout'),
          adresse('Twitter', '@bon'),
          adresse('Twitter', '@autre'),
        ],
      }).x,
    ).toBe('https://x.com/bon');
  });
});
