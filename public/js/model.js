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
  return BY.get(word) || (custom && { w: custom.w, p: custom.p || "word", d: custom.d, e: custom.e || "", l: 3, t: "My words", f: [], m: [], s: "", custom: true, id: custom.id });
}

// ---- Profiles ------------------------------------------------------------
export const profiles = () => store.all("profile").sort((a, b) => a.created - b.created);
export const profile = (id) => store.get("profile:" + id);
// Each saved field remembers when it last changed (_t), so two devices' copies of a profile can be combined field
// by field instead of one copy replacing the other whole.
export function saveProfile(p) {
  const cur = profile(p.id) || {}, t = { ...(cur._t || {}), ...(p._t || {}) }, now = Date.now();
  for (const k of Object.keys(p)) if (k !== "_t" && JSON.stringify(p[k]) !== JSON.stringify(cur[k])) t[k] = now;
  return store.put("profile", "profile:" + p.id, { ...p, _t: t });
}
// Progress only moves forward: of two copies of a road, keep the one further along, with the best stars from both
const pos = (r) => (r.ch || 0) * 1000 + (r.step || 0);
function mergeRoad(a, b) {
  if (!a || !b) return a || b;
  const rest = ({ stars, log, started, ...r }) => r; // what decides between equal positions (stars and logs are combined)
  const win = pos(a) !== pos(b) ? (pos(a) > pos(b) ? a : b) : (store.canon(rest(a)) >= store.canon(rest(b)) ? a : b);
  const stars = { ...(a.stars || {}) };
  for (const [k, v] of Object.entries(b.stars || {})) stars[k] = Math.max(v, stars[k] || 0);
  const log = new Map();
  for (const x of [...(a.log || []), ...(b.log || [])]) { const o = log.get(x.ch); if (!o || x.at < o.at) log.set(x.ch, x); }
  const started = Math.min(a.started || Infinity, b.started || Infinity);
  return { ...win, stars, log: [...log.values()].sort((x, y) => x.ch - y.ch), ...(started < Infinity ? { started } : {}) };
}
function mergeRoads(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) out[k] = mergeRoad((a || {})[k], (b || {})[k]);
  return out;
}
// Combine two copies of a profile: settings by whichever changed last, roads by furthest progress, active days together
export function mergeProfile(a, b, ua = 0, ub = 0) {
  const ta = a._t || {}, tb = b._t || {}, out = {}, t = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === "_t") continue;
    if (k === "journey" || k === "trails") { if (a[k] || b[k]) out[k] = mergeRoads(a[k], b[k]); }
    else if (k === "days") out.days = [...new Set([...(a.days || []), ...(b.days || [])])].sort().slice(-400);
    else {
      const da = ta[k] || 0, db = tb[k] || 0;
      const useA = da !== db ? da > db : ua !== ub ? ua > ub : store.canon(a[k]) >= store.canon(b[k]);
      const v = useA ? a[k] : b[k]; if (v !== undefined) out[k] = v;
    }
    const m = Math.max(ta[k] || 0, tb[k] || 0); if (m) t[k] = m;
  }
  out._t = t;
  return out;
}
store.setMerger("profile", mergeProfile);
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
// One review per word per day counts. Answering the same word five times in one sitting is practice, not five days of memory,
// so only the first answer of the day moves the schedule (unless the word is due again, after a miss).
export function grade(pid, w, g, now = Date.now()) {
  const c = card(pid, w) || learn(pid, w), st = c.srs;
  if (st && st.reps && srs.startOfDay(st.last) === srs.startOfDay(now) && st.due > now) return c;
  return setCard(pid, w, { st: "learning", srs: srs.review(st || srs.newState(), g, now) });
}
const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
export const countWord = (n) => COUNT_WORDS[n] || String(n);
// Your own sentence for a word, written in "Use it"
export const setMine = (pid, w, text) => setCard(pid, w, { mine: text, mineAt: Date.now() });

