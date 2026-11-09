// Lumin Vocab sync server (Cloudflare Worker + D1).
// Stores only encrypted blobs. It never sees family codes, names, words or progress.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

const MAX_BODY = 1_000_000;      // bytes per request
const MAX_CHANGES = 200;         // records per request
const MAX_BLOB = 64_000;         // characters per encrypted record
const MAX_RECORDS = 25_000;      // records per family
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

export async function handleSync(request, env) {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405, { allow: "POST" });
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return json({ error: "too large" }, 413);
  let body;
  try { const text = await request.text(); if (text.length > MAX_BODY) return json({ error: "too large" }, 413); body = JSON.parse(text); }
  catch { return json({ error: "invalid json" }, 400); }
  const problem = validate(body);
  if (problem) return json({ error: problem }, 400);

  const fam = await sha256hex("lumin-family/" + body.fid); // the stored key is a hash of the family id

  if (env.SYNC_LIMIT) {
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const { success } = await env.SYNC_LIMIT.limit({ key: fam.slice(0, 16) + ":" + ip });
    if (!success) return json({ error: "slow down" }, 429, { "retry-after": "30" });
  }

  const db = env.DB;
  const now = Date.now();
  await db.prepare("INSERT INTO families (fam, seq, created, touched) VALUES (?1, 0, ?2, ?2) ON CONFLICT(fam) DO UPDATE SET touched = ?2").bind(fam, now).run();

  if (body.changes.length) {
    const count = await db.prepare("SELECT COUNT(*) AS n FROM records WHERE fam = ?1").bind(fam).first("n");
    if (count + body.changes.length > MAX_RECORDS) return json({ error: "family storage is full" }, 507);
    const stmts = [];
    for (const c of body.changes) {
      stmts.push(db.prepare("UPDATE families SET seq = seq + 1 WHERE fam = ?1").bind(fam));
      stmts.push(db.prepare(
        `INSERT INTO records (fam, id, u, d, c, seq) VALUES (?1, ?2, ?3, ?4, ?5, (SELECT seq FROM families WHERE fam = ?1))
         ON CONFLICT(fam, id) DO UPDATE SET u = excluded.u, d = excluded.d, c = excluded.c, seq = excluded.seq
         WHERE excluded.u > records.u OR (excluded.u = records.u AND excluded.c > records.c)`
      ).bind(fam, c.id, c.u, c.d, c.c));
    }
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
