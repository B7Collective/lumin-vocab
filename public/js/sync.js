// Lumin Vocab: end-to-end encrypted family sync.
// The family code never leaves the device. From it we derive (PBKDF2-SHA256):
//   - an AES-GCM key that encrypts every record before upload
//   - a family id the server uses to group records (the server stores only a hash of it)
//   - an HMAC key that turns record ids into opaque ids
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

import * as store from "./store.js";

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

export const ITERATIONS = 210000;

export function normalizeCode(code) {
  return String(code || "").toLowerCase().normalize("NFKD").replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, "");
}
export function validCode(code) { const n = normalizeCode(code).split("-").filter(Boolean); return n.length >= 6 && n.every(w => w.length >= 3); }

export function makeCode(words, count = 6) {
  const pool = [...new Set(words.filter(w => /^[a-z]{4,8}$/.test(w)))];
  if (pool.length < 512) throw new Error("word pool too small");
  const out = [];
  const rnd = new Uint32Array(count); crypto.getRandomValues(rnd);
  for (let i = 0; i < count; i++) out.push(pool[rnd[i] % pool.length]);
  return out.join("-");
}

export async function deriveKeys(code) {
  const norm = normalizeCode(code);
  const base = await crypto.subtle.importKey("raw", enc.encode(norm), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("lumin-vocab/v1"), iterations: ITERATIONS }, base, 768);
  const all = new Uint8Array(bits);
  const aes = await crypto.subtle.importKey("raw", all.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  const mac = await crypto.subtle.importKey("raw", all.slice(32, 64), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return { aes, mac, fid: hex(all.slice(64, 96)) };
}

export async function opaqueId(keys, id) { return b64(await crypto.subtle.sign("HMAC", keys.mac, enc.encode(id))).slice(0, 32); }

export async function seal(keys, rec) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = enc.encode(JSON.stringify({ id: rec.id, type: rec.type, data: rec.data, u: rec.u, dev: rec.dev, del: rec.del }));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keys.aes, body);
  return b64(iv) + "." + b64(ct);
}
export async function open(keys, blob) {
  const [iv, ct] = blob.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, keys.aes, unb64(ct));
  return JSON.parse(dec.decode(pt));
}

// ---- Sync engine -------------------------------------------------------
let keys = null, timer = null, running = null, pending = false, lastPoll = 0, lastActivity = Date.now(), urgent = false;
const state = { enabled: false, last: 0, error: "", busy: false };
const subs = new Set();
export const status = () => ({ ...state });
export const onStatus = (fn) => (subs.add(fn), () => subs.delete(fn));
const emit = () => { for (const fn of subs) try { fn(status()); } catch {} };

export async function init(apiBase = "") {
  const code = await store.getMeta("familyCode");
  state.last = (await store.getMeta("lastSync")) || 0;
  if (code) { keys = await deriveKeys(code); state.enabled = true; }
  // Local changes go up about a second later. Remote changes come down when the app opens or comes back
  // to the front, and with a regular check while it's on screen: every 30 seconds while someone is using it,
  // every 2 minutes after 5 quiet minutes.
  store.onChange((kind) => { lastActivity = Date.now(); if (kind === "local") schedule(1000); });
  addEventListener("online", () => schedule(0));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { lastActivity = Date.now(); schedule(0); }
    else if (store.dirty().length) flush(); // the app is going to the background: send now, before the device suspends it
  });
  addEventListener("pagehide", () => { if (store.dirty().length) flush(); });
  setInterval(() => {
    if (document.hidden || !state.enabled) return;
    const every = Date.now() - lastActivity < 5 * 60000 ? 30000 : 120000;
    if (Date.now() - lastPoll >= every) schedule(0);
  }, 10000);
  syncBase = apiBase;
  emit();
  if (state.enabled) schedule(0);
}
let syncBase = "";

export async function enable(code) {
  // let a sync that's already running (maybe for another family) finish first, so it can't write its place back after ours
  if (running) { state.enabled = false; await running.catch(() => {}); }
  await store.setMeta("familyCode", normalizeCode(code));
  await store.setMeta("cursor", 0);
  keys = await deriveKeys(code);
  state.enabled = true; state.error = "";
  // everything local needs to go up the first time
  store.markAllDirty();
  emit();
  return syncNow();
}
export async function disable() {
  await store.setMeta("familyCode", null); await store.setMeta("cursor", 0);
  keys = null; state.enabled = false; emit();
}
export const familyCode = () => store.getMeta("familyCode");

function flush() { clearTimeout(timer); urgent = true; syncNow().catch(() => {}); }
function schedule(ms) {
  if (!state.enabled) return;
  clearTimeout(timer);
  timer = setTimeout(() => { syncNow().catch(() => {}); }, ms);
}

export async function syncNow() {
  if (!state.enabled || !keys) return;
  if (running) { pending = true; return running; }
  running = (async () => {
    state.busy = true; emit();
    try {
      let cursor = (await store.getMeta("cursor")) || 0;
      for (let round = 0; round < 20; round++) {
        if (!state.enabled) break; // joining another family stops this run
        const dirty = store.dirty().slice(0, 200);
        const changes = [], uById = {}, oidToId = {};
        for (const r of dirty) {
          const oid = await opaqueId(keys, r.id);
          changes.push({ id: oid, u: r.u, d: r.del ? 1 : 0, c: await seal(keys, r) });
          uById[r.id] = r.u; oidToId[oid] = r.id;
        }
        const payload = JSON.stringify({ fid: keys.fid, since: cursor, changes });
        lastPoll = Date.now();
        // keepalive lets a small send finish even if the page is being closed or put to sleep
        const res = await fetch(syncBase + "/api/sync", {
          method: "POST", headers: { "content-type": "application/json" }, body: payload,
          keepalive: urgent && payload.length < 60000,
        });
        if (res.status === 429) throw new Error("Syncing too often. It will try again shortly.");
        if (res.status === 507) throw new Error("Your family's sync space is full. Remove old profiles or lists to make room.");
        if (!res.ok) throw new Error("The sync server had a problem (" + res.status + ").");
        const body = await res.json();
        store.markClean(dirty.map(r => r.id), uById);
        if ((body.changes || []).length) lastActivity = Date.now();
        for (const ch of body.changes || []) {
          try { const rec = await open(keys, ch.c); store.applyRemote(rec); }
          catch { /* not decryptable with this code: ignore */ }
        }
        cursor = body.seq || cursor;
        if (!state.enabled) break;
        await store.setMeta("cursor", cursor);
        if (!body.more && store.dirty().length === 0) break;
      }
      state.last = Date.now(); state.error = "";
      await store.setMeta("lastSync", state.last);
    } catch (e) {
      state.error = navigator.onLine === false ? "You're offline. Changes are saved here and will sync later." : (e.message || "Sync failed.");
    } finally {
      state.busy = false; running = null; urgent = false; emit();
      if (pending) { pending = false; schedule(500); }
    }
  })();
  return running;
}

export function joinLink(code, origin = location.origin) { return origin + "/#join=" + normalizeCode(code); }
