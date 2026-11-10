import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as sync from "../../public/js/sync.js";
import { validate } from "../../src/worker.js";

const words = JSON.parse(readFileSync(new URL("../../public/data/words.json", import.meta.url))).filter(w => w.l <= 2).map(w => w.w);

test("family codes are six words and enough entropy", () => {
  const code = sync.makeCode(words);
  assert.equal(code.split("-").length, 6);
  assert.ok(sync.validCode(code));
  const pool = new Set(words.filter(w => /^[a-z]{4,8}$/.test(w))).size;
  assert.ok(Math.log2(pool) * 6 >= 55, `pool ${pool} gives ${Math.round(Math.log2(pool) * 6)} bits`);
});
test("codes are normalized however they are typed", () => {
  assert.equal(sync.normalizeCode("  Maple RIVER, lantern - gentle\ncurious  brave "), "maple-river-lantern-gentle-curious-brave");
  assert.equal(sync.validCode("too short"), false);
});
test("same code gives the same family id and keys; different codes do not", async () => {
  const a = await sync.deriveKeys("maple river lantern gentle curious brave");
  const b = await sync.deriveKeys("Maple-River-Lantern-Gentle-Curious-Brave");
  const c = await sync.deriveKeys("maple river lantern gentle curious brace");
  assert.equal(a.fid, b.fid); assert.notEqual(a.fid, c.fid); assert.match(a.fid, /^[0-9a-f]{64}$/);
  assert.equal(await sync.opaqueId(a, "card:x:luminous"), await sync.opaqueId(b, "card:x:luminous"));
});
test("records encrypt and decrypt, and the wrong key fails", async () => {
  const k = await sync.deriveKeys("maple river lantern gentle curious brave");
  const bad = await sync.deriveKeys("maple river lantern gentle curious brace");
  const rec = { id: "profile:1", type: "profile", data: { name: "Test Person" }, u: 1, dev: "d", del: 0 };
  const blob = await sync.seal(k, rec);
  assert.ok(!blob.includes("Test"), "name is not visible in the blob");
  assert.deepEqual(await sync.open(k, blob), rec);
  await assert.rejects(sync.open(bad, blob));
});
test("server rejects malformed requests", () => {
  const fid = "a".repeat(64);
  assert.equal(validate({ fid, since: 0, changes: [] }), null);
  assert.equal(validate({ fid: "nope", since: 0, changes: [] }), "bad fid");
  assert.equal(validate({ fid, since: -1, changes: [] }), "bad since");
  assert.equal(validate({ fid, since: 0, changes: [{ id: "x", u: 1, d: 0, c: "a" }] }), "bad id");
  assert.equal(validate({ fid, since: 0, changes: [{ id: "a".repeat(32), u: 1, d: 0, c: "<script>" }] }), "bad c");
  assert.equal(validate({ fid, since: 0, changes: new Array(201).fill({ id: "a".repeat(32), u: 1, d: 0, c: "a" }) }), "bad changes");
});
test("word bank is clean", () => {
  const all = JSON.parse(readFileSync(new URL("../../public/data/words.json", import.meta.url)));
  const text = JSON.stringify(all);
  assert.ok(!text.includes("\u2014"), "no em dashes");
  assert.ok(all.length > 2000);
  for (const w of all) {
    assert.ok(w.w && w.d && w.p, "has word, definition and part of speech");
    assert.ok([0, 1, 2, 3, 4, 5].includes(w.l), "one of the six levels");
    assert.ok(w.e2 && new RegExp(`(^|[^\\w])${w.w.replace(/[-]/g, "\\-")}(?![\\w])`, "i").test(w.e2), `second sentence uses the word: ${w.w}`);
    assert.notEqual(w.e2, w.e, "second sentence differs from the first");
  }
  assert.equal(new Set(all.map(w => w.w)).size, all.length, "no duplicates");
  // Every level has about 1,200 words (3.2 doubled the bank)
  for (let l = 0; l < 6; l++) { const n = all.filter((w) => w.l === l && !w.c).length; assert.ok(n >= 1100 && n <= 1500, `level ${l} has ${n} words`); }
});
test("side trails point at real words", () => {
  const all = JSON.parse(readFileSync(new URL("../../public/data/words.json", import.meta.url)));
  const trails = JSON.parse(readFileSync(new URL("../../public/data/trails.json", import.meta.url)));
  const by = new Map(all.map((w) => [w.w, w]));
  assert.ok(trails.length >= 15);
  for (const t of trails) {
    assert.ok(t.key && t.name && t.blurb && ["all", "teen", "adult"].includes(t.aud));
    assert.ok(t.words.length >= 20, `${t.key} has enough words`);
    for (const w of t.words) { assert.ok(by.has(w), `${t.key}: ${w}`); assert.ok(by.get(w).x.includes(t.key)); }
  }
  for (const w of all) if (w.cf) assert.ok(by.has(w.cf), `mix-up partner of ${w.w}`);
});
