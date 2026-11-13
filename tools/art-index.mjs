// Writes public/art/index.json: the small pictures (icons, Journey art, keepers, scenery) a device keeps for offline use.
// Run after adding or renaming art: node tools/art-index.mjs
import { readdirSync, writeFileSync } from "node:fs";
export const OFFLINE_DIRS = ["icons", "journey", "keepers", "trails", "decor", "ground"];
export function artIndex(root = new URL("../public/art/", import.meta.url)) {
  const out = [];
  for (const d of OFFLINE_DIRS) for (const f of readdirSync(new URL(d + "/", root)).sort()) if (/\.(webp|png|jpg|svg)$/.test(f)) out.push(`/art/${d}/${f}`);
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL("../public/art/index.json", import.meta.url), JSON.stringify(artIndex()) + "\n");
  console.log("art index written");
}
