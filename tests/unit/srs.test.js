import { test } from "node:test";
import assert from "node:assert/strict";
import * as srs from "../../public/js/srs.js";

const DAY = srs.DAY, t0 = Date.UTC(2026, 10, 9, 15);
test("first Good answer schedules a few days out", () => {
  const s = srs.review(srs.newState(), srs.Good, t0);
  assert.ok(s.s > 2 && s.s < 5, "stability " + s.s);
  assert.ok(s.due > t0 + DAY, "due after a day");
  assert.equal(s.reps, 1);
});
test("Again brings the word back in ten minutes and counts a lapse", () => {
  const s = srs.review(srs.newState(), srs.Again, t0);
  assert.equal(s.due, t0 + 10 * 60000); assert.equal(s.lapses, 1);
});
test("intervals grow with successful reviews", () => {
  let s = srs.review(srs.newState(), srs.Good, t0), now = t0, last = 0;
  for (let i = 0; i < 5; i++) { now = s.due + DAY / 4; s = srs.review(s, srs.Good, now); const gap = s.due - now; assert.ok(gap > last, `gap ${i} grows`); last = gap; }
  assert.ok(srs.isMastered(s), "mastered after steady reviews");
});
test("forgetting lowers stability", () => {
  let s = srs.review(srs.newState(), srs.Good, t0);
  s = srs.review(s, srs.Good, s.due + DAY);
  const before = s.s; s = srs.review(s, srs.Again, s.due + DAY);
  assert.ok(s.s < before);
});
test("difficulty stays between 1 and 10", () => {
  let s = srs.newState();
  for (let i = 0; i < 30; i++) s = srs.review(s, i % 2 ? srs.Again : srs.Easy, t0 + i * DAY * 3);
  assert.ok(s.d >= 1 && s.d <= 10);
});
test("answer timing maps to grades", () => {
  assert.equal(srs.gradeFor(false, 1000), srs.Again);
  assert.equal(srs.gradeFor(true, 2000), srs.Easy);
  assert.equal(srs.gradeFor(true, 6000), srs.Good);
  assert.equal(srs.gradeFor(true, 20000), srs.Hard);
  assert.equal(srs.gradeFor(true, 2000, true), srs.Hard);
});
