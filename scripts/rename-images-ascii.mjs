/**
 * Renomme les fichiers image sous public/images/{displays,etb,upc} en noms ASCII (tirets).
 * Usage : node scripts/rename-images-ascii.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toAsciiImageFilename } from "./imageFilenameAscii.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const dirs = [
  path.join(root, "public", "images", "displays"),
  path.join(root, "public", "images", "etb"),
  path.join(root, "public", "images", "upc"),
];

const mapping = [];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const oldName = ent.name;
    const newName = toAsciiImageFilename(oldName);
    if (oldName === newName) continue;
    const oldPath = path.join(dir, oldName);
    const newPath = path.join(dir, newName);
    if (fs.existsSync(newPath)) {
      console.error(`Collision: ${newPath} existe déjà (skip ${oldPath})`);
      process.exit(1);
    }
    fs.renameSync(oldPath, newPath);
    mapping.push({ dir: path.relative(path.join(root, "public"), dir).replace(/\\/g, "/"), oldName, newName });
  }
}

console.log(JSON.stringify({ renamed: mapping.length, mapping }, null, 2));
