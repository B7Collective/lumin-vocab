// Lumin Vocab: app data model on top of the record store.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as store from "./store.js";
import * as srs from "./srs.js";

export const LEVELS = [
  { name: "Sprout", ages: "Ages 5 to 8", sample: "gentle" },
  { name: "Explorer", ages: "Ages 8 to 11", sample: "curious" },
  { name: "Scholar", ages: "Ages 11 to 14", sample: "meticulous" },
  { name: "Wordsmith", ages: "Teens and adults", sample: "ineffable" },
];
export const ROLES = { kid: "Kid", teen: "Teen", adult: "Adult" };
export const COLORS = [
  { bg: "#1F6F78", fg: "#FFFFFF" }, { bg: "#B4527A", fg: "#FFFFFF" }, { bg: "#F2B544", fg: "#18212B" }, { bg: "#E86A4F", fg: "#18212B" },
  { bg: "#2F5D9E", fg: "#FFFFFF" }, { bg: "#3D7A4F", fg: "#FFFFFF" }, { bg: "#6B4FA0", fg: "#FFFFFF" }, { bg: "#4A5866", fg: "#FFFFFF" },
];
export const THEMES = [
  ["morning", "Morning", "#EEF2F4", "#18212B"], ["sunny", "Sunny", "#FFF1D6", "#18212B"], ["garden", "Garden", "#E1EBE0", "#1E2B20"], ["harbor", "Harbor", "#DCEAF4", "#13283A"],
  ["blossom", "Blossom", "#F6E3E0", "#3A1F1C"], ["night", "Night", "#141A21", "#E9EEF2"], ["dusk", "Dusk", "#2E2638", "#F2ECF7"], ["forest", "Forest", "#1F3B36", "#EAF3EF"],
];
export const DARK = new Set(["night", "dusk", "forest"]);

// ---- Words ---------------------------------------------------------------
export let WORDS = [], BY = new Map(), TOPICS = [];
export async function loadWords() {
  const res = await fetch("/data/words.json");
  WORDS = await res.json();
  WORDS.forEach((w, n) => { w.n = n; if (w.d) w.d = w.d[0].toUpperCase() + w.d.slice(1); BY.set(w.w, w); });
  TOPICS = [...new Set(WORDS.map(w => w.t))].sort();
  return WORDS;
}
export function lookup(word) {
  const custom = store.all("custom").find(c => c.w === word);
  return BY.get(word) || (custom && { w: custom.w, p: custom.p || "word", d: custom.d, e: custom.e || "", l: 3, t: "My words", f: [], m: [], s: "", custom: true });
}

// ---- Profiles ------------------------------------------------------------
export const profiles = () => store.all("profile").sort((a, b) => a.created - b.created);
export const profile = (id) => store.get("profile:" + id);
export function saveProfile(p) { return store.put("profile", "profile:" + p.id, p); }
export function newProfile(fields) {
  const existing = profiles();
  const p = {
    id: store.uuid(), name: "", role: "adult", level: 3, topics: [], goal: 5, reviewSize: 20, spelling: true,
    color: existing.length % COLORS.length, theme: "morning", scale: 1, dark: "device", calm: false,
    readAloud: false, voice: "", rate: 0.9, manager: existing.length === 0, created: Date.now(), ...fields,
  };
  return saveProfile(p);
}
export function removeProfile(id) {
  store.remove("profile:" + id);
  for (const r of store.raw()) if (!r.del && r.data && r.data.pid === id) store.remove(r.id);
}
export const isKid = (p) => p && (p.role === "kid" || p.level <= 1);

// ---- Family settings (PIN) ------------------------------------------------
export const family = () => store.get("family") || { pin: null, lockParents: true };
export async function hashPin(pin, salt) {
  const s = salt || [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode("lumin-pin/" + s), iterations: 100000 }, key, 256);
  return { salt: s, hash: [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("") };
}
export async function setPin(pin) { const f = family(); store.put("family", "family", { ...f, pin: pin ? await hashPin(pin) : null }); }
export async function checkPin(pin) { const f = family(); if (!f.pin) return true; return (await hashPin(pin, f.pin.salt)).hash === f.pin.hash; }
// Slow down guessing: after 3 wrong tries, wait 30 seconds, doubling each time up to 15 minutes (kept on this device)
const PIN_KEY = "lumin-pin-tries";
export function pinWait() { try { const t = JSON.parse(localStorage.getItem(PIN_KEY) || "{}"); return Math.max(0, (t.until || 0) - Date.now()); } catch { return 0; } }
export async function tryPin(pin) {
  const wait = pinWait(); if (wait) return { ok: false, wait };
  const ok = await checkPin(pin);
  let t = {}; try { t = JSON.parse(localStorage.getItem(PIN_KEY) || "{}"); } catch {}
  if (ok) { try { localStorage.removeItem(PIN_KEY); } catch {} return { ok: true }; }
  t.fails = (t.fails || 0) + 1;
  if (t.fails >= 3) t.until = Date.now() + Math.min(15 * 60000, 30000 * 2 ** (t.fails - 3));
  try { localStorage.setItem(PIN_KEY, JSON.stringify(t)); } catch {}
  return { ok: false, wait: t.until ? Math.max(0, t.until - Date.now()) : 0 };
}

