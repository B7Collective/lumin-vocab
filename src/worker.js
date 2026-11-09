// Lumin Vocab sync server (Cloudflare Worker + D1).
// Stores only encrypted blobs. It never sees family codes, names, words or progress.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

const MAX_BODY = 1_000_000;      // bytes per request
const MAX_CHANGES = 200;         // records per request
const MAX_BLOB = 16_000;         // characters per encrypted record (real records are well under 2,000)
const MAX_RECORDS = 25_000;      // records per family
const MAX_FAMILY_BYTES = 25_000_000; // stored characters per family
const IN_CHUNK = 90;             // D1 allows 100 bound values per query
const PAGE = 500;                // records returned per response

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
});

async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function validate(body) {
  if (!body || typeof body !== "object") return "bad body";
  if (typeof body.fid !== "string" || !/^[0-9a-f]{64}$/.test(body.fid)) return "bad fid";
  if (!Number.isSafeInteger(body.since) || body.since < 0) return "bad since";
  if (!Array.isArray(body.changes) || body.changes.length > MAX_CHANGES) return "bad changes";
  for (const c of body.changes) {
    if (!c || typeof c.id !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(c.id)) return "bad id";
    if (!Number.isSafeInteger(c.u) || c.u < 0) return "bad u";
    if (c.d !== 0 && c.d !== 1) return "bad d";
    if (typeof c.c !== "string" || c.c.length > MAX_BLOB || !/^[A-Za-z0-9_.-]+$/.test(c.c)) return "bad c";
  }
  return null;
}

// Read the body but stop as soon as it passes the limit, even if Content-Length is missing or wrong
async function readCapped(request, max) {
  if (!request.body) return "";
  const reader = request.body.getReader(), parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch {} return null; }
    parts.push(value);
  }
  const all = new Uint8Array(size); let o = 0;
  for (const p of parts) { all.set(p, o); o += p.byteLength; }
  return new TextDecoder().decode(all);
}

export async function handleSync(request, env) {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405, { allow: "POST" });
  // JSON only: this also stops other websites from sending simple cross-site form posts
  if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) return json({ error: "use application/json" }, 415);
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return json({ error: "too large" }, 413);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (env.IP_LIMIT) {
    const { success } = await env.IP_LIMIT.limit({ key: ip });
    if (!success) return json({ error: "slow down" }, 429, { "retry-after": "30" });
  }
  let body;
  try { const text = await readCapped(request, MAX_BODY); if (text == null) return json({ error: "too large" }, 413); body = JSON.parse(text); }
  catch { return json({ error: "invalid json" }, 400); }
  const problem = validate(body);
  if (problem) return json({ error: problem }, 400);

  const fam = await sha256hex("lumin-family/" + body.fid); // the stored key is a hash of the family id

  if (env.SYNC_LIMIT) {
    const { success } = await env.SYNC_LIMIT.limit({ key: fam.slice(0, 16) + ":" + ip });
    if (!success) return json({ error: "slow down" }, 429, { "retry-after": "30" });
  }

  const db = env.DB;
  const now = Date.now();

  // Most requests are a device asking "anything new?". Answer those with one small read and no writes.
  if (!body.changes.length) {
    const fam0 = await db.prepare("SELECT seq FROM families WHERE fam = ?1").bind(fam).first();
    if (!fam0 || fam0.seq <= body.since) return json({ seq: body.since, more: false, changes: [] });
  }

  if (body.changes.length) {
    await db.prepare("INSERT INTO families (fam, seq, created, touched) VALUES (?1, 0, ?2, ?2) ON CONFLICT(fam) DO UPDATE SET touched = ?2").bind(fam, now).run();
    // Last change per id wins within one request
    const latest = new Map();
    for (const c of body.changes) latest.set(c.id, c);
    const ids = [...latest.keys()], old = new Map();
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const chunk = ids.slice(i, i + IN_CHUNK);
      const { results } = await db.prepare(`SELECT id, length(c) AS len FROM records WHERE fam = ?1 AND id IN (${chunk.map((_, j) => "?" + (j + 2)).join(",")})`).bind(fam, ...chunk).all();
      for (const r of results) old.set(r.id, r.len);
    }
    let added = 0, delta = 0;
    for (const [id, c] of latest) { if (!old.has(id)) added++; delta += c.c.length - (old.get(id) || 0); }
    const usage = await db.prepare("SELECT n, bytes FROM families WHERE fam = ?1").bind(fam).first();
    if (usage.n + added > MAX_RECORDS || usage.bytes + delta > MAX_FAMILY_BYTES) return json({ error: "family storage is full" }, 507);
    const stmts = [];
    for (const c of latest.values()) {
      stmts.push(db.prepare("UPDATE families SET seq = seq + 1 WHERE fam = ?1").bind(fam));
      stmts.push(db.prepare(
        `INSERT INTO records (fam, id, u, d, c, seq) VALUES (?1, ?2, ?3, ?4, ?5, (SELECT seq FROM families WHERE fam = ?1))
         ON CONFLICT(fam, id) DO UPDATE SET u = excluded.u, d = excluded.d, c = excluded.c, seq = excluded.seq
         WHERE excluded.u > records.u OR (excluded.u = records.u AND excluded.c > records.c)`
      ).bind(fam, c.id, c.u, c.d, c.c));
    }
    stmts.push(db.prepare("UPDATE families SET n = n + ?2, bytes = MAX(0, bytes + ?3) WHERE fam = ?1").bind(fam, added, delta));
    await db.batch(stmts);
  }

  const { results } = await db.prepare("SELECT id, u, d, c, seq FROM records WHERE fam = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3").bind(fam, body.since, PAGE + 1).all();
  const more = results.length > PAGE;
  const page = more ? results.slice(0, PAGE) : results;
  const seq = page.length ? page[page.length - 1].seq : body.since;
  return json({ seq, more, changes: page.map((r) => ({ id: r.id, u: r.u, d: r.d, c: r.c })) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/sync") return await handleSync(request, env);
      if (url.pathname === "/api/health") return json({ ok: true });
      if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
      return env.ASSETS.fetch(request);
    } catch (err) {
      // Never leak internals to the client
      console.error("sync error", err && err.message);
      return json({ error: "server error" }, 500);
    }
  },
};
