// Layout standard: on every device, no screen scrolls sideways, nothing sits off screen,
// controls keep their labels on one line, and nothing overlaps.
import { test, expect } from "@playwright/test";

function check() {
  const out = [], vw = document.documentElement.clientWidth;
  const scope = document.querySelector(".sheet") || document.body;
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden"; };
  const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, ".")} "${(el.textContent || "").trim().slice(0, 30)}"`;
  const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) return true; return false; };
  if (document.documentElement.scrollWidth > vw + 1) out.push("page scrolls sideways");
  for (const el of scope.querySelectorAll("*")) {
    if (!vis(el) || scroller(el) || getComputedStyle(el).position === "fixed" || el.closest(".scrim")) continue;
    const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) out.push("off screen: " + label(el));
  }
  for (const el of scope.querySelectorAll(".btn, .chip, .topic, .topnav a, .bottomnav a, .suggest, .kbd, .status, .hudchip, .qkind, .jnode .nm, .eyebrow, .ws-act span")) {
    if (!vis(el)) continue; const rg = document.createRange(), tops = new Set();
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { rg.selectNodeContents(n); for (const x of rg.getClientRects()) tops.add(Math.round(x.top)); }
    if (tops.size > 1) out.push("label wraps: " + label(el));
  }
  // nothing spills out of its own button or pill (labels hung outside on purpose are positioned absolutely, and skipped)
  for (const el of scope.querySelectorAll("button, .btn, .chip")) {
    if (!vis(el) || el.closest(".decor") || el.matches(".jnode")) continue; // a Journey stop is a disc with its name card hanging below on purpose
    const r = el.getBoundingClientRect(), rg = document.createRange(); let bad = false;
    const walk = (n) => {
      if (bad) return;
      if (n.nodeType === 3) { if (!n.textContent.trim()) return; rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.left < r.left - 1 || q.right > r.right + 1) bad = true; return; }
      if (n.nodeType !== 1 || !vis(n) || getComputedStyle(n).position === "absolute") return;
      const q = n.getBoundingClientRect(); if (q.left < r.left - 1 || q.right > r.right + 1) { bad = true; return; }
      n.childNodes.forEach(walk);
    };
    el.childNodes.forEach(walk);
    if (bad) out.push("spills out: " + label(el));
  }
  const boxes = [...scope.querySelectorAll("button, a, input, select, h1, h2, h3, p, li, .badge, .avatar, .topic, .tile, .panel, .gcard, .wcard, .stat")].filter(vis).filter(el => !el.closest(".bottomnav, .scrim, .whint, .decor") && !el.matches(".wdl"));
  const rs = boxes.map(el => el.getBoundingClientRect());
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (boxes[i].contains(boxes[j]) || boxes[j].contains(boxes[i])) continue;
    const a = rs[i], b = rs[j], x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (x > 2 && y > 2) out.push(`overlap: ${label(boxes[i])} / ${label(boxes[j])}`);
  }
  return out;
}

async function seed(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const model = await import("/js/model.js"), store = await import("/js/store.js");
    for (let i = 0; i < 50 && !model.WORDS.length; i++) await new Promise(r => setTimeout(r, 100));
    const a = model.newProfile({ name: "Alexandra", role: "adult", level: 4 });
    model.newProfile({ name: "Sam", role: "kid", level: 0, manager: false });
    const ws = model.queue(a).slice(0, 10);
    ws.slice(0, 6).forEach(w => model.learn(a.id, w.w)); ws.slice(6).forEach(w => model.know(a.id, w.w));
    model.toggleFav(a.id, ws[0].w);
    model.toggleInCollection(model.newCollection(a.id, "Words from our road trip"), ws[1].w);
    model.addCustom(a.id, { w: "c++ (lang)", p: "noun", d: "a programming language", e: "She writes c++ (lang) code." });
    await store.setMeta("activeProfile", a.id);
    await new Promise(r => setTimeout(r, 300));
  });
  await page.reload();
  await page.locator("#main > *").first().waitFor();
}

const SCREENS = ["words", "journey", "practice", "library", "library/favorites", "library/lists", "library/history", "library/mine", "topics", "you", "family", "settings", "install", "about", "who"];

test("every screen keeps the layout standard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy|Refused/.test(m.text())) errors.push(m.text()); });
  for (const path of ["/#/welcome", "/#/setup", "/#/join"]) { await page.goto(path); await page.waitForTimeout(400); expect(await page.evaluate(check), path).toEqual([]); }
  await seed(page);
  for (const s of SCREENS) {
    if (s === "who") await page.evaluate(async () => { const st = await import("/js/store.js"); await st.setMeta("activeProfile", ""); }), await page.goto("/#/who"), await page.reload();
    else await page.goto("/#/" + s);
    await expect(page.locator("#app")).toHaveAttribute("data-route", s.split("/")[0]);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelectorAll("#layer .toast").forEach(t => t.remove()));
    expect(await page.evaluate(check), s).toEqual([]);
  }
  // the word details sheet, scrolled to its actions
  await page.evaluate(async () => { const st = await import("/js/store.js"); const m = await import("/js/model.js"); await st.setMeta("activeProfile", m.profiles()[0].id); });
  await page.goto("/#/words"); await page.reload();
  await page.getByRole("button", { name: "More about this word" }).first().click();
  await page.locator(".sheet .ws-acts").scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  expect(await page.evaluate(check), "word sheet").toEqual([]);
  expect(errors).toEqual([]);
});

test("long words always fit the Words screen on one line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await page.goto("/#/words");
  await page.locator(".words .wword").waitFor();
  for (const w of ["incomprehensibility", "a", "counterrevolutionary"]) {
    await page.evaluate(async (w) => { const ui = await import("/js/ui.js"); const el = document.querySelector(".wslide .wword"); el.textContent = w; ui.fitWord(el); }, w);
    await expect.poll(() => page.evaluate(() => { const el = document.querySelector(".wslide .wword");
      const lines = new Set([...(() => { const g = document.createRange(); g.selectNodeContents(el); return g.getClientRects(); })()].map(x => Math.round(x.top)));
      return { lines: lines.size, fits: el.scrollWidth <= el.parentElement.clientWidth + 1 }; }), { message: w, timeout: 4000 }).toEqual({ lines: 1, fits: true });
  }
});

test("a custom word with symbols works in games", async ({ page }) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  const kinds = await page.evaluate(async () => { const m = await import("/js/model.js"); const w = m.lookup("c++ (lang)"); return ["meaning", "word", "gap", "spell", "unscramble", "flash"].map((k) => m.question(w, k).kind); });
  expect(kinds).toEqual(["meaning", "word", "gap", "gap", "gap", "flash"]);
  expect(errors).toEqual([]);
});

test("welcome shows a sample word and starts setup", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/welcome");
  await expect(page.locator(".wsample .wword")).toHaveText("gentle");
  // With reduced motion the sample never changes on its own
  await page.waitForTimeout(4600);
  await expect(page.locator(".wsample .wword")).toHaveText("gentle");
  await page.getByRole("link", { name: "Get your first word" }).first().click();
  await expect(page.getByRole("heading", { name: /set up your profile/ })).toBeVisible();
});
