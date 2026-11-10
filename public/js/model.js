// Lumin Vocab: app data model on top of the record store.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as store from "./store.js";
import * as srs from "./srs.js";

// Six levels in three groups. The difficulty slider shows the groups as bands, two levels each.
export const GROUPS = [
  { key: "kids", name: "Kids", ages: "5 to 12", levels: [0, 1] },
  { key: "teens", name: "Teens", ages: "12 to 18", levels: [2, 3] },
  { key: "adults", name: "Adults", ages: "18 and up", levels: [4, 5] },
];
export const LEVELS = [
  { name: "Sprout", ages: "Ages 5 to 8", group: 0, sample: "gentle", about: "First big words, simple sounds, read aloud" },
  { name: "Explorer", ages: "Ages 8 to 12", group: 0, sample: "majestic", about: "Words for curious readers and big questions" },
  { name: "Scholar", ages: "Ages 12 to 15", group: 1, sample: "ambiguous", about: "Words from class, good books and the news" },
  { name: "Wordsmith", ages: "Ages 15 to 18", group: 1, sample: "meticulous", about: "Words that sharpen essays, tests and arguments" },
  { name: "Academic", ages: "Adults", group: 2, sample: "fortuitous", about: "Precise, less common words for work, ideas and good writing" },
  { name: "Philosopher", ages: "Adults", group: 2, sample: "ineffable", about: "Rare, literary and beautiful words" },
];
export const MAX_LEVEL = LEVELS.length - 1;
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
// MAIN: the words of the six levels. Trail-only words (c) live in side trails, not on the main road.
export let WORDS = [], MAIN = [], BY = new Map(), TOPICS = [], TRAILS = [];
export async function loadWords() {
  const [res, tr] = await Promise.all([fetch("/data/words.json"), fetch("/data/trails.json").catch(() => null)]);
  WORDS = await res.json();
  WORDS.forEach((w, n) => { w.n = n; if (w.d) w.d = w.d[0].toUpperCase() + w.d.slice(1); BY.set(w.w, w); });
  MAIN = WORDS.filter(w => !w.c);
  TOPICS = [...new Set(MAIN.map(w => w.t))].sort();
  try { TRAILS = tr && tr.ok ? await tr.json() : []; } catch { TRAILS = []; }
  chapterCache.clear();
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
    id: store.uuid(), name: "", role: "adult", level: 4, v3: 1, topics: [], goal: 5, reviewSize: 20, spelling: true,
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
// Version 3 split teens and adults: adults still on Wordsmith move up to Academic once
export function migrate(p) {
  if (!p || p.v3) return p;
  const next = { ...p, v3: 1 };
  if (p.role === "adult" && p.level === 3 && !(p.journey && p.journey[3] && p.journey[3].ch > 0)) next.level = 4;
  return saveProfile(next);
}

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
export function levelsFor(p) { return p.level <= 1 ? [0, 1] : [p.level - 1, p.level, p.level + 1].filter((l) => l <= MAX_LEVEL); }
export function topicCounts(p) {
  const allowed = levelsFor(p), out = {};
  for (const w of MAIN) if (allowed.includes(w.l)) out[w.t] = (out[w.t] || 0) + 1;
  return out;
}
export function queue(p) {
  const done = new Set(cards(p.id).map(c => c.w));
  const rnd = seeded(p.id);
  if (p.feedSet) {
    const t = trail(p.feedSet);
    if (t) return trailWords(t, p).filter(w => !done.has(w.w));
    const allowed = p.feedSet === "funny" ? [0, 1, 2, 3] : levelsFor(p);
    return MAIN.filter(w => w.x && w.x.includes(p.feedSet) && allowed.includes(w.l) && !done.has(w.w)).map(w => [rnd(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  if (p.feedTopic) {
    const allowed = levelsFor(p);
    return MAIN.filter(w => w.t === p.feedTopic && allowed.includes(w.l) && !done.has(w.w))
      .map(w => [Math.abs(w.l - p.level) + rnd() * 0.9, w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  const at = MAIN.filter(w => w.l === p.level && !done.has(w.w));
  const below = p.level > 0 ? MAIN.filter(w => w.l === p.level - 1 && !done.has(w.w)) : [];
  // Any order, with a light touch: the youngest teen level eases in with its more familiar words; at every
  // level the very common ones wait at the back, so the first words you meet are the ones worth learning
  const keyed = (arr) => arr.map(w => [(p.level === 2 ? -(w.z || 2.5) * 0.3 : 0) + ((w.z || 0) >= 4.2 ? 2 : 0) + rnd() * 1.8, w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
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

// ---- Journey: the Lantern Road ---------------------------------------------------
// Every word you learn is a light for your lantern. Chapters of six new words, one chapter a day, most useful first.
// Every fifth stop is a campfire that looks back over the last four chapters. Ten stops make a region, each with
// its own scene, a keeper who greets you, and a keepsake to find at every landmark.
export const CHAPTER_SIZE = 6, REGION_SIZE = 10;
export const LANDMARKS = [
  ["gate", "The Village Gate", "Every road starts at a gate. The gatekeeper hands you an unlit lantern and six words to light it."],
  ["bridge", "The Stone Bridge", "Old stones, worn smooth by travelers before you. The troll here only lets you pass if you know your words."],
  ["lighthouse", "The Lighthouse", "Keepers once named every ship that passed. Tonight the lamp is yours to light."],
  ["windmill", "The Windmill", "Slow sails, steady work. The miller grinds words into meaning."],
  ["observatory", "The Observatory", "Look closer and the faint ones come into focus. Each star here has a name."],
  ["library", "The Library Tower", "Floor after floor of books. A few more words for your shelf, and a ladder to the top."],
  ["harbor", "The Harbor", "Boats come home with whatever they found at sea. So do you."],
  ["summit", "The Mountain Pass", "A steeper climb, thinner air, and a wider view at the top."],
  ["treehouse", "The Treehouse", "A rope ladder, a lantern hook, and six words waiting in the branches."],
  ["greenhouse", "The Greenhouse", "Things grow here when they're tended. Words too."],
  ["clocktower", "The Clock Tower", "Time is what makes words stick. The old clock keeps count of yours."],
  ["castle", "The Castle", "A long road ends at the castle gate, and a new one begins beyond it."],
];
// [scene, name, keeper, greeting, keeper picture]
export const REGIONS = [
  ["lavender", "The Lavender Fields", "a sleepy fox", "The fox yawns, points down the purple rows, and tells you the first words are the friendliest.", "fox"],
  ["forest", "The Misty Forest", "an old owl", "The owl blinks from a branch and lifts its little lantern. Words are easier to find in the fog than you'd think, it says.", "owl"],
  ["harbor", "The Quiet Harbor", "a gull with one gray feather", "The gull trades words for crumbs. Fair is fair.", "gull"],
  ["library", "The Old Library", "a mouse in spectacles", "The mouse is hugging a book twice its size. It hands you one and says to start on page one.", "mouse"],
  ["conservatory", "The Glass Garden", "a tortoise who grows ferns", "The tortoise is in no hurry. Neither are words that last.", "tortoise"],
  ["aurora", "The Northern Lake", "a white hare", "The hare says the sky lights up when travelers learn something new. Let's test that.", "hare"],
  ["fireside", "The Winter Lodge", "a bear in a knitted scarf", "The bear pours you cocoa and pulls a chair closer to the fire. Stay a while.", "bear"],
  ["attic", "The Stargazer's Attic", "a moth with silver wings", "The moth circles your lantern. It's the brightest thing up here now.", "moth"],
];
// Four more regions, slotted between the first eight
REGIONS.splice(4, 0, ["summit", "The High Pass", "a mountain goat with a brass bell", "The goat rings its bell twice: once for every word, it says, and once for the view.", "goat"]);
REGIONS.splice(7, 0, ["bridge", "The Old Stone Bridge", "a heron fishing under the arch", "The heron doesn't look up. Patience, it seems to say, catches more than hurry.", "heron"]);
REGIONS.splice(10, 0, ["village", "The Snowy Village", "a robin on a lamppost", "The robin hops along the lane, lighting the way to a warm window.", "robin"]);
REGIONS.push(["cliffs", "The Lighthouse Cliffs", "a puffin with a striped beak", "The puffin waddles to the cliff edge and points at the lighthouse. Nearly home, it says.", "puffin"]);
// Something found at each stop, kept in your passport
export const KEEPSAKES = ["a brass key", "a pressed violet", "a sea-glass marble", "a striped feather", "a map with a coffee ring", "a smooth river stone", "a tiny bell",
  "a paper crane", "a copper coin with a hole", "an acorn cap", "a ribbon bookmark", "a jar of fireflies (let go at dawn)", "a postcard from nowhere", "a sprig of thyme",
  "a whistle carved from willow", "a button with four holes", "a seashell that hums", "a candle stub", "a compass that points home", "a clay bead", "a star chart",
  "a lucky horseshoe nail", "a wax seal", "a pinecone", "a spool of red thread", "a folded riddle", "a moth's dropped scale", "a snow globe", "a wooden whistle", "a lantern wick"];
export const STEPS = [
  { key: "learn", name: "Meet the words", icon: "flashcards", line: "Six new lights for your lantern." },
  { key: "meaning", name: "What they mean", icon: "match", line: "Match each word to its meaning." },
  { key: "gap", name: "Fill the gaps", icon: "gap", line: "Fresh sentences, missing a word." },
  { key: "spell", name: "Build them", icon: "unscramble", line: "Put the letters back in order." },
  { key: "mix", name: "Mix it up", icon: "shuffle", line: "A bit of everything." },
  { key: "test", name: "The keeper's riddle", icon: "perfect", line: "Answer the keeper to pass the landmark." },
];
export const LOOKOUT_STEPS = [
  { key: "usage", name: "Campfire stories", icon: "review", line: "Which sentence gets the word right?" },
  { key: "gap", name: "Fill the gaps", icon: "gap", line: "Words from the road behind you." },
  { key: "spell", name: "Build them", icon: "unscramble", line: "Letters, scattered by the wind." },
  { key: "test", name: "Lookout check", icon: "perfect", line: "Show the road you've walked." },
];
export const TRAIL_STEPS = [
  { key: "learn", name: "Meet the words", icon: "flashcards", line: "A handful of words for this trail." },
  { key: "mix", name: "Play with them", icon: "shuffle", line: "Every kind of question." },
  { key: "test", name: "Trail marker", icon: "perfect", line: "Pass it to reach the next marker." },
];
const SPELL_STEPS = [
  { key: "learn", name: "Meet the words", icon: "flashcards", line: "Read each word and its trick." },
  { key: "spell", name: "Build them", icon: "unscramble", line: "Put the letters back in order." },
  { key: "spellit", name: "Spell them", icon: "spelling", line: "Type each word from memory." },
  { key: "test", name: "Trail marker", icon: "perfect", line: "Pass it to reach the next marker." },
];
const MIXUP_STEPS = [
  { key: "learn", name: "Meet the pairs", icon: "flashcards", line: "Two look-alikes at a time." },
  { key: "mixup", name: "Which one?", icon: "match", line: "Pick the right one for each sentence." },
  { key: "test", name: "Trail marker", icon: "perfect", line: "Pass it to reach the next marker." },
];
const chapterCache = new Map();
// [{ words, lookout, landmark: [img, name, line] }]
export function chapterWords(level) {
  if (chapterCache.has(level)) return chapterCache.get(level);
  const list = MAIN.filter((w) => w.l === level && !(w.x && w.x.includes("funny")));
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
      chapters.push({ words: pick, lookout: true, landmark: ["summit", "A Campfire", "Sit by the fire and tell the road's stories. These words are from the stretch behind you."] });
      since = [];
    }
  }
  chapterCache.set(level, chapters);
  return chapters;
}
export const regionOf = (ch) => REGIONS[Math.floor(ch / REGION_SIZE) % REGIONS.length];
export const keepsakeOf = (ch, level) => KEEPSAKES[(ch * 7 + level * 3) % KEEPSAKES.length];
export const stepsFor = (chapter, trailKey) => trailKey === "spelling" ? SPELL_STEPS : trailKey === "mixups" ? MIXUP_STEPS : trailKey ? TRAIL_STEPS : (chapter && chapter.lookout ? LOOKOUT_STEPS : STEPS);

// Side trails: short themed walks with no daily lock
export const trail = (key) => TRAILS.find((t) => t.key === key);
const TRAIL_ORDER = ["decades", "spelling", "myths", "sounds", "mixups", "borrowed", "conversation", "kind", "space", "weather", "tasting", "kitchen", "games", "tech", "money", "airport", "office", "doctor", "courtroom"];
export function trailsFor(p) {
  const kid = isKid(p), rank = (k) => { const i = TRAIL_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  return [...TRAILS].sort((x, y) => rank(x.key) - rank(y.key)).filter((t) => t.aud === "all" || (t.aud === "teen" && !kid) || (t.aud === "adult" && !kid && (p.role === "adult" || p.level >= 4)))
    .filter((t) => trailWords(t, p).length >= 6);
}
// Kids see the gentler words of a trail; everyone else sees all of it, easiest first
export function trailWords(t, p) {
  const kid = isKid(p);
  return t.words.map((w) => BY.get(w)).filter((w) => w && (!kid || w.l <= 2));
}
export function trailChapters(key, p) {
  const t = trail(key); if (!t) return [];
  const ws = trailWords(t, p);
  // mix-ups stay in pairs; others stay in the order they were written
  const size = key === "mixups" ? 4 : CHAPTER_SIZE, out = [];
  for (let i = 0; i < ws.length; i += size) { const words = ws.slice(i, i + size); if (words.length >= 2) out.push({ words, lookout: false, landmark: null }); }
  if (out.length > 1 && out[out.length - 1].words.length < 3) { const last = out.pop(); out[out.length - 1].words.push(...last.words); }
  return out;
}

export function journeyState(p, trailKey) {
  const src = trailKey ? (p.trails && p.trails[trailKey]) : (p.journey && p.journey[p.level]);
  return { ch: 0, step: 0, stars: {}, log: [], openOn: null, ...(src || {}) };
}
// The next main-road chapter opens the day after you finish one. Trails never wait.
export const journeyOpen = (st, trailKey) => trailKey || !st.openOn || dayKey() >= st.openOn;
export const journeyDays = (st) => new Set((st.log || []).map((x) => dayKey(x.at)).concat(st.started ? [dayKey(st.started)] : [])).size;
export function advanceJourney(pid, ch, step, stars, trailKey) {
  const p = profile(pid); const cur = journeyState(p, trailKey);
  const next = { ...cur, stars: { ...(cur.stars || {}) }, log: [...(cur.log || [])], started: cur.started || Date.now() };
  if (stars != null) next.stars[`${ch}.${step}`] = Math.max(stars, next.stars[`${ch}.${step}`] || 0);
  const chapters = trailKey ? trailChapters(trailKey, p) : chapterWords(p.level);
  const steps = stepsFor(chapters[ch], trailKey);
  if (ch === cur.ch && step === cur.step) {
    if (step + 1 < steps.length) next.step = step + 1;
    else {
      const all = steps.map((_, k) => next.stars[`${ch}.${k}`] || 1);
      next.log.push({ ch, at: Date.now(), stars: Math.round(all.reduce((a, b) => a + b, 0) / all.length) });
      next.ch = ch + 1; next.step = 0;
      if (!trailKey) next.openOn = dayKey(Date.now() + 86400000);
    }
  }
  if (trailKey) saveProfile({ ...p, trails: { ...(p.trails || {}), [trailKey]: next } });
  else saveProfile({ ...p, journey: { ...(p.journey || {}), [p.level]: next } });
  return next;
}

// ---- Practice questions -------------------------------------------------------
const shuffled = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
export function distractors(word, n, field) {
  const lv = word.l == null ? 3 : word.l;
  let same = WORDS.filter((x) => x.w !== word.w && x.l === lv && x[field] && x[field] !== word[field] && x.cf !== word.w && word.cf !== x.w);
  if (same.length < n * 4) same = same.concat(WORDS.filter((x) => x.w !== word.w && Math.abs(x.l - lv) === 1 && x[field] && x[field] !== word[field]));
  const pos = same.filter((x) => x.p === word.p);
  const pool = pos.length >= n * 3 ? pos : same;
  const out = new Set();
  let guard = 0;
  while (out.size < n && out.size < pool.length && guard++ < 200) out.add(pool[Math.floor(Math.random() * pool.length)]);
  return [...out];
}
// Scramble letters so the result never matches the word itself
export function scramble(w) {
  const letters = w.toLowerCase().split("");
  if (new Set(letters).size < 2) return letters;
  let s; do { s = shuffled(letters); } while (s.join("") === letters.join(""));
  return s;
}
export const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w) => new RegExp(`(^|[^\\w])${escapeRe(w)}(?![\\w])`, "i");
// Sentences for a word. The Words screen shows the first; games prefer the others so you meet the word somewhere new.
export const sentences = (word) => [word.e, ...(word.e2 ? [].concat(word.e2) : [])].filter((x) => x && wordRe(word.w).test(x));
export function gapSentence(word, fresh = true) {
  const all = sentences(word); if (!all.length) return null;
  const pick = fresh && all.length > 1 ? pickOne(all.slice(1)) : pickOne(all);
  return pick.replace(wordRe(word.w), "$1_____");
}
export const blankExample = (word) => gapSentence(word, false);
const SYN_OK = /^[a-z]{3,}$/;
function synonymFor(word) {
  const s = (word.m || []).filter((x) => SYN_OK.test(x) && x !== word.w && !x.includes(word.w.slice(0, 4)));
  return s.length ? pickOne(s) : null;
}
// Which kinds can be asked about this word
export function canAsk(word, kind, kid) {
  const letters = /^[a-z]+$/i.test(word.w);
  switch (kind) {
    case "gap": return !!gapSentence(word);
    case "usage": return sentences(word).length > 0 && !kid;
    case "synonym": return !!synonymFor(word);
    case "mixup": return !!word.cf && !!BY.get(word.cf) && !!gapSentence(word);
    case "spell": return letters && !kid;
    case "unscramble": return letters && word.w.length <= 12;
    case "listen": return typeof speechSynthesis !== "undefined";
    default: return true;
  }
}
// One question of a given kind for a word.
// Kinds: meaning, word, gap, spell, unscramble, flash, listen, usage, synonym, truefalse, mixup
export function question(word, kind, kid = false) {
  const n = kid ? 2 : 3;
  if (kind === "spell" && kid) kind = "unscramble";
  if (!canAsk(word, kind, kid)) kind = kind === "listen" ? "meaning" : canAsk(word, "gap", kid) ? "gap" : "word";
  if (kind === "flash") return { kind, word };
  if (kind === "spell") return { kind, word, prompt: word.d };
  if (kind === "unscramble") return { kind, word, prompt: word.d, tiles: scramble(word.w) };
  if (kind === "meaning" || kind === "listen") return { kind, word, prompt: word.w, options: shuffled([word, ...distractors(word, n, "d")]).map((x) => ({ text: x.d, right: x.w === word.w })) };
  if (kind === "truefalse") {
    const real = Math.random() < 0.5, other = real ? null : distractors(word, 1, "d")[0];
    const shown = real || !other ? word.d : other.d;
    return { kind, word, prompt: shown, truth: real || !other, options: [{ text: "True", right: real || !other }, { text: "False", right: !(real || !other) }] };
  }
  if (kind === "synonym") {
    const syn = synonymFor(word), others = distractors(word, n, "w").map((x) => x.w).filter((x) => !(word.m || []).includes(x));
    return { kind, word, prompt: word.w, options: shuffled([syn, ...others.slice(0, n)]).map((t) => ({ text: t, right: t === syn })) };
  }
  if (kind === "usage") {
    // The right sentence, plus other words' sentences with this word dropped in where it doesn't belong
    const right = pickOne(sentences(word).length > 1 ? sentences(word).slice(1) : sentences(word));
    const wrong = [];
    for (const x of shuffled(distractors(word, n * 3, "w"))) {
      const s = sentences(x)[0]; if (!s || wrong.length >= n) continue;
      wrong.push(s.replace(wordRe(x.w), `$1${word.w}`));
    }
    return { kind, word, prompt: word.w, options: shuffled([{ text: right, right: true }, ...wrong.map((t) => ({ text: t, right: false }))]) };
  }
  if (kind === "mixup") {
    const other = BY.get(word.cf);
    return { kind, word, prompt: gapSentence(word), options: shuffled([word, other]).map((x) => ({ text: x.w, right: x.w === word.w })) };
  }
  const prompt = kind === "gap" ? gapSentence(word) : word.d;
  return { kind, word, prompt, options: shuffled([word, ...distractors(word, n, "w")]).map((x) => ({ text: x.w, right: x.w === word.w })) };
}
// A mix that eases in: meaning first, then harder and more varied kinds as a word gets familiar
export function mixedKind(word, reps, kid) {
  if (reps === 0) return pickOne(["meaning", "meaning", "truefalse"]);
  const kinds = ["meaning", "word", "truefalse", "listen"];
  if (canAsk(word, "gap", kid)) kinds.push("gap", "gap");
  if (canAsk(word, "synonym", kid)) kinds.push("synonym");
  if (canAsk(word, "mixup", kid)) kinds.push("mixup", "mixup");
  if (reps >= 1 && canAsk(word, "usage", kid)) kinds.push("usage");
  if (reps >= 2) kinds.push(kid ? "unscramble" : "spell");
  if (reps >= 1 && canAsk(word, "unscramble", kid)) kinds.push("unscramble");
  return pickOne(kinds);
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
    pool = pool.concat(shuffled(MAIN.filter((w) => allowed.includes(w.l) && !have.has(w.w) && (!topic || w.t === topic))).slice(0, size));
  }
  return pool.slice(0, size);
}
// Find your level: two words from each level, easiest first
export function placementWords(maxLevel = MAX_LEVEL) {
  return Array.from({ length: maxLevel + 1 }, (_, l) => l).flatMap((l) => shuffled(MAIN.filter((w) => w.l === l && !(w.x && w.x.includes("funny")) && (w.z || 3) < (l < 2 ? 6 : 3.6))).slice(0, 2));
}