export function todayCount(pid) {
  const start = srs.startOfDay(Date.now());
  return cards(pid).filter(c => (c.st === "learning" || c.st === "known") && (c.actAt || 0) >= start).length;
}
// Reviews come only from words at your current level (and your own custom words)
const reviewable = (pid) => { const p = profile(pid); return cards(pid).filter(c => c.st === "learning" && c.srs && (!p || atLevel(p, lookup(c.w)))); };
export function due(pid, now = Date.now()) {
  return reviewable(pid).filter(c => c.srs.due <= now).sort((a, b) => a.srs.due - b.srs.due);
}
export function nextDue(pid) {
  const l = reviewable(pid).map(c => c.srs.due).sort((a, b) => a - b);
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
// The one rule for what you see: words come only from the level you chose (your own custom words always show).
// Every feed, topic, set, trail, road, game and review goes through this.
export function levelsFor(p) { return [p.level]; }
export const atLevel = (p, w) => !!w && (w.custom || w.l === p.level);
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
    const allowed = levelsFor(p);
    return MAIN.filter(w => w.x && w.x.includes(p.feedSet) && allowed.includes(w.l) && !done.has(w.w)).map(w => [rnd(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  if (p.feedTopic) {
    const allowed = levelsFor(p);
    return MAIN.filter(w => w.t === p.feedTopic && allowed.includes(w.l) && !done.has(w.w))
      .map(w => [Math.abs(w.l - p.level) + rnd() * 0.9, w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  const at = MAIN.filter(w => w.l === p.level && !done.has(w.w));
  // Any order, with a light touch: the youngest teen level eases in with its more familiar words; at every
  // level the very common ones wait at the back, so the first words you meet are the ones worth learning
  const keyed = (arr) => arr.map(w => [(p.level === 2 ? -(w.z || 2.5) * 0.3 : 0) + ((w.z || 0) >= 4.2 ? 2 : 0) + rnd() * 1.8, w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  let main = keyed(at);
  if (p.topics && p.topics.length) {
    const fav = main.filter(w => p.topics.includes(w.t)), rest = main.filter(w => !p.topics.includes(w.t));
    main = []; while (fav.length || rest.length) { if (fav.length) main.push(fav.shift()); if (fav.length) main.push(fav.shift()); if (rest.length) main.push(rest.shift()); }
  }
  // When every word at this level has been seen, the Words screen says so; it never borrows from another level
  return main;
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
export const customWord = (id) => store.get("cw:" + id);
// Change your own word. If the spelling changes, its progress and its place in your lists come with it.
export function editCustom(id, fields) {
  const cur = customWord(id); if (!cur) return;
  store.put("custom", "cw:" + id, { ...cur, ...fields, edited: Date.now() });
  if (fields.w && fields.w !== cur.w) {
    const c = card(cur.pid, cur.w);
    if (c) { store.put("card", cid(cur.pid, fields.w), { ...c, w: fields.w }); store.remove(cid(cur.pid, cur.w)); }
    for (const col of collections(cur.pid)) if (col.words.includes(cur.w)) saveCollection({ ...col, words: col.words.map((x) => (x === cur.w ? fields.w : x)) });
  }
}
// Remove your own word, with its progress and its place in your lists
export function removeCustom(id) {
  const cur = customWord(id); if (!cur) return;
  store.remove("cw:" + id); store.remove(cid(cur.pid, cur.w));
  for (const col of collections(cur.pid)) if (col.words.includes(cur.w)) saveCollection({ ...col, words: col.words.filter((x) => x !== cur.w) });
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
  { key: "learn", name: "Meet the words", icon: "flashcards", line: "Six new words. Just read and listen." },
  { key: "meaning", name: "What they mean", icon: "match", line: "Match each word to its meaning." },
  { key: "gap", name: "Fill the gaps", icon: "gap", line: "Fresh sentences, missing a word." },
  { key: "spell", name: "Build them", icon: "unscramble", line: "Put the letters back in order." },
  { key: "mix", name: "Mix it up", icon: "shuffle", line: "A bit of everything." },
  { key: "test", name: "The keeper's riddle", icon: "perfect", line: "Show the keeper the words are yours." },
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
  const list = MAIN.filter((w) => w.l === level && !w.fo);
  // kid lists are already ordered by hand; older levels go from the most common word to the rarest
  const ordered = level <= 1 ? list : [...list].sort((a, b) => (b.z || 0) - (a.z || 0));
  const chapters = [];
  let lm = 0, since = [];
  for (let i = 0; i < ordered.length; i += CHAPTER_SIZE) {
    const words = ordered.slice(i, i + CHAPTER_SIZE);
    chapters.push({ words, lookout: false, landmark: LANDMARKS[lm++ % LANDMARKS.length], idx: lm });
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
// Every stop on the road plays differently. The first and last steps are fixed (meet the words, the keeper's riddle);
// the four in between are drawn from a pool of games, the same for a stop every time you visit it, different from its
// neighbors. Kids get the kid-friendly games.
const STEP_POOL = {
  meaning: { name: "What they mean", icon: "match", line: "Match each word to its meaning." },
  pairs: { name: "Match the pairs", icon: "match", line: "Tap a word, then its meaning." },
  memory: { name: "Memory cards", icon: "flashcards", line: "Flip two cards. Find each word's meaning." },
  incontext: { name: "Read the clues", icon: "talk", line: "Work out what each word means in a sentence." },
  listen: { name: "Listen closely", icon: "senses", line: "Hear the word, then find it." },
  gap: { name: "Fill the gaps", icon: "gap", line: "Sentences you haven't seen, missing a word." },
  cloze: { name: "Word bank", icon: "history", line: "Place each word in its sentence." },
  usage: { name: "Spot the right use", icon: "talk", line: "Only one sentence uses the word right." },
  oddone: { name: "Odd one out", icon: "mind", line: "Three belong together. Which one doesn't?" },
  synonym: { name: "Find its twin", icon: "senses", line: "Pick the word closest in meaning." },
  spell: { name: "Build them", icon: "unscramble", line: "Put the letters back in order." },
  hidden: { name: "Light the letters", icon: "streak", line: "Guess the word one letter at a time." },
  wordsearch: { name: "Word hunt", icon: "describing", line: "Find the words hidden in the letters." },
  hearspell: { name: "Hear and spell", icon: "senses", line: "Listen, then spell what you hear." },
  spellit: { name: "Spell them", icon: "spelling", line: "Type each word from its meaning." },
  useit: { name: "Make it yours", icon: "mywords", line: "Write your own sentence with each word." },
  mix: { name: "Mix it up", icon: "shuffle", line: "Every word once more, a new way." },
};
// A stop walks the way words are learned: meet them, recognize them, see them in sentences, get their shape right,
// then use them yourself. Each slot has its own shelf of games, and the road walks through every shelf in a shuffled
// order, so neighboring stops never repeat a game in the same slot and it takes many stops before a combination comes back.
const SLOTS = [
  ["meaning", "pairs", "incontext", "memory", "listen"],          // recognize: what does it mean?
  ["gap", "cloze", "usage", "synonym", "oddone"],                 // context: how is it used?
  ["hidden", "spell", "spellit", "hearspell"],                    // form: how is it spelled?
  ["useit", "mix", "useit"],                                      // use: make it yours
];
const KID_SKIP = new Set(["oddone", "hearspell", "usage", "synonym", "spellit", "useit"]);
const HARD_FORM = new Set(["spellit", "hearspell"]);
function variedSteps(chapter, kid) {
  const idx = chapter.idx || 0;
  // Kids skip the "use it" slot: four short steps and the riddle
  const mid = SLOTS.slice(0, kid ? 3 : 4).map((slot, k) => {
    const opts = [...new Set(slot)].filter((x) => !(kid && KID_SKIP.has(x)));
    const order = seededOrder(k === 3 ? slot : opts, "slot" + k + (kid ? "k" : ""));
    let pick = order[(idx + k * 2) % order.length];
    // typing a word from memory waits until you've walked a few stops
    if (HARD_FORM.has(pick) && idx < 3) pick = order.find((x) => !HARD_FORM.has(x));
    return pick;
  });
  return [STEPS[0], ...mid.map((k) => ({ key: k, ...STEP_POOL[k] })), STEPS[STEPS.length - 1]];
}
function seededOrder(list, key) { const rnd = seeded(key); return list.map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]); }
const stepCache = new WeakMap(), kidStepCache = new WeakMap();
const KID_LOOKOUT = [{ key: "incontext", name: "Campfire stories", icon: "review", line: "What does each word mean in the story?" }, ...LOOKOUT_STEPS.slice(1)];
export function stepsFor(chapter, trailKey, kid = chapter ? chapter.words.every((w) => w.l <= 1) : false) {
  if (trailKey === "spelling") return SPELL_STEPS;
  if (trailKey === "mixups") return MIXUP_STEPS;
  if (trailKey) {
    if (!chapter) return TRAIL_STEPS;
    const play = seededOrder(["pairs", "memory", "hidden", "wordsearch", "cloze", "incontext", "oddone", "listen", "gap"].filter((k) => !(kid && KID_SKIP.has(k))), "trail" + trailKey);
    const k = play[(chapter.idx || 0) % play.length];
    return [TRAIL_STEPS[0], { ...TRAIL_STEPS[1], key: k, name: STEP_POOL[k].name, icon: STEP_POOL[k].icon, line: STEP_POOL[k].line }, TRAIL_STEPS[2]];
  }
  if (!chapter) return STEPS;
  if (chapter.lookout) return kid ? KID_LOOKOUT : LOOKOUT_STEPS;
  const cache = kid ? kidStepCache : stepCache;
  if (!cache.has(chapter)) cache.set(chapter, variedSteps(chapter, kid));
  return cache.get(chapter);
}

// Side trails: short themed walks with no daily lock
export const trail = (key) => TRAILS.find((t) => t.key === key);
const TRAIL_ORDER = ["decades", "spelling", "myths", "sounds", "mixups", "borrowed", "conversation", "kind", "space", "weather", "tasting", "kitchen", "games", "tech", "money", "airport", "office", "doctor", "courtroom"];
export function trailsFor(p) {
  const kid = isKid(p), rank = (k) => { const i = TRAIL_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  return [...TRAILS].sort((x, y) => rank(x.key) - rank(y.key)).filter((t) => t.aud === "all" || (t.aud === "teen" && !kid) || (t.aud === "adult" && !kid && (p.role === "adult" || p.level >= 4)))
    .filter((t) => trailWords(t, p).length >= 6);
}
// Each trail shows only the words at your level, in the order they were written.
// A mix-up shows only when both words of the pair are at your level.
export function trailWords(t, p) {
  const ok = (w) => w && w.l === p.level;
  return t.words.map((w) => BY.get(w)).filter((w) => ok(w) && (!w.cf || !t.words.includes(w.cf) || ok(BY.get(w.cf))));
}
export function trailChapters(key, p) {
  const t = trail(key); if (!t) return [];
  const ws = trailWords(t, p);
  // mix-ups stay in pairs; others stay in the order they were written
  const size = key === "mixups" ? 4 : CHAPTER_SIZE, out = [];
  for (let i = 0; i < ws.length; i += size) { const words = ws.slice(i, i + size); if (words.length >= 2) out.push({ words, lookout: false, landmark: null, idx: out.length }); }
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
  if (same.length < n) same = same.concat(WORDS.filter((x) => x.w !== word.w && Math.abs(x.l - lv) === 1 && x[field] && x[field] !== word[field]));
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
export const sentences = (word) => [word.e, ...(word.e2 ? [].concat(word.e2) : []), ...(word.e3 || [])].filter((x) => x && wordRe(word.w).test(x));
// Games take turns through a word's sentences, so the same one doesn't come back until you've seen the rest.
// The Words screen's own example goes last. Remembered per device.
const SENT_KEY = "lumin-sent";
let sentUse = null;
const loadUse = () => { if (sentUse) return sentUse; try { sentUse = JSON.parse(localStorage.getItem(SENT_KEY) || "{}"); } catch { sentUse = {}; } return sentUse; };
let saveT = null;
const saveUse = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { const keys = Object.keys(sentUse); if (keys.length > 4000) keys.slice(0, keys.length - 3000).forEach((k) => delete sentUse[k]); localStorage.setItem(SENT_KEY, JSON.stringify(sentUse)); } catch {} }, 400); };
export function nextSentence(word, ok = () => true) {
  const all = sentences(word); if (!all.length) return null;
  const order = all.length > 1 ? [...all.slice(1), all[0]] : all;
  const use = loadUse(), start = use[word.w] || 0;
  for (let k = 0; k < order.length; k++) {
    const idx = (start + k) % order.length;
    if (ok(order[idx])) { use[word.w] = idx + 1; saveUse(); return order[idx]; }
  }
  return null;
}
export function gapSentence(word, fresh = true) {
  const pick = fresh ? nextSentence(word) : sentences(word)[0];
  // "a _____" or "an _____" would give the answer away, so the article stays neutral
  return pick ? pick.replace(wordRe(word.w), "$1_____").replace(/\b(a|an) _____/gi, (m, art) => (art[0] === "A" ? "A" : "a") + "/an _____") : null;
}
export const blankExample = (word) => gapSentence(word, false);
const SYN_OK = /^[a-z][a-z' -]{2,}$/;
function editDist(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}
// A usable close word: plain, not the same stem, not a spelling variant, and not harder than the word itself
const synOk = (word, x) => {
  if (!SYN_OK.test(x) || x === word.w) return false;
  const a = word.w.toLowerCase(), b = x.toLowerCase();
  if (b.includes(a.slice(0, 4)) || a.includes(b.slice(0, 4)) || editDist(a, b) <= 2) return false;
  const o = BY.get(x);
  return !o || (o.l <= (word.l ?? 3) + 1 && (o.z == null || o.z >= 3.2));
};
const synsOf = (word) => (word.m || []).filter((x) => synOk(word, x));
function synonymFor(word) { const s = synsOf(word); return s.length ? pickOne(s) : null; }
// Close cousins for Odd one out: (when the bank knows them) the same part of speech
const goodSyns = (word) => synsOf(word).filter((x) => !BY.get(x) || BY.get(x).p === word.p);
// Two words are related when either lists the other as a close word or an opposite
const related = (a, b) => (a.m || []).includes(b.w) || (b.m || []).includes(a.w) || (a.a || []).includes(b.w) || (b.a || []).includes(a.w);
// A sentence that works as a build-the-sentence puzzle: not too short, not too long
const buildable = (text, kid) => { const n = text.trim().split(/\s+/).length; return n >= 4 && n <= (kid ? 9 : 13); };
export const sentenceTiles = (text) => text.trim().split(/\s+/);
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
    case "listen": return true;
    case "hidden": return /^[a-z][a-z' -]*$/i.test(word.w) && word.w.replace(/[^a-z]/gi, "").length >= 3 && word.w.length <= 16;
    case "incontext": return sentences(word).length > 0;
    case "oddone": return goodSyns(word).length >= 2;
    case "opposite": return !!(word.a && word.a.length) && (word.p === "adjective" || word.p === "adverb");
    case "build": return sentences(word).some((x) => buildable(x, kid));
    case "hearspell": return letters && !kid;
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
  if (kind === "useit") return { kind, word, model: nextSentence(word) || word.e };
  if (kind === "spell") return { kind, word, prompt: word.d };
  if (kind === "unscramble") return { kind, word, prompt: word.d, tiles: scramble(word.w) };
  if (kind === "meaning" || kind === "listen") return { kind, word, prompt: word.w, options: shuffled([word, ...distractors(word, n, "d")]).map((x) => ({ text: x.d, right: x.w === word.w })) };
  if (kind === "truefalse") {
    const real = Math.random() < 0.5, other = real ? null : distractors(word, 1, "d")[0];
    const shown = real || !other ? word.d : other.d;
    return { kind, word, prompt: shown, truth: real || !other, options: [{ text: "True", right: real || !other }, { text: "False", right: !(real || !other) }] };
  }
  if (kind === "synonym") {
    const syn = synonymFor(word), others = distractors(word, n * 3, "w").filter((x) => !related(word, x) && !(x.m || []).includes(syn) && x.t !== word.t).map((x) => x.w);
    return { kind, word, prompt: word.w, options: shuffled([syn, ...others.slice(0, n)]).map((t) => ({ text: t, right: t === syn })) };
  }
  if (kind === "usage") {
    // The right sentence, plus other words' sentences with this word dropped in where it doesn't belong
    const right = pickOne(sentences(word).length > 1 ? sentences(word).slice(1) : sentences(word));
    const wrong = [];
    // A borrowed sentence can't come from a close word or the same topic, or the "wrong" use might be right
    for (const x of shuffled(distractors(word, n * 4, "w"))) {
      if (related(word, x) || x.t === word.t) continue;
      const s = sentences(x)[0]; if (!s || wrong.length >= n) continue;
      wrong.push(s.replace(wordRe(x.w), `$1${word.w}`));
    }
    return { kind, word, prompt: word.w, options: shuffled([{ text: right, right: true }, ...wrong.map((t) => ({ text: t, right: false }))]) };
  }
  if (kind === "hidden") return { kind, word, prompt: word.d };
  if (kind === "hearspell") return { kind, word, prompt: word.d };
  if (kind === "incontext") {
    const sent = nextSentence(word);
    return { kind, word, prompt: sent, options: shuffled([word, ...distractors(word, n, "d")]).map((x) => ({ text: x.d, right: x.w === word.w })) };
  }
  if (kind === "oddone") {
    // two of the word's close cousins and one stranger: spot the stranger
    const twins = shuffled(goodSyns(word)).slice(0, 2);
    // the stranger is an everyday word, so the puzzle is about meaning, not about knowing a rare word
    const odd = distractors(word, 12, "w").filter((x) => (x.z == null || x.z >= 3.8) && !related(word, x) && !twins.some((t) => (x.m || []).includes(t)) && /^[a-z]{3,}$/.test(x.w)).map((x) => x.w)[0]
      || distractors(word, 6, "w").map((x) => x.w).find((x) => !twins.includes(x) && !(word.m || []).includes(x));
    return { kind, word, twins, odd, options: shuffled([word.w, ...twins, odd]).map((t) => ({ text: t, right: t === odd })) };
  }
  if (kind === "opposite") {
    const opp = pickOne(word.a), others = distractors(word, n + 2, "w").map((x) => x.w).filter((x) => !(word.m || []).includes(x) && !word.a.includes(x)).slice(0, n);
    return { kind, word, prompt: word.w, answer: opp, options: shuffled([opp, ...others]).map((t) => ({ text: t, right: t === opp })) };
  }
  if (kind === "build") {
    const sent = nextSentence(word, (x) => buildable(x, kid)) || sentences(word).find((x) => buildable(x, kid));
    const tiles = sentenceTiles(sent);
    let mixed; do { mixed = shuffled(tiles.map((t, k) => ({ t, k }))); } while (mixed.length > 1 && mixed.every((x, k) => x.k === k));
    return { kind, word, sentence: sent, tiles: mixed };
  }
  if (kind === "mixup") {
    const other = BY.get(word.cf);
    return { kind, word, prompt: gapSentence(word), options: shuffled([word, other]).map((x) => ({ text: x.w, right: x.w === word.w })) };
  }
  const prompt = kind === "gap" ? gapSentence(word) : word.d;
  return { kind, word, prompt, options: shuffled([word, ...distractors(word, n, "w")]).map((x) => ({ text: x.w, right: x.w === word.w })) };
}
// A mix that eases in: meaning first, then harder and more varied kinds as a word gets familiar
let lastKinds = [];
const NO_KINDS = new Set();
// The keeper's riddle asks you to recall and use the words: no coin-flip true-or-false
export const RIDDLE_SKIP = new Set(["truefalse"]);
export function mixedKind(word, reps, kid, no = NO_KINDS) {
  const kinds = reps === 0 ? ["meaning", "truefalse", "listen"] : ["meaning", "word", "truefalse", "listen"];
  if (reps === 0 && canAsk(word, "incontext", kid)) kinds.push("incontext");
  if (reps >= 1) {
    if (canAsk(word, "gap", kid)) kinds.push("gap");
    if (canAsk(word, "incontext", kid)) kinds.push("incontext");
    if (canAsk(word, "synonym", kid)) kinds.push("synonym");
    if (canAsk(word, "oddone", kid)) kinds.push("oddone");
    if (canAsk(word, "opposite", kid)) kinds.push("opposite", "opposite");
    if (canAsk(word, "mixup", kid)) kinds.push("mixup", "mixup");
    if (canAsk(word, "usage", kid)) kinds.push("usage");
    if (canAsk(word, "hidden", kid)) kinds.push("hidden");
    if (canAsk(word, "unscramble", kid)) kinds.push("unscramble");
  }
  if (reps >= 2) { kinds.push(kid ? "unscramble" : "spell"); if (canAsk(word, "hearspell", kid)) kinds.push("hearspell"); }
  // never the same kind twice in a row, and rarely within three
  const ok = kinds.filter((k) => !no.has(k)), list = ok.length ? ok : ["meaning"];
  const fresh = list.filter((k) => !lastKinds.includes(k));
  const k = pickOne(fresh.length ? fresh : list.filter((x) => x !== lastKinds[0]).length ? list.filter((x) => x !== lastKinds[0]) : list);
  lastKinds = [k, ...lastKinds].slice(0, 3);
  return k;
}
// Words a person can practice: what they're learning, then their journey words, then their level
export function practicePool(p, size = 10, topic = null) {
  const mine = cards(p.id).filter((c) => c.st === "learning").map((c) => lookup(c.w)).filter((w) => atLevel(p, w));
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
  return Array.from({ length: maxLevel + 1 }, (_, l) => l).flatMap((l) => shuffled(MAIN.filter((w) => w.l === l && !w.fo && (w.z || 3) < (l < 2 ? 6 : 3.6))).slice(0, 2));
}
