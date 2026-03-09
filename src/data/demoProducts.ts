import type { Product } from "../state/ProductsContext";

export const demoProducts: Product[] = [
  {
    id: "lugia-blister-hgss-fr",
    name: "Blister Lugia HGSS FR",
    emoji: "🟦",
    category: "Blisters",
    set: "HeartGold SoulSilver FR",
    condition: "Neuf scellé",
    currentPrice: 450,
    change30dPercent: 18,
    badge: "Top Lugia",
    createdAt: Date.UTC(2024, 0, 1)
  },
  {
    id: "hooh-blister-hgss-fr",
    name: "Blister Ho-Oh HGSS FR",
    emoji: "🟥",
    category: "Blisters",
    set: "HeartGold SoulSilver FR",
    condition: "Neuf scellé",
    currentPrice: 420,
    change30dPercent: 12,
    badge: "HGSS",
    createdAt: Date.UTC(2024, 0, 2)
  },
  {
    id: "etb-dracaufeu-vmax-fr",
    name: "ETB Dracaufeu VMAX FR",
    emoji: "🔥",
    category: "ETB",
    set: "Épée & Bouclier",
    condition: "Neuf scellé",
    currentPrice: 280,
    change30dPercent: -3,
    badge: "Premium",
    createdAt: Date.UTC(2024, 0, 3)
  },
  {
    id: "display-hgss-fr",
    name: "Display HGSS FR",
    emoji: "📦",
    category: "Displays",
    set: "HeartGold SoulSilver FR",
    condition: "Neuf scellé",
    currentPrice: 1800,
    change30dPercent: 25,
    badge: "Vintage",
    createdAt: Date.UTC(2024, 0, 4)
  },
  {
    id: "blister-ronflex-ex-fr",
    name: "Blister Ronflex EX FR",
    emoji: "😴",
    category: "Blisters",
    set: "XY FR",
    condition: "Neuf scellé",
    currentPrice: 95,
    change30dPercent: 6,
    badge: "Sleeper",
    createdAt: Date.UTC(2024, 0, 5)
  },
  {
    id: "lugia-legend-psa10-fr",
    name: "Lugia Legend PSA10 FR",
    emoji: "✨",
    category: "Gradées",
    set: "HeartGold SoulSilver FR",
    condition: "PSA 10",
    currentPrice: 620,
    change30dPercent: 22,
    badge: "Gem Mint",
    createdAt: Date.UTC(2024, 0, 6)
  },
  {
    id: "display-base-set-fr",
    name: "Display Base Set FR",
    emoji: "🟨",
    category: "Displays",
    set: "Base Set FR",
    condition: "Neuf scellé",
    currentPrice: 8500,
    change30dPercent: 8,
    badge: "Graal",
    createdAt: Date.UTC(2024, 0, 7)
  },
  {
    id: "charizard-ex-holo-psa9-fr",
    name: "Charizard EX Holo PSA9 FR",
    emoji: "🔥",
    category: "Gradées",
    set: "EX FR",
    condition: "PSA 9",
    currentPrice: 450,
    change30dPercent: 12,
    badge: "Iconique",
    createdAt: Date.UTC(2024, 0, 8)
  }
];