// ---- Cards (one per profile and word) ---------------------------------------
const cid = (pid, w) => `card:${pid}:${w}`;
export const card = (pid, w) => store.get(cid(pid, w));
export const cards = (pid) => store.all("card").filter(c => c.pid === pid);
export function setCard(pid, w, patch) {
  const cur = card(pid, w) || { pid, w, st: "seen", fav: false, srs: null, seenAt: Date.now() };
  return store.put("card", cid(pid, w), { ...cur, ...patch });
}
export function restoreCard(pid, w, prev) { if (prev) store.put("card", cid(pid, w), prev); else store.remove(cid(pid, w)); }
export function learn(pid, w) { const c = card(pid, w); return setCard(pid, w, { st: "learning", actAt: Date.now(), srs: c && c.srs ? c.srs : { ...srs.newState(), due: Date.now() + 10 * 60000 } }); }
export function know(pid, w) { return setCard(pid, w, { st: "known", actAt: Date.now() }); }
export function seen(pid, w) { const c = card(pid, w); if (!c) setCard(pid, w, { st: "seen", seenAt: Date.now() }); else store.update("card", cid(pid, w), { seenAt: Date.now() }); }
export function toggleFav(pid, w) { const c = card(pid, w); return setCard(pid, w, { fav: !(c && c.fav) }).fav; }
export function grade(pid, w, g) { const c = card(pid, w) || learn(pid, w); return setCard(pid, w, { st: "learning", srs: srs.review(c.srs || srs.newState(), g) }); }

export function todayCount(pid) {
  const start = srs.startOfDay(Date.now());
  return cards(pid).filter(c => (c.st === "learning" || c.st === "known") && (c.actAt || 0) >= start).length;
}
export function due(pid, now = Date.now()) {
  return cards(pid).filter(c => c.st === "learning" && c.srs && c.srs.due <= now).sort((a, b) => a.srs.due - b.srs.due);
}
export function nextDue(pid) {
  const l = cards(pid).filter(c => c.st === "learning" && c.srs).map(c => c.srs.due).sort((a, b) => a - b);
  return l[0] || 0;
}
export function stats(pid) {
  const cs = cards(pid);
  return {
    learning: cs.filter(c => c.st === "learning" && !srs.isMastered(c.srs)).length,
    mastered: cs.filter(c => c.st === "learning" && srs.isMastered(c.srs)).length,
    known: cs.filter(c => c.st === "known").length,
    seen: cs.length,
  };
}

