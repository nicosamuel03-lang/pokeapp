/**
 * Corridor prix affiché (min/max) — doit rester aligné avec `server/productCatalog.json`
 * (`minPrice` / `maxPrice` sur l’entrée catalogue correspondante).
 * Display : Marché mars 26 (±10 %).
 * ETB : Mars 2026 — prix de référence fournis (±10 %).
 */
export const EBAY_PRICE_CORRIDOR_BY_PRODUCT_ID: Record<
  string,
  { minPrice: number; maxPrice: number }
> = {
  "display-EB01": { minPrice: 1900, maxPrice: 2300 },
  "display-EB02": { minPrice: 2700, maxPrice: 3300 },
  "display-EB03": { minPrice: 1600, maxPrice: 2000 },
  "display-EB04": { minPrice: 1000, maxPrice: 1200 },
  "display-EB05": { minPrice: 540, maxPrice: 660 },
  "display-EB06": { minPrice: 380, maxPrice: 460 },
  "display-EB07": { minPrice: 1050, maxPrice: 1250 },
  "display-EB08": { minPrice: 520, maxPrice: 640 },
  "display-EB09": { minPrice: 340, maxPrice: 420 },
  "display-EB10": { minPrice: 250, maxPrice: 310 },
  "display-EB11": { minPrice: 380, maxPrice: 460 },
  "display-EB12": { minPrice: 300, maxPrice: 360 },
  "display-EV01": { minPrice: 190, maxPrice: 230 },
  "display-EV02": { minPrice: 190, maxPrice: 230 },
  "display-EV03": { minPrice: 190, maxPrice: 230 },
  "display-EV04": { minPrice: 190, maxPrice: 230 },
  "display-EV05": { minPrice: 190, maxPrice: 230 },
  "display-EV06": { minPrice: 190, maxPrice: 230 },
  "display-EV07": { minPrice: 190, maxPrice: 230 },
  "display-EV08": { minPrice: 190, maxPrice: 230 },
  "display-EV09": { minPrice: 190, maxPrice: 230 },
  "display-EV10": { minPrice: 290, maxPrice: 350 },
  "display-ME01": { minPrice: 190, maxPrice: 270 },
  "display-ME02": { minPrice: 190, maxPrice: 270 },
  "display-ME03": { minPrice: 190, maxPrice: 270 },

  "EB01": { minPrice: 1350, maxPrice: 1650 },
  "EB01-2": { minPrice: 1350, maxPrice: 1650 },
  "EB02": { minPrice: 500, maxPrice: 1000 },
  "EB03": { minPrice: 1845, maxPrice: 2255 },
  "EB03,5": { minPrice: 504, maxPrice: 616 },
  "EB04": { minPrice: 1800, maxPrice: 2200 },
  "EB04.5": { minPrice: 250, maxPrice: 350 },
  "EB05": { minPrice: 360, maxPrice: 440 },
  "EB05-2": { minPrice: 1530, maxPrice: 1870 },
  "EB06": { minPrice: 234, maxPrice: 286 },
  "EB06-2": { minPrice: 234, maxPrice: 286 },
  "EB07": { minPrice: 360, maxPrice: 440 },
  "EB07-2": { minPrice: 360, maxPrice: 440 },
  "EB07.5": { minPrice: 450, maxPrice: 550 },
  "EB08": { minPrice: 300, maxPrice: 350 },
  "EB09": { minPrice: 167, maxPrice: 204 },
  "EB10": { minPrice: 158, maxPrice: 193 },
  "EB10.5": { minPrice: 158, maxPrice: 193 },
  "EB11": { minPrice: 279, maxPrice: 341 },
  "EB12": { minPrice: 198, maxPrice: 242 },
  "EB12.5": { minPrice: 234, maxPrice: 286 },

  "EV01": { minPrice: 158, maxPrice: 193 },
  "EV02": { minPrice: 144, maxPrice: 176 },
  "EV02-2": { minPrice: 144, maxPrice: 176 },
  "EV03": { minPrice: 162, maxPrice: 198 },
  "EV03.5": { minPrice: 350, maxPrice: 400 },
  "EV04": { minPrice: 270, maxPrice: 330 },
  "EV04.5": { minPrice: 68, maxPrice: 83 },
  "EV05": { minPrice: 270, maxPrice: 330 },
  "EV05-2": { minPrice: 108, maxPrice: 132 },
  "EV06": { minPrice: 108, maxPrice: 132 },
  "EV06-2": { minPrice: 122, maxPrice: 149 },
  "EV06.5": { minPrice: 63, maxPrice: 77 },
  "EV07": { minPrice: 68, maxPrice: 83 },
  "EV08": { minPrice: 104, maxPrice: 127 },
  "EV08.5": { minPrice: 81, maxPrice: 99 },
  "EV09": { minPrice: 72, maxPrice: 88 },
  "EV10": { minPrice: 117, maxPrice: 143 },
  "EV10.5": { minPrice: 68, maxPrice: 83 },
  "EV10.5-2": { minPrice: 68, maxPrice: 83 },

  "ME01": { minPrice: 77, maxPrice: 94 },
  "ME02": { minPrice: 68, maxPrice: 83 },
  "ME02-2": { minPrice: 68, maxPrice: 83 },
  "ME02.5": { minPrice: 72, maxPrice: 88 },
  "ME03": { minPrice: 50, maxPrice: 61 },

  "SL03.5": { minPrice: 360, maxPrice: 440 },
  "SL05": { minPrice: 405, maxPrice: 495 },
  "SL05-2": { minPrice: 405, maxPrice: 495 },
  "SL06": { minPrice: 1080, maxPrice: 1320 },
  "SL07": { minPrice: 1800, maxPrice: 2200 },
  "SL07.5": { minPrice: 3600, maxPrice: 4400 },
  "SL08": { minPrice: 3600, maxPrice: 4400 },
  "SL09": { minPrice: 5850, maxPrice: 7150 },
  "SL10": { minPrice: 1980, maxPrice: 2420 },
  "SL10.5": { minPrice: 405, maxPrice: 495 },
  "SL11": { minPrice: 1143, maxPrice: 1397 },
  "SL12": { minPrice: 1350, maxPrice: 1650 },
};

export function getEbayPriceCorridor(
  productId: string
): { minPrice: number; maxPrice: number } | undefined {
  return EBAY_PRICE_CORRIDOR_BY_PRODUCT_ID[productId];
}
