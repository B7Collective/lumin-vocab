import { test } from "node:test";
import assert from "node:assert/strict";
import * as store from "../../public/js/store.js";
import { mergeProfile, saveProfile, profile, journeyState } from "../../public/js/model.js";

const road = (ch, step, extra = {}) => ({ ch, step, stars: {}, log: [], openOn: null, ...extra });

test("an out-of-date copy can never wind a Journey back", () => {
  const ahead = { id: "k", level: 1, days: ["2026-11-12"], journey: { 1: road(9, 2, { stars: { "8.1": 3 }, log: [{ ch: 8, at: 5, stars: 3 }] }) } };
  const stale = { id: "k", level: 1, days: ["2026-11-10", "2026-11-13"], journey: { 1: road(1, 0, { stars: { "0.0": 2 }, log: [{ ch: 0, at: 1, stars: 2 }] }) } };
  // the stale copy was written later, which used to make it win outright
  const m = mergeProfile(ahead, stale, 100, 200);
  assert.equal(m.journey[1].ch, 9); assert.equal(m.journey[1].step, 2);
  assert.deepEqual(m.journey[1].stars, { "8.1": 3, "0.0": 2 });
  assert.deepEqual(m.journey[1].log.map((x) => x.ch), [0, 8]);
  assert.deepEqual(m.days, ["2026-11-10", "2026-11-12", "2026-11-13"]);
});

test("settings follow whichever device changed them last, field by field", () => {
  const a = { id: "k", level: 2, theme: "dusk", _t: { level: 50, theme: 10 } };
  const b = { id: "k", level: 1, theme: "morning", _t: { level: 20, theme: 30 } };
  const m = mergeProfile(a, b, 1, 2);
  assert.equal(m.level, 2); assert.equal(m.theme, "morning");
  assert.deepEqual(m._t, { level: 50, theme: 30 });
});

test("merging is the same in either order, and merging again changes nothing", () => {
  const a = { id: "k", level: 1, journey: { 1: road(3, 1, { openOn: "2026-11-14" }), 2: road(1, 0) }, trails: { sea: road(2, 0) }, days: ["a"], _t: { level: 5 } };
  const b = { id: "k", level: 1, journey: { 1: road(3, 1, { openOn: "2026-11-13" }) }, trails: { sea: road(4, 1) }, days: ["b"], _t: { level: 5 } };
  const ab = mergeProfile(a, b, 7, 9), ba = mergeProfile(b, a, 9, 7);
  assert.equal(store.canon(ab), store.canon(ba));
  assert.equal(store.canon(mergeProfile(ab, a, 10, 7)), store.canon(ab));
  assert.equal(ab.trails.sea.ch, 4); assert.equal(ab.journey[2].ch, 1);
});

test("a stale write from another device heals when it arrives", () => {
  store.setMerger("profile", mergeProfile);
  saveProfile({ id: "kid", level: 1, role: "kid", days: ["2026-11-13"], journey: { 1: road(12, 3) } });
  const mine = profile("kid");
  // another device, a day behind, marks today as active: its copy still says chapter 2
  const theirs = { id: "profile:kid", type: "profile", u: Date.now() + 5000, dev: "other", del: 0,
    data: { id: "kid", level: 1, role: "kid", days: ["2026-11-12", "2026-11-13"], journey: { 1: road(2, 0) }, _t: { ...mine._t, days: Date.now() + 5000 } } };
  assert.equal(store.applyRemote(theirs), true);
  const now = profile("kid");
  assert.equal(journeyState(now).ch, 12);
  assert.deepEqual(now.days, ["2026-11-12", "2026-11-13"]);
  const rec = store.raw().find((r) => r.id === "profile:kid");
  assert.equal(rec.dirty, 1, "the combined copy goes back up"); assert.ok(rec.u > theirs.u, "and wins on the server");
  // when the combined copy comes back to the other device, nothing more needs to be sent
  assert.equal(store.applyRemote({ ...rec, dev: "server-echo" }), false);
});

import { mergeList, mergeCard, streak, tomorrowKey } from "../../public/js/model.js";

test("a device whose clock runs behind still wins with a newer change", () => {
  saveProfile({ id: "clock", theme: "night", _t: { theme: Date.now() + 3600000 } }); // set by a device an hour ahead
  saveProfile({ ...profile("clock"), theme: "garden" });
  const t = profile("clock")._t.theme;
  assert.ok(t > Date.now() + 3600000, "the new stamp is past the fast clock's");
  const fast = { id: "clock", theme: "night", _t: { theme: Date.now() + 3600000 } };
  assert.equal(mergeProfile(fast, profile("clock"), 1, 2).theme, "garden");
});

test("lists keep words added on one device and removals made on another", () => {
  const base = { id: "L", name: "Trip", words: ["a", "b"], _w: { a: [10, 0], b: [11, 0] } };
  const phone = { ...base, words: ["a", "b", "c"], _w: { ...base._w, c: [20, 0] } };       // added c
  const tablet = { ...base, words: ["b"], _w: { ...base._w, a: [10, 25] } };              // removed a
  const m = mergeList(phone, tablet, 1, 2);
  assert.deepEqual(m.words, ["b", "c"]);
  assert.equal(store.canon(mergeList(tablet, phone, 2, 1)), store.canon(m));
  // a list saved before marks existed still combines
  assert.deepEqual(mergeList({ id: "L", words: ["x"] }, { id: "L", words: ["y"] }, 1, 2).words.sort(), ["x", "y"]);
});

test("a card keeps the newer review schedule even when an older copy is written later", () => {
  const reviewed = { pid: "k", w: "brave", st: "learning", srs: { due: 99, reps: 4 }, fav: false, _t: { srs: 500, st: 100 } };
  const staleFav = { pid: "k", w: "brave", st: "learning", srs: { due: 1, reps: 1 }, fav: true, _t: { srs: 100, st: 100, fav: 600 } };
  const m = mergeCard(reviewed, staleFav, 1, 2);
  assert.deepEqual(m.srs, { due: 99, reps: 4 }); assert.equal(m.fav, true);
});

test("a removed profile can't come back from an old copy, but a backup restore brings it back", () => {
  saveProfile({ id: "gone", level: 1 });
  store.remove("profile:gone");
  const dead = store.raw().find((r) => r.id === "profile:gone");
  assert.equal(store.applyRemote({ id: "profile:gone", type: "profile", u: dead.u + 50, dev: "old", del: 0, data: { id: "gone", level: 1 } }), false);
  assert.equal(profile("gone"), undefined);
  const n = store.importAll({ app: "lumin-vocab", version: 1, records: [{ id: "profile:gone", type: "profile", u: 5, dev: "x", del: 0, data: { id: "gone", level: 1 } }] });
  assert.equal(n, 1); assert.equal(profile("gone").level, 1);
  const back = store.raw().find((r) => r.id === "profile:gone");
  assert.ok(back.data.revived > dead.u, "other devices accept the restore");
});

test("streaks and the next stop count calendar days, even across daylight saving", () => {
  // Mar 8, 2026 is the spring-forward day in the US
  const p = { days: ["2026-03-07", "2026-03-09"] };
  assert.equal(streak(p, new Date(2026, 2, 9, 0, 30)), 1);
  assert.equal(tomorrowKey(new Date(2026, 2, 7, 23, 30)), "2026-03-08");
  assert.equal(tomorrowKey(new Date(2026, 10, 1, 23, 30)), "2026-11-02");
});
