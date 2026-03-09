/**
 * Mapping item id → URL d'image officielle (logos set PokemonTCG.io CDN).
 * Ces logos sont en accès libre sur images.pokemontcg.io.
 * L'ItemIcon affiche l'emoji en fallback si l'image échoue à charger.
 *
 * Correspondances FR → EN set code :
 *  EV8.5 = Prismatic Evolutions = sv8pt5 (Jan 2025)
 *  EV8   = Étincelles Déferlantes = Surging Sparks = sv8 (Nov 2024)
 *  EV9   = Journey Together = sv9 (Mars 2025)
 *  Origine Perdu = Lost Origin = swsh11 (Sept 2022)
 *  Stars Étincelantes = Brilliant Stars = swsh9 (Fév 2022)
 *  25 Ans = Celebrations = cel25 (Oct 2021)
 *  Évolution Céleste = Chilling Reign = swsh6 (Août 2021)
 *  HGSS = HeartGold SoulSilver = hgss1 (Mars 2010)
 */

const CDN = "https://images.pokemontcg.io";

export const ITEM_IMAGE_URLS: Record<number | string, string> = {
  // ── ETB ────────────────────────────────────────────────────
  1:  `${CDN}/sv8pt5/logo.png`,   // ETB EV8.5  — Prismatic Evolutions
  2:  `${CDN}/sv8pt5/logo.png`,   // ETB EV10   — logo sv8pt5 en attendant sv10
  3:  `${CDN}/swsh11/logo.png`,   // ETB Origine Perdu — Lost Origin
  4:  `${CDN}/swsh9/logo.png`,    // ETB Stars Étincelantes — Brilliant Stars
  5:  `${CDN}/cel25/logo.png`,    // ETB 25 Ans — Celebrations
  16: `${CDN}/sv8pt5/logo.png`,   // ETB Héros (jan)
  17: `${CDN}/sv8pt5/logo.png`,   // ETB Héros (fév)
  18: `${CDN}/sv8/logo.png`,      // ETB EV8 — Surging Sparks

  // ── Display ────────────────────────────────────────────────
  6:  `${CDN}/sv8pt5/logo.png`,   // Display EV10
  7:  `${CDN}/swsh6/logo.png`,    // Display Évolution Céleste — Chilling Reign
  8:  `${CDN}/swsh11/logo.png`,   // Display Origine Perdu — Lost Origin

  // ── Artset ─────────────────────────────────────────────────
  10: `${CDN}/sv8/logo.png`,      // Artset EV8 — Surging Sparks
  11: `${CDN}/sv8pt5/logo.png`,   // Artset EV9 (approximatif)
  12: `${CDN}/sv8pt5/logo.png`,   // Artset EV10

  // ── UPC / Pokébox / Coffret ─────────────────────────────────
  9:  `${CDN}/sv8pt5/logo.png`,   // UPC EV10
  13: `${CDN}/sv8pt5/logo.png`,   // Pokébox EV10
  15: `${CDN}/sv8pt5/logo.png`,   // Coffret 30 Ans
  19: `${CDN}/sv8pt5/logo.png`,   // Pokébox ME2.5

  // ── Blister vintage ────────────────────────────────────────
  14: `${CDN}/hgss1/logo.png`,    // Blister HGSS — HeartGold SoulSilver
};

/** Récupère l'URL d'image d'un item par son id, ou null si inconnu */
export const getItemImageUrl = (id: number | string): string | null =>
  ITEM_IMAGE_URLS[id] ?? null;