// Deterministic shuffle so each person gets their own order, stable across devices.
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
// Which levels a category can draw from, so kids never see grown-up words
export function levelsFor(p) { return p.level <= 1 ? [0, 1] : p.level === 2 ? [1, 2, 3] : [2, 3]; }
export function topicCounts(p) {
  const allowed = levelsFor(p), out = {};
  for (const w of WORDS) if (allowed.includes(w.l)) out[w.t] = (out[w.t] || 0) + 1;
  return out;
}
export function queue(p) {
  const done = new Set(cards(p.id).map(c => c.w));
  const rnd = seeded(p.id);
  if (p.feedSet) {
    const allowed = p.feedSet === "funny" ? [0, 1, 2, 3] : levelsFor(p);
    return WORDS.filter(w => w.x && w.x.includes(p.feedSet) && allowed.includes(w.l) && !done.has(w.w)).map(w => [rnd(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  if (p.feedTopic) {
    const allowed = levelsFor(p);
    return WORDS.filter(w => w.t === p.feedTopic && allowed.includes(w.l) && !done.has(w.w))
      .map(w => [Math.abs(w.l - p.level) + rnd() * 0.9, w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  const at = WORDS.filter(w => w.l === p.level && !done.has(w.w));
  const below = p.level > 0 ? WORDS.filter(w => w.l === p.level - 1 && !done.has(w.w)) : [];
  // Older levels lead with the more familiar of the hard words, with plenty of variety mixed in
  const keyed = (arr) => arr.map(w => [p.level >= 2 ? -(w.z || 2.5) * 0.8 + rnd() * 1.8 : rnd(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  let main = keyed(at);
  if (p.topics && p.topics.length) {
    const fav = main.filter(w => p.topics.includes(w.t)), rest = main.filter(w => !p.topics.includes(w.t));
    main = []; while (fav.length || rest.length) { if (fav.length) main.push(fav.shift()); if (fav.length) main.push(fav.shift()); if (rest.length) main.push(rest.shift()); }
  }
  // When a level runs out, keep going with the level below so the feed never ends abruptly
  return main.length ? main : keyed(below);
}

// ---- Collections and custom words ----------------------------------------
export const collections = (pid) => store.all("collection").filter(c => c.pid === pid || c.shared).sort((a, b) => a.created - b.created);
export function saveCollection(c) { return store.put("collection", "col:" + c.id, c); }
export function newCollection(pid, name, shared = false) { return saveCollection({ id: store.uuid(), pid, name, words: [], shared, created: Date.now() }); }
export function toggleInCollection(col, w) {
  const words = col.words.includes(w) ? col.words.filter(x => x !== w) : [...col.words, w];
  return saveCollection({ ...col, words });
}
export const customWords = (pid) => store.all("custom").filter(c => c.pid === pid);
export function addCustom(pid, fields) {
  const id = store.uuid();
  store.put("custom", "cw:" + id, { id, pid, ...fields, created: Date.now() });
  learn(pid, fields.w);
}

// ---- Review exercises -----------------------------------------------------
function pickDistractors(word, n, field) {
  const pool = WORDS.filter(x => x.w !== word.w && x.l === Math.min(word.l, 3) && x.p === word.p && x[field] !== word[field]);
  const out = new Set();
  while (out.size < n && pool.length) out.add(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return [...out];
}
export const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function blankExample(word) {
  if (!word.e) return null;
  const re = new RegExp(`(^|[^\\w])${escapeRe(word.w)}(?![\\w])`, "i");
  if (!re.test(word.e)) return null;
  return word.e.replace(re, "$1_____");
}
export function exercise(p, c, forceType) {
  const word = lookup(c.w); if (!word) return null;
  const kid = isKid(p), n = kid ? 2 : 3, reps = (c.srs && c.srs.reps) || 0;
  let type = forceType;
  if (!type) {
    const options = ["meaning"];
    if (reps >= 1) options.push("word");
    if (reps >= 2 && blankExample(word)) options.push("blank");
    if (reps >= 3 && !kid && p.spelling) options.push("spell");
    type = reps === 0 ? "meaning" : options[1 + Math.floor(Math.random() * (options.length - 1))] || "meaning";
  }
  const shuffle = (a) => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  if (type === "spell") return { type, word, prompt: word.d };
  if (type === "meaning") return { type, word, prompt: word.w, options: shuffle([word, ...pickDistractors(word, n, "d")]).map(x => ({ text: x.d, right: x.w === word.w })) };
  const prompt = type === "blank" ? blankExample(word) : word.d;
  return { type, word, prompt, options: shuffle([word, ...pickDistractors(word, n, "w")]).map(x => ({ text: x.w, right: x.w === word.w })) };
}

// ---- Activity and streaks (kept on the profile, so they sync) --------------------
const dayKey = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function markActive(pid) {
  const p = profile(pid); if (!p) return;
  const days = p.days || [], today = dayKey();
  if (days[days.length - 1] === today) return;
  saveProfile({ ...p, days: [...days.filter((d) => d !== today), today].slice(-400) });
}
export function streak(p) {
  const set = new Set((p && p.days) || []);
  let n = 0, t = Date.now();
  if (!set.has(dayKey(t))) t -= 86400000; // a streak stays alive until the end of today
  while (set.has(dayKey(t))) { n++; t -= 86400000; }
  return n;
}
// The current week, Sunday first: [{ label, active, today }]
export function week(p) {
  const set = new Set((p && p.days) || []), now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { label, active: set.has(dayKey(d.getTime())), today: i === now.getDay(), future: d > now };
  });
}

// ---- Journey: a long walk, one chapter a day ------------------------------------
// Chapters of six new words, most useful first. Every fifth stop is a lookout that looks back over the
// last four chapters instead of adding words. Ten stops make a region, each with its own scene.
export const CHAPTER_SIZE = 6, REGION_SIZE = 10;
export const LANDMARKS = [
  ["gate", "The Village Gate", "Every journey starts at a gate. Six words to carry with you."],
  ["bridge", "The Stone Bridge", "Old stones, worn smooth by travelers who came before you."],
  ["lighthouse", "The Lighthouse", "Keepers once named every ship that passed. Now you name words."],
  ["windmill", "The Windmill", "Slow sails, steady work. Words turn into meaning here."],
  ["observatory", "The Observatory", "Look closer and the faint ones come into focus."],
  ["library", "The Library Tower", "Floor after floor of books. A few more words for your shelf."],
  ["harbor", "The Harbor", "Boats come home with whatever they found. So do you."],
  ["summit", "The Mountain Pass", "A steeper climb, and a wider view at the top."],
  ["treehouse", "The Treehouse", "Somewhere to rest above the trail, with words for company."],
  ["greenhouse", "The Greenhouse", "Things grow here when they're tended. Your words too."],
  ["clocktower", "The Clock Tower", "Time is what makes words stick. You've been giving them plenty."],
  ["castle", "The Castle", "A long road ends at the castle, and a new one begins beyond it."],
];
export const REGIONS = [
  ["lavender", "The Lavender Fields"], ["forest", "The Misty Forest"], ["harbor", "The Quiet Harbor"], ["library", "The Old Library"],
  ["conservatory", "The Glass Garden"], ["aurora", "The Northern Lake"], ["fireside", "The Winter Lodge"], ["attic", "The Stargazer's Attic"],
];
export const STEPS = [
  { key: "learn", name: "Meet the words", icon: "flashcards" },
  { key: "meaning", name: "What it means", icon: "match" },
  { key: "gap", name: "Fill the gap", icon: "gap" },
  { key: "spell", name: "Build the word", icon: "unscramble" },
  { key: "mix", name: "Mixed practice", icon: "shuffle" },
  { key: "test", name: "Chapter check", icon: "perfect" },
];
export const LOOKOUT_STEPS = [
  { key: "meaning", name: "Look back", icon: "review" },
  { key: "gap", name: "Fill the gap", icon: "gap" },
  { key: "spell", name: "Build the word", icon: "unscramble" },
  { key: "test", name: "Lookout check", icon: "perfect" },
];
const chapterCache = new Map();
// [{ words, lookout, landmark: [img, name, line] }]
export function chapterWords(level) {
  if (chapterCache.has(level)) return chapterCache.get(level);
  const list = WORDS.filter((w) => w.l === level && !(w.x && w.x.includes("funny")));
  // kid lists are already ordered by hand; older levels go from the most common word to the rarest
  const ordered = level <= 1 ? list : [...list].sort((a, b) => (b.z || 0) - (a.z || 0));
  const chapters = [];
  let lm = 0, since = [];
  for (let i = 0; i < ordered.length; i += CHAPTER_SIZE) {
    const words = ordered.slice(i, i + CHAPTER_SIZE);
    chapters.push({ words, lookout: false, landmark: LANDMARKS[lm++ % LANDMARKS.length] });
    since.push(...words);
    if (chapters.length % 5 === 4 && i + CHAPTER_SIZE < ordered.length) {
      const rnd = seeded("lookout" + level + chapters.length);
      const pick = since.map((w) => [rnd(), w]).sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => x[1]);
      chapters.push({ words: pick, lookout: true, landmark: ["summit", "A Lookout", "Stop and look back at how far you've come. These words are from the road behind you."] });
      since = [];
    }
  }
  chapterCache.set(level, chapters);
  return chapters;
}
export const regionOf = (ch) => REGIONS[Math.floor(ch / REGION_SIZE) % REGIONS.length];
export const stepsFor = (chapter) => (chapter && chapter.lookout ? LOOKOUT_STEPS : STEPS);
export function journeyState(p) { return { ch: 0, step: 0, stars: {}, log: [], openOn: null, ...((p.journey && p.journey[p.level]) || {}) }; }
// The next chapter opens the day after you finish one
export const journeyOpen = (st) => !st.openOn || dayKey() >= st.openOn;
export const journeyDays = (st) => new Set((st.log || []).map((x) => dayKey(x.at)).concat(st.started ? [dayKey(st.started)] : [])).size;
export function advanceJourney(pid, ch, step, stars) {
  const p = profile(pid); const cur = journeyState(p);
  const next = { ...cur, stars: { ...(cur.stars || {}) }, log: [...(cur.log || [])], started: cur.started || Date.now() };
  if (stars != null) next.stars[`${ch}.${step}`] = Math.max(stars, next.stars[`${ch}.${step}`] || 0);
  const steps = stepsFor(chapterWords(p.level)[ch]);
  if (ch === cur.ch && step === cur.step) {
    if (step + 1 < steps.length) next.step = step + 1;
    else {
      const all = steps.map((_, k) => next.stars[`${ch}.${k}`] || 1);
      next.log.push({ ch, at: Date.now(), stars: Math.round(all.reduce((a, b) => a + b, 0) / all.length) });
      next.ch = ch + 1; next.step = 0; next.openOn = dayKey(Date.now() + 86400000);
    }
  }
  saveProfile({ ...p, journey: { ...(p.journey || {}), [p.level]: next } });
  return next;
}

// ---- Practice questions -------------------------------------------------------
const shuffled = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
export function distractors(word, n, field) {
  const same = WORDS.filter((x) => x.w !== word.w && x.l === Math.min(word.l, 3) && x[field] && x[field] !== word[field]);
  const pos = same.filter((x) => x.p === word.p);
  const pool = pos.length >= n * 3 ? pos : same;
  const out = new Set();
  while (out.size < n && out.size < pool.length) out.add(pool[Math.floor(Math.random() * pool.length)]);
  return [...out];
}
// Scramble letters so the result never matches the word itself
export function scramble(w) {
  const letters = w.toLowerCase().split("");
  if (new Set(letters).size < 2) return letters;
  let s; do { s = shuffled(letters); } while (s.join("") === letters.join(""));
  return s;
}
// One question of a given kind for a word. Kinds: meaning, word, gap, spell, unscramble, flash, listen
export function question(word, kind, kid = false) {
  const n = kid ? 2 : 3;
  if (kind === "gap" && !blankExample(word)) kind = "word";
  if (kind === "listen" && !(typeof speechSynthesis !== "undefined")) kind = "meaning";
  if ((kind === "spell" || kind === "unscramble") && !/^[a-z]+$/i.test(word.w)) kind = "word";
  if (kind === "spell" && kid) kind = "unscramble";
  if (kind === "flash") return { kind, word };
  if (kind === "spell") return { kind, word, prompt: word.d };
  if (kind === "unscramble") return { kind, word, prompt: word.d, tiles: scramble(word.w) };
  if (kind === "meaning" || kind === "listen") return { kind, word, prompt: word.w, options: shuffled([word, ...distractors(word, n, "d")]).map((x) => ({ text: x.d, right: x.w === word.w })) };
  const prompt = kind === "gap" ? blankExample(word) : word.d;
  return { kind, word, prompt, options: shuffled([word, ...distractors(word, n, "w")]).map((x) => ({ text: x.w, right: x.w === word.w })) };
}
// A mix that eases in: meaning first, then harder kinds as a word gets familiar
export function mixedKind(word, reps, kid) {
  const kinds = ["meaning", "word"];
  if (reps >= 1 && blankExample(word)) kinds.push("gap");
  if (reps >= 2) kinds.push(kid ? "unscramble" : "spell");
  if (reps >= 1) kinds.push("listen");
  return reps === 0 ? "meaning" : kinds[Math.floor(Math.random() * kinds.length)];
}
// Words a person can practice: what they're learning, then their journey words, then their level
export function practicePool(p, size = 10, topic = null) {
  const mine = cards(p.id).filter((c) => c.st === "learning").map((c) => lookup(c.w)).filter(Boolean);
  let pool = shuffled(topic ? mine.filter((w) => w.t === topic) : mine);
  if (pool.length < size) {
    const j = journeyState(p), chs = chapterWords(p.level).slice(0, j.ch + 1).flatMap((c) => c.words);
    const seenW = new Set(pool.map((w) => w.w));
    pool = pool.concat(shuffled(chs.filter((w) => !seenW.has(w.w) && (!topic || w.t === topic))));
  }
  if (pool.length < size) {
    const have = new Set(pool.map((w) => w.w)), allowed = levelsFor(p);
    pool = pool.concat(shuffled(WORDS.filter((w) => allowed.includes(w.l) && !have.has(w.w) && (!topic || w.t === topic))).slice(0, size));
  }
  return pool.slice(0, size);
}
// Find your level: three words from each level, easiest first
export function placementWords() {
  return [0, 1, 2, 3].flatMap((l) => shuffled(WORDS.filter((w) => w.l === l && !(w.x && w.x.includes("funny")) && (w.z || 3) < (l < 2 ? 6 : 3.6))).slice(0, 3));
}
