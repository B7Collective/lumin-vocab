// Lumin Vocab: spaced repetition scheduler based on FSRS-5 (open-spaced-repetition, MIT).
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

export const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5, FACTOR = 19 / 81;
export const DAY = 86400000;
export const Again = 1, Hard = 2, Good = 3, Easy = 4;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const retrievability = (elapsedDays, s) => Math.pow(1 + FACTOR * elapsedDays / s, DECAY);
export const intervalFor = (s, retention = 0.9) => s / FACTOR * (Math.pow(retention, 1 / DECAY) - 1);
const initD = (g) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);

// card.srs: { s: stability (days), d: difficulty 1..10, due: ms, last: ms, reps, lapses }
export function newState() { return { s: 0, d: 0, due: 0, last: 0, reps: 0, lapses: 0 }; }

export function review(state, grade, now = Date.now(), retention = 0.9, maxDays = 365) {
  const st = { ...state };
  if (!st.reps) {
    st.s = W[grade - 1];
    st.d = initD(grade);
  } else {
    const t = Math.max(0, (now - st.last) / DAY);
    const r = retrievability(t, st.s);
    const dNext = st.d - W[6] * (grade - 3);
    const damped = st.d + (dNext - st.d) * (10 - st.d) / 9;
    st.d = clamp(W[7] * initD(4) + (1 - W[7]) * damped, 1, 10);
    if (t < 1) {
      // same-day review: short-term stability update
      st.s = st.s * Math.exp(W[17] * (grade - 3 + W[18]));
    } else if (grade === Again) {
      st.s = Math.min(st.s, W[11] * Math.pow(st.d, -W[12]) * (Math.pow(st.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
    } else {
      const hard = grade === Hard ? W[15] : 1, easy = grade === Easy ? W[16] : 1;
      st.s = st.s * (1 + Math.exp(W[8]) * (11 - st.d) * Math.pow(st.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
    }
  }
  st.s = Math.max(0.1, st.s);
  if (grade === Again) st.lapses = (st.lapses || 0) + 1;
  st.reps = (st.reps || 0) + 1;
  st.last = now;
  let days = grade === Again ? 0 : clamp(Math.round(intervalFor(st.s, retention)), 1, maxDays);
  // Again: bring it back in ten minutes; everything else on a day boundary (4 a.m. local)
  st.due = grade === Again ? now + 10 * 60000 : startOfDay(now + days * DAY);
  return st;
}

export function startOfDay(ms) {
  const d = new Date(ms); d.setHours(4, 0, 0, 0);
  if (d.getTime() > ms) d.setDate(d.getDate() - 1);
  return d.getTime();
}

export const isMastered = (st) => st && st.s >= 21 && st.reps >= 4;

// Turn an answer into a grade: wrong = Again, slow or hinted = Hard, quick = Easy.
export function gradeFor(correct, ms, hinted = false) {
  if (!correct) return Again;
  if (hinted || ms > 12000) return Hard;
  if (ms < 3500) return Easy;
  return Good;
}
