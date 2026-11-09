// Lumin Vocab: local-first record store on IndexedDB.
// Every record: { id, type, data, u (updated ms), dev (device id), del (soft delete), dirty (needs sync) }
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

const DB_NAME = "lumin-vocab", VERSION = 1;
let db = null, mem = null;
const cache = new Map(); // id -> record (all records are kept in memory; the data set is small)
const listeners = new Set();
let lastU = 0;

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));

function tx(store, mode = "readonly") { return db.transaction(store, mode).objectStore(store); }
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function open() {
  try {
    db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("records")) d.createObjectStore("records", { keyPath: "id" });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const all = await req(tx("records").getAll());
    for (const r of all) { cache.set(r.id, r); lastU = Math.max(lastU, r.u || 0); }
  } catch (e) {
    console.warn("IndexedDB unavailable, using memory only", e);
    db = null; mem = new Map();
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
  if (!(await getMeta("deviceId"))) await setMeta("deviceId", uuid());
  deviceId = await getMeta("deviceId");
}

export async function getMeta(k) { if (!db) return mem.get("meta:" + k); return req(tx("meta").get(k)); }
export async function setMeta(k, v) { if (!db) { mem.set("meta:" + k, v); return; } return req(tx("meta", "readwrite").put(v, k)); }
export const persistent = () => !!db;

function write(rec) {
  cache.set(rec.id, rec);
  if (db) tx("records", "readwrite").put(rec);
}
function notify(kind, rec) { for (const fn of listeners) try { fn(kind, rec); } catch (e) { console.error(e); } }
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

// Monotonic clock so two quick local edits never share a timestamp.
function tick() { const n = Date.now(); lastU = n > lastU ? n : lastU + 1; return lastU; }

let deviceId = null;
export async function device() { return deviceId || (deviceId = await getMeta("deviceId")); }

export function get(id) { const r = cache.get(id); return r && !r.del ? r.data : undefined; }
export function all(type) { const out = []; for (const r of cache.values()) if (r.type === type && !r.del) out.push(r.data); return out; }
export function raw() { return [...cache.values()]; }

export function put(type, id, data) {
  const rec = { id, type, data, u: tick(), dev: deviceId, del: 0, dirty: 1 };
  write(rec); notify("local", rec); return data;
}
export function update(type, id, patch) { const cur = get(id) || {}; return put(type, id, { ...cur, ...patch }); }
export function remove(id) {
  const cur = cache.get(id); if (!cur) return;
  const rec = { ...cur, u: tick(), dev: deviceId, del: 1, dirty: 1 };
  write(rec); notify("local", rec);
}

// Apply a record that came from another device. Last writer wins; ties break on device id.
export function applyRemote(rec) {
  const cur = cache.get(rec.id);
  if (cur && (cur.u > rec.u || (cur.u === rec.u && (cur.dev || "") >= (rec.dev || "")))) return false;
  const next = { ...rec, dirty: 0 };
  lastU = Math.max(lastU, rec.u);
  write(next); notify("remote", next); return true;
}
export function markClean(ids, uById) {
  for (const id of ids) { const r = cache.get(id); if (r && r.u === uById[id]) { r.dirty = 0; write(r); } }
}
export function markAllDirty() { for (const r of cache.values()) if (!r.dirty) { r.dirty = 1; write(r); } }
export function dirty() { return [...cache.values()].filter(r => r.dirty); }

export async function wipe() {
  cache.clear();
  if (db) { await req(tx("records", "readwrite").clear()); await req(tx("meta", "readwrite").clear()); }
  else mem.clear();
}

export function exportAll() { return { app: "lumin-vocab", version: 1, exported: new Date().toISOString(), records: raw().map(({ dirty, ...r }) => r) }; }
export function importAll(obj) {
  if (!obj || obj.app !== "lumin-vocab" || !Array.isArray(obj.records)) throw new Error("This file is not a Lumin Vocab backup.");
  let n = 0;
  for (const r of obj.records) {
    if (typeof r.id !== "string" || typeof r.type !== "string" || typeof r.u !== "number") continue;
    if (applyRemote(r)) { const c = cache.get(r.id); c.dirty = 1; write(c); n++; }
  }
  return n;
}
