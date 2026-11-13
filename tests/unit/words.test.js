import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as model from "../../public/js/model.js";

// load the real word bank and trails without a browser
const words = JSON.parse(readFileSync(new URL("../../public/data/words.json", import.meta.url)));
const trails = JSON.parse(readFileSync(new URL("../../public/data/trails.json", import.meta.url)));
globalThis.fetch = async (u) => ({ ok: true, json: async () => (String(u).includes("trails") ? trails : words) });
await model.loadWords();

test("every level's road ends on a real stop, not a word or two", () => {
  for (let lv = 0; lv < model.LEVELS.length; lv++) {
    const chs = model.chapterWords(lv), last = chs[chs.length - 1];
    assert.ok(last.words.length >= 3, `level ${lv} ends with ${last.words.length} words`);
  }
});

test("side trails keep every word at the level", () => {
  for (let lv = 0; lv < model.LEVELS.length; lv++) {
    const p = { level: lv, role: lv <= 1 ? "kid" : "adult" };
    for (const t of model.trailsFor(p)) {
      const n = model.trailChapters(t.key, p).reduce((a, c) => a + c.words.length, 0);
      assert.equal(n, model.trailWords(t, p).length, `${t.key} at level ${lv}`);
    }
  }
});

test("a word with the same meaning is never offered as a wrong answer", () => {
  for (const w of model.WORDS.filter((x) => x.l === 4).slice(0, 400)) {
    for (const d of model.distractors(w, 3, "w")) assert.notEqual(d.d, w.d, `${w.w} vs ${d.w}`);
  }
});

test("checking whether a word can be asked never uses up a sentence", () => {
  const w = model.WORDS.find((x) => model.sentences(x).length >= 3);
  const first = model.gapSentence(w);
  model.canAsk(w, "gap"); model.canAsk(w, "gap");
  const second = model.gapSentence(w);
  assert.notEqual(first, second);
  model.canAsk(w, "gap");
  const third = model.gapSentence(w);
  assert.notEqual(third, second); assert.notEqual(third, first);
});

test("side trail progress belongs to a level", () => {
  const p = { id: "t", level: 2, trails: { "2:space": { ch: 3, step: 0 }, decades: { ch: 1, step: 1 } } };
  assert.equal(model.journeyState(p, "space").ch, 3);
  assert.equal(model.journeyState({ ...p, level: 3 }, "space").ch, 0);
  assert.equal(model.journeyState(p, "decades").ch, 1, "progress from before still shows");
});
