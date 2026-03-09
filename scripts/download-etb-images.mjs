import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const etbPath = path.join(process.cwd(), "src", "data", "etbData.ts");
const data = readFileSync(etbPath, "utf8");

// Extract array: find " = [" (start of array value, not the "[]" in "ETBItem[]")
const arrayValueStart = data.indexOf(" = [");
if (arrayValueStart === -1) throw new Error("etbData array not found");
const arrayStart = arrayValueStart + " = ".length; // position of "["
let depth = 0;
let end = -1;
for (let i = arrayStart; i < data.length; i++) {
  if (data[i] === "[") depth++;
  else if (data[i] === "]") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
if (end === -1) throw new Error("Could not find end of etbData array");
const arrayStr = data.slice(arrayStart, end + 1);
let items;
try {
  items = JSON.parse(arrayStr);
} catch (e) {
  console.error("JSON parse error:", e.message);
  throw e;
}
if (!Array.isArray(items) || items.length === 0) {
  console.error("No items: arrayStr.length=", arrayStr.length, "data.length=", data.length, "arrayStart=", arrayStart, "end=", end);
  process.exit(1);
}

// All ETB images are now managed locally in public/images/pokedata.
// This script is kept for history but does not download anything anymore.
console.log("ℹ️ download-etb-images.mjs: no-op (ETB images are local in public/images/pokedata).");
process.exit(0);

mkdirSync(path.join(process.cwd(), "public", "images", "etb"), { recursive: true });

const CARDMARKET_FALLBACK = {
  EB01: "https://product-images.s3.cardmarket.com/1016/427141/427141.png",
  EB02: "https://product-images.s3.cardmarket.com/1016/453283/453283.png",
  EB03: "https://product-images.s3.cardmarket.com/1016/462229/462229.png",
  EB04: "https://product-images.s3.cardmarket.com/1016/494499/494499.png",
  "EB04.5": "https://product-images.s3.cardmarket.com/1016/526120/526120.png",
  EB05: "https://product-images.s3.cardmarket.com/1016/527425/527425.png",
  EB06: "https://product-images.s3.cardmarket.com/1016/557971/557971.png",
  EB07: "https://product-images.s3.cardmarket.com/1016/568794/568794.png",
  "EB07.5": "https://product-images.s3.cardmarket.com/1016/570895/570895.png",
  EB08: "https://product-images.s3.cardmarket.com/1016/574593/574593.png",
  EB09: "https://product-images.s3.cardmarket.com/1016/583510/583510.png",
  EB10: "https://product-images.s3.cardmarket.com/1016/611359/611359.png",
  "EB10.5": "https://product-images.s3.cardmarket.com/1016/653700/653700.png",
  EB11: "https://product-images.s3.cardmarket.com/1016/666150/666150.png",
  EB12: "https://product-images.s3.cardmarket.com/1016/672338/672338.png",
  "EB12.5": "https://product-images.s3.cardmarket.com/1016/683009/683009.png",
  EV01: "https://product-images.s3.cardmarket.com/1016/692101/692101.png",
  EV02: "https://product-images.s3.cardmarket.com/1016/703175/703175.png",
  EV03: "https://product-images.s3.cardmarket.com/1016/715464/715464.png",
  "EV03.5": "https://product-images.s3.cardmarket.com/1016/719691/719691.png",
  EV04: "https://product-images.s3.cardmarket.com/1016/728730/728730.png",
  "EV04.5": "https://product-images.s3.cardmarket.com/1016/745548/745548.png",
  EV05: "https://product-images.s3.cardmarket.com/1016/750412/750412.png",
  EV06: "https://product-images.s3.cardmarket.com/1016/761229/761229.jpg",
  "EV06.5": "https://product-images.s3.cardmarket.com/1016/770958/770958.jpg",
  EV07: "https://product-images.s3.cardmarket.com/1016/776336/776336.jpg",
  EV08: "https://product-images.s3.cardmarket.com/1016/784963/784963.jpg",
  "EV08.5": "https://product-images.s3.cardmarket.com/1016/798930/798930.jpg",
  EV09: "https://product-images.s3.cardmarket.com/1016/805593/805593.jpg",
  EV10: "https://product-images.s3.cardmarket.com/1016/818585/818585.jpg",
  "EV10.5a": "https://product-images.s3.cardmarket.com/1016/824088/824088.jpg",
  "EV10.5b": "https://product-images.s3.cardmarket.com/1016/824089/824089.jpg",
  ME01: "https://product-images.s3.cardmarket.com/1016/834830/834830.jpg",
  ME02: "https://product-images.s3.cardmarket.com/1016/846744/846744.jpg",
  "ME2.5": "https://product-images.s3.cardmarket.com/1016/860574/860574.jpg",
  ME03: "https://product-images.s3.cardmarket.com/1016/860574/860574.jpg",
};

function getExt(url) {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "jpg";
    if (p.endsWith(".png")) return "png";
    if (p.endsWith(".webp")) return "webp";
  } catch (_) {}
  return "jpg";
}

for (const item of items) {
  let url = item.imageUrl;
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    url = CARDMARKET_FALLBACK[item.id] || null;
  }
  if (!url) {
    console.log(`⏭️ ${item.id}: no imageUrl, skip`);
    continue;
  }
  const ext = getExt(url);
  const filename = `${item.id}.${ext}`;
  const outPath = path.join(process.cwd(), "public", "images", "etb", filename);
  item.imageUrl = `/images/etb/${filename}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(outPath, buf);
    console.log(`✅ ${item.id} → ${filename}`);
  } catch (e) {
    console.log(`❌ ${item.id}: ${e.message} (path set anyway)`);
  }
}

// Write back etbData.ts with updated imageUrl
const newArrayStr = JSON.stringify(items, null, 2);
const before = data.slice(0, arrayStart);
const after = data.slice(end + 1);
const newContent = before + newArrayStr + after;
writeFileSync(etbPath, newContent, "utf8");
console.log(`✅ Updated ${etbPath} with local image paths (${items.length} items)`);
