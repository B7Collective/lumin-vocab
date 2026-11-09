// Layout standard: on every device, no screen scrolls sideways, nothing sits off screen,
// controls keep their labels on one line, and nothing overlaps.
import { test, expect } from "@playwright/test";

function check() {
  const out = [], vw = document.documentElement.clientWidth;
  const scope = document.querySelector(".sheet") || document.body;
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden"; };
  const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, ".")} "${(el.textContent || "").trim().slice(0, 30)}"`;
  const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return true; return false; };
  if (document.documentElement.scrollWidth > vw + 1) out.push("page scrolls sideways");
  for (const el of scope.querySelectorAll("*")) {
    if (!vis(el) || scroller(el) || getComputedStyle(el).position === "fixed" || el.closest(".scrim")) continue;
    const r = el.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) out.push("off screen: " + label(el));
  }
  for (const el of scope.querySelectorAll(".btn, .chip, .topic, .tabs button, .topnav a, .bottomnav a, .suggest, .kbd, .goal, .status")) {
    if (!vis(el)) continue; const rg = document.createRange(), tops = new Set();
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { rg.selectNodeContents(n); for (const x of rg.getClientRects()) tops.add(Math.round(x.top)); }
    if (tops.size > 1) out.push("label wraps: " + label(el));
  }
  const boxes = [...scope.querySelectorAll("button, a, input, select, h1, h2, h3, p, li, .badge, .avatar, .topic, .tile, .panel, .word")].filter(vis).filter(el => !el.closest(".bottomnav, .scrim"));
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
    const a = model.newProfile({ name: "Alexandra", role: "adult", level: 3 });
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

const SCREENS = ["feed", "categories", "review/practice", "saved", "saved/lists", "saved/history", "saved/mine", "family", "settings", "install", "about", "who"];

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
  expect(errors).toEqual([]);
});

test("the word card always fits the screen and long words never break", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await page.goto("/#/feed");
  await page.locator(".wordcard .word").waitFor();
  for (const w of ["incomprehensibility", "a", "counterrevolutionary"]) {
    await page.evaluate((w) => { const el = document.querySelector(".wordcard .word"); el.textContent = w; }, w);
    await page.evaluate(() => dispatchEvent(new Event("resize")));
    await expect.poll(() => page.evaluate(() => { const el = document.querySelector(".wordcard .word"), st = document.querySelector(".card-stage"), c = document.querySelector(".wordcard");
      const lines = new Set([...(() => { const g = document.createRange(); g.selectNodeContents(el); return g.getClientRects(); })()].map(x => Math.round(x.top)));
      return { lines: lines.size, fitsWide: el.scrollWidth <= c.clientWidth + 1, fitsTall: c.offsetHeight <= st.clientHeight }; }), { message: w, timeout: 4000 })
      .toEqual({ lines: 1, fitsWide: true, fitsTall: true });
  }
});

test("a custom word with symbols works in review", async ({ page }) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.goto("/#/review/practice");
  await page.locator(".prompt .big").waitFor();
  await page.evaluate(async () => { const m = await import("/js/model.js"); m.exercise({ level: 3, spelling: true }, { w: "c++ (lang)", srs: { reps: 3 } }, "blank"); });
  expect(errors).toEqual([]);
});

test("welcome hero switches levels and the underline fits each word", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/welcome");
  const word = page.locator(".w-word"), line = page.locator(".w-uline");
  await expect(word).toHaveText("gentle");
  for (const [level, w] of [["Wordsmith", "ephemeral"], ["Scholar", "pristine"], ["Explorer", "luminous"]]) {
    await page.locator(".w-levels button", { hasText: level }).click();
    await expect(word).toHaveText(w);
    await expect(page.locator(".w-levels button", { hasText: level })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => Math.abs((await line.boundingBox()).width - (await word.boundingBox()).width)).toBeLessThan(2);
  }
  // With reduced motion the words never change on their own
  await page.waitForTimeout(5600);
  await expect(word).toHaveText("luminous");
  await page.getByRole("link", { name: "Get your first word" }).first().click();
  await expect(page.getByRole("heading", { name: /set up your profile/ })).toBeVisible();
});
