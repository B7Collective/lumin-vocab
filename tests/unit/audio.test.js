import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";

// Same rule as clipSlug in public/js/ui.js and tools/audio/gen.py
const slug = (w) => String(w).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const words = JSON.parse(readFileSync(new URL("../../public/data/words.json", import.meta.url))).map((w) => w.w);

test("every word has a recorded clip in both voices", () => {
  const missing = [];
  for (const accent of ["us", "gb"]) for (const w of words) {
    const f = new URL(`../../public/audio/${accent}/${slug(w)}.mp3`, import.meta.url);
    if (!existsSync(f) || statSync(f).size < 1500) missing.push(`${accent}/${w}`);
  }
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} clips missing`);
});

test("word file names never collide", () => {
  assert.equal(new Set(words.map(slug)).size, words.length);
});
