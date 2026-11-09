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
  WORDS.forEach((w, i) => { w.i = i; BY.set(w.w, w); });
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
  if (p.feedTopic) {
    const allowed = levelsFor(p);
    return WORDS.filter(w => w.t === p.feedTopic && allowed.includes(w.l) && !done.has(w.w))
      .map(w => [Math.abs(w.l - p.level) + rnd() * 0.9, w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  const at = WORDS.filter(w => w.l === p.level && !done.has(w.w));
  const below = p.level > 0 ? WORDS.filter(w => w.l === p.level - 1 && !done.has(w.w)) : [];
  const keyed = (arr) => arr.map(w => [rnd(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
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
export function blankExample(word) {
  if (!word.e) return null;
  const re = new RegExp(`\\b${word.w}\\b`, "i");
  if (!re.test(word.e)) return null;
  return word.e.replace(re, "_____");
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
