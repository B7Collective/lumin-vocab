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
  for (const w of all) { assert.ok(w.w && w.d && w.p, "has word, definition and part of speech"); assert.ok([0, 1, 2, 3].includes(w.l)); }
  assert.equal(new Set(all.map(w => w.w)).size, all.length, "no duplicates");
});
