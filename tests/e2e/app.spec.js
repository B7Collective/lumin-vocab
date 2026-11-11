import { test, expect } from "@playwright/test";

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource.*404/.test(m.text())) errors.push(m.text()); });
  return errors;
}
async function onboard(page, { name = "Alex", role = "An adult" } = {}) {
  await page.goto("/");
  await page.getByRole("link", { name: "Get your first word" }).first().click();
  await page.getByRole("button", { name: new RegExp(role) }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page.locator(".words .wword")).toBeVisible();
}

// Answer whatever question is showing, wrongly (tiles in their scrambled order are never the word)
async function answerWrong(page) {
  await page.locator(".flash:not(.flipped), .ltile, .spellin, .opts:not(.answered)").first().waitFor();
  if (await page.locator(".flash").count()) { await page.locator(".flash").click(); await page.getByRole("button", { name: "Still learning" }).click(); return false; }
  if (await page.locator(".ltile").count()) { for (const t of await page.locator(".ltile").all()) await t.click(); return true; }
  if (await page.locator(".spellin").count()) { await page.locator(".spellin").fill("zzzz"); await page.getByRole("button", { name: "Check" }).click(); return true; }
  await page.locator('.opt[data-right="0"]').first().click();
  return true;
}
const word = (page) => page.locator(".wslide").first().getAttribute("data-word");
// Play through a session, answering every option question right (or wrong when asked)
async function playThrough(page, { wrongAt = -1 } = {}) {
  for (let n = 0; n < 40; n++) {
    await page.locator(".endcard, .flash:not(.flipped), .ltile, .spellin, .opts:not(.answered)").first().waitFor();
    if (await page.locator(".endcard").count()) return;
    const flash = page.locator(".flash");
    if (await flash.count()) { await flash.click(); await page.getByRole("button", { name: "I knew it" }).click(); await page.waitForTimeout(350); continue; }
    if (await page.locator(".ltile").count()) {
      const target = await page.evaluate(async () => { const m = await import("/js/model.js"); const d = document.querySelector(".qprompt .qd").textContent; return m.WORDS.find((w) => w.d === d).w; });
      for (const ch of target) await page.locator(".ltile:not(.used)", { hasText: new RegExp(`^${ch}$`) }).first().click();
    } else if (await page.locator(".spellin").count()) {
      const target = await page.evaluate(async () => { const m = await import("/js/model.js"); const d = document.querySelector(".qprompt .qd").textContent; return m.WORDS.find((w) => w.d === d).w; });
      await page.locator(".spellin").fill(target); await page.getByRole("button", { name: "Check" }).click();
    } else {
      await page.locator(".opt").first().waitFor();
      await page.locator(n === wrongAt ? '.opt[data-right="0"]' : '.opt[data-right="1"]').first().click();
    }
    const cont = page.getByRole("button", { name: /Continue|See results/ });
    await Promise.race([cont.waitFor({ timeout: 2500 }).then(() => cont.click()).catch(() => {}), page.waitForTimeout(1100)]);
  }
}

test("first run: the word screen, heart, save, details and library", async ({ page }, info) => {
  const errors = watchErrors(page);
  await onboard(page);
  const first = await word(page);
  expect(first).toBeTruthy();
  const fav = page.locator(".wslide .fav").first();
  await fav.click();
  await expect(fav).toHaveAttribute("aria-pressed", "true");
  await page.locator(".wslide .save").first().click();
  await expect(page.locator(".toast")).toContainText(first);
  await page.getByRole("button", { name: "More about this word" }).click();
  await expect(page.getByRole("dialog")).toContainText("Meaning");
  await page.getByRole("button", { name: "Close" }).click();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-words.png` });
  await page.goto("/#/library/favorites");
  await expect(page.locator(".wcard .w", { hasText: first })).toBeVisible();
  await page.goto("/#/library/saved");
  await expect(page.locator(".wcard .w", { hasText: first })).toBeVisible();
  await page.goto("/#/you");
  await expect(page.locator(".stat", { hasText: "Learning" }).locator("b")).toHaveText("1");
  await expect(page.locator(".streak .n")).toHaveText("1");
  expect(errors).toEqual([]);
});

test("next word by swipe or keyboard, and back again", async ({ page }, info) => {
  await onboard(page);
  const first = await word(page);
  if (info.project.name === "desktop") await page.keyboard.press("ArrowDown");
  else {
    const box = await page.locator(".words").boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height * 0.45;
    await page.locator(".words").dispatchEvent("pointerdown", { pointerType: "touch", clientX: x, clientY: y, isPrimary: true, pointerId: 1 });
    await page.locator(".words").dispatchEvent("pointermove", { pointerType: "touch", clientX: x, clientY: y - 220, isPrimary: true, pointerId: 1 });
    await page.locator(".words").dispatchEvent("pointerup", { pointerType: "touch", clientX: x, clientY: y - 220, isPrimary: true, pointerId: 1 });
  }
  await expect.poll(() => word(page)).not.toBe(first);
  await page.waitForTimeout(700);
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => word(page)).toBe(first);
});

test("a Journey chapter moves forward step by step", async ({ page }, info) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.goto("/#/journey");
  await expect(page.locator(".jnode.current .nm")).toHaveText("Meet the words");
  await page.screenshot({ path: `test-results/shots/${info.project.name}-journey.png` });
  await page.locator(".jnode.current").click();
  await playThrough(page);
  await expect(page.locator(".endcard")).toBeVisible();
  await page.getByRole("button", { name: "Back to the road" }).click();
  await expect(page.locator(".jnode.current .nm")).toHaveText("What they mean");
  await expect(page.locator(".jnode.done")).toHaveCount(1);
  // locked steps say so instead of opening
  await page.locator(".jnode.locked").first().click();
  await expect(page.locator(".toast")).toContainText("Finish the step");
  await page.locator(".jnode.current").click();
  await playThrough(page);
  await page.getByRole("button", { name: "Back to the road" }).click();
  await expect(page.locator(".jnode.done")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("the Journey is paced: one chapter a day, regions and lookouts", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  const errors = watchErrors(page);
  await onboard(page);
  const shape = await page.evaluate(async () => { const m = await import("/js/model.js"); const ch = m.chapterWords(4); return { total: ch.length, lookouts: ch.map((c, i) => c.lookout ? i : -1).filter((i) => i >= 0).slice(0, 3), region10: m.regionOf(10)[1] }; });
  expect(shape.total).toBeGreaterThan(120);
  expect(shape.lookouts).toEqual([4, 9, 14]);
  expect(shape.region10).toBe("The Misty Forest");
  // Jump to the chapter check, pass it, and make camp
  await page.evaluate(async () => { const m = await import("/js/model.js"); const p = m.profiles()[0]; m.saveProfile({ ...p, journey: { 4: { ch: 0, step: 5, stars: {}, log: [], started: Date.now() } } }); });
  await page.goto("/#/journey");
  await expect(page.locator(".jregion")).toContainText("The Lavender Fields");
  await page.locator(".jnode.current").click();
  await playThrough(page);
  await page.getByRole("button", { name: "Back to the road" }).click();
  await expect(page.getByRole("dialog")).toContainText("Landmark reached");
  await page.getByRole("button", { name: "Make camp" }).click();
  await expect(page.locator(".camp h2")).toHaveText("Camp for tonight");
  await expect(page.locator(".camp")).toContainText("tomorrow");
  await page.screenshot({ path: `test-results/shots/${info.project.name}-camp.png` });
  // The log keeps the stop, and tomorrow the road opens again
  await expect(page.locator(".pstrip .pstamp")).toHaveCount(1);
  await page.getByRole("button", { name: "Open your passport" }).click();
  await expect(page.locator(".passport .pstamp")).toHaveCount(1);
  // a past stop can be looked back on and replayed, with save, favorite and list buttons for each word
  await page.locator(".passport .pstamp").first().click();
  await expect(page.locator(".keepsake")).toBeVisible();
  await expect(page.locator(".sheet .wcard")).toHaveCount(6);
  await expect(page.locator(".sheet .wcard").first().getByRole("button", { name: /Add .* to a list/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(async () => { const m = await import("/js/model.js"); const p = m.profiles()[0]; const j = p.journey[4]; m.saveProfile({ ...p, journey: { 4: { ...j, openOn: "2000-01-01" } } }); });
  await page.goto("/#/practice"); await page.goto("/#/journey");
  await expect(page.locator(".jnode.current .nm")).toHaveText("Meet the words");
  expect(errors).toEqual([]);
});

test("practice games score answers and challenges keep their rules", async ({ page }, info) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.goto("/#/practice");
  await page.getByRole("button", { name: /Fill the gap/ }).click();
  await expect(page.locator(".qkind").first()).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-game.png` });
  await playThrough(page, { wrongAt: 1 });
  await expect(page.locator(".endcard h1")).toHaveText(/Well done|Keep going|Perfect/);
  await expect(page.locator(".score")).toContainText("Accuracy");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: /Rush/ }).click();
  await expect(page.locator(".pstat .icon")).toHaveCount(3);
  for (let k = 0; k < 3; k++) { if (await answerWrong(page)) await page.getByRole("button", { name: /Continue|See results/ }).click(); else await page.waitForTimeout(400); }
  await expect(page.locator(".endcard")).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: /Sprint/ }).click();
  await expect(page.locator(".pstat")).toContainText(/\d+/);
  expect(errors).toEqual([]);
});

test("the level check suggests a level", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  await onboard(page);
  await page.goto("/#/practice");
  await page.getByRole("button", { name: "Take the level check" }).click();
  for (let k = 0; k < 12; k++) { await page.locator(k < 6 ? '.opt[data-right="1"]' : '.opt[data-right="0"]').first().click(); await page.waitForTimeout(150); const c = page.getByRole("button", { name: /Continue|See results/ }); if (await c.count()) await c.click(); await page.waitForTimeout(700); }
  await expect(page.locator(".endcard h1")).toHaveText("You're a Scholar");
  await page.getByRole("button", { name: "Switch to Scholar" }).click();
  await expect(page.locator(".jtop .eyebrow")).toContainText("Scholar");
});

test("install guidance matches the device", async ({ page }, info) => {
  await onboard(page);
  await page.goto("/#/install");
  await expect(page.locator("main h1")).toContainText("Install");
  const text = await page.locator("main").textContent();
  if (info.project.name === "iphone") { expect(text).toMatch(/Install Lumin Vocab on your iPhone/); expect(text).toMatch(/Add to Home Screen/); expect(text).toMatch(/bottom of the screen/); }
  if (info.project.name === "ipad") { expect(text).toMatch(/iPad/); expect(text).toMatch(/top of the screen/); }
  if (info.project.name === "android") { expect(text).toMatch(/Android/); expect(text).toMatch(/Install app/); }
  if (info.project.name === "desktop") { expect(text).toMatch(/this computer/); expect(text).toMatch(/Get it on your phone/); await expect(page.locator(".qr")).toBeVisible(); }
  await page.screenshot({ path: `test-results/shots/${info.project.name}-install.png`, fullPage: true });
});

test("settings adapt to kids and parents, with a PIN", async ({ page }, info) => {
  await onboard(page, { name: "Pat" });
  await page.goto("/#/settings/learning");
  // settings are split into tabs, one group on screen at a time
  const tabs = page.getByRole("navigation", { name: "Settings sections" });
  await expect(tabs.getByRole("button")).toHaveText(["Learning", "Look", "Sound", "Profile", "App"]);
  await expect(page.getByRole("slider", { name: "Difficulty" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Topics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Family controls" })).toBeHidden();
  await tabs.getByRole("button", { name: "App" }).click();
  await expect(page).toHaveURL(/#\/settings\/app$/);
  if (info.project.name === "desktop") await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toHaveCount(0);
  await tabs.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { name: "Family controls" })).toBeVisible();
  await page.getByRole("button", { name: "Set PIN" }).click();
  await page.getByLabel("4 to 8 digits").fill("2468"); await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("PIN saved");
  await page.screenshot({ path: `test-results/shots/${info.project.name}-settings-parent.png`, fullPage: true });
  // add a kid
  await page.goto("/#/setup");
  await page.getByRole("button", { name: /A kid/ }).click();
  await page.getByLabel("Name").fill("Sam");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page.locator(".words .wword")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "My look" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learning" })).toHaveCount(0);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-settings-kid.png`, fullPage: true });
  await page.getByRole("button", { name: "Grown-up settings" }).click();
  await page.getByLabel("Family PIN").fill("1111"); await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator(".toast")).toContainText("didn't match");
  await page.getByRole("button", { name: "Grown-up settings" }).click();
  await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Learning" })).toBeVisible();
  // parent profile is locked from the picker
  await page.goto("/#/who");
  await page.getByRole("button", { name: /Pat/ }).click();
  await expect(page.getByLabel("Family PIN")).toBeVisible();
});

test("two devices sync through the server, end to end encrypted", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext({ ...info.project.use, viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true })).newPage();
  const errors = [...watchErrors(a)];
  await onboard(a, { name: "Robin" });
  for (let i = 0; i < 3; i++) { const w = await word(a); await a.locator(".wslide .save").first().click(); await a.keyboard.press("ArrowDown"); await expect.poll(() => word(a)).not.toBe(w); await a.waitForTimeout(600); }
  await a.goto("/#/family");
  await a.getByRole("button", { name: "Turn on sync" }).click();
  await expect(a.locator(".status")).toContainText("Synced", { timeout: 20000 });
  await a.getByRole("button", { name: "Add a device" }).click();
  const code = (await a.locator(".code").textContent()).trim();
  expect(code.split(" ").length).toBe(6);
  await b.goto("/#join=" + code.replace(/ /g, "-"));
  await b.getByRole("button", { name: "Join" }).click();
  await expect(b.getByRole("button", { name: /Robin/ })).toBeVisible({ timeout: 30000 });
  await b.waitForTimeout(800);
  await b.getByRole("button", { name: /Robin/ }).click();
  await expect(b.locator(".words .wword")).toBeVisible();
  await b.goto("/#/you");
  await expect(b.locator(".stat", { hasText: "Learning" }).locator("b")).toHaveText("3");
  // change on B reaches A
  await b.goto("/#/settings/profile");
  await b.getByLabel("Name").fill("Robin B"); await b.getByLabel("Name").blur();
  await b.waitForTimeout(3500);
  await a.goto("/#/family"); await a.getByRole("button", { name: "Sync now" }).click();
  await expect(a.locator(".row-item strong", { hasText: "Robin B" })).toBeVisible({ timeout: 15000 });
  // Live progress: B sits on History. A learns a word and is put away right after (phone locked).
  // B is switched back to, and its open screen shows the new word without a reload or a Sync button.
  const switchTo = (pg, hidden) => pg.evaluate((h) => { Object.defineProperty(document, "hidden", { value: h, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }, hidden);
  await b.goto("/#/you");
  await expect(b.locator(".stat", { hasText: "Learning" }).locator("b")).toHaveText("3");
  await a.goto("/#/words");
  await a.locator(".words .wword").waitFor();
  await a.locator(".wslide .save").first().click();
  await switchTo(a, true);
  await a.waitForTimeout(400); // shorter than the normal 1 second delay, so only the send-on-hide can deliver it in time
  await switchTo(b, false);
  await expect(b.locator(".stat", { hasText: "Learning" }).locator("b")).toHaveText("4", { timeout: 10000 });
  // An empty check is read-only: nothing new means nothing written
  const fid = "e".repeat(64);
  const empty = await a.request.post("/api/sync", { data: { fid, since: 0, changes: [] } });
  expect(await empty.json()).toEqual({ seq: 0, more: false, changes: [] });
  // the server only stores ciphertext
  const res = await a.request.post("/api/sync", { data: { fid: "0".repeat(64), since: 0, changes: [] } });
  expect(res.ok()).toBeTruthy();
  expect(errors).toEqual([]);
});

test("topics filter the words and stay age appropriate", async ({ page }, info) => {
  const errors = watchErrors(page);
  await onboard(page, { name: "Kim", role: "A kid" });
  await page.getByRole("link", { name: "All words" }).click();
  await expect(page.getByRole("heading", { name: "Topics" })).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-topics.png`, fullPage: true });
  await page.locator(".ttile", { hasText: "Animals" }).click();
  await expect(page.locator(".hudchip", { hasText: "Animals" })).toBeVisible();
  const levels = await page.evaluate(async () => { const m = await import("/js/model.js"); const p = m.profiles()[0]; return m.queue(p).map((w) => w.l); });
  expect(levels.length).toBeGreaterThan(10);
  expect(Math.max(...levels)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("side trails walk at their own pace, and the difficulty slider moves by keyboard", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  const errors = watchErrors(page);
  await onboard(page);
  await page.goto("/#/journey");
  await expect(page.locator(".trails .gcard").first()).toBeVisible();
  await page.getByRole("button", { name: /Show all \d+ trails/ }).click();
  await page.locator(".trails .gcard", { hasText: "Mix-Ups" }).click();
  await expect(page.getByRole("heading", { name: "Mix-Ups" })).toBeVisible();
  await page.locator(".jnode.current").click();
  await playThrough(page);
  await page.getByRole("button", { name: "Back to the trail" }).click();
  await expect(page.locator(".jnode.current .nm")).toHaveText("Which one?");
  // mix-up questions offer the pair
  await page.locator(".jnode.current").click();
  await expect(page.locator(".opts.two .opt")).toHaveCount(2);
  await page.goto("/#/settings/learning");
  const slider = page.getByRole("slider", { name: "Difficulty" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuetext", /Wordsmith/);
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuetext", /Sprout/);
  const lv = await page.evaluate(async () => { const m = await import("/js/model.js"); return m.profiles()[0].level; });
  expect(lv).toBe(0);
  expect(errors).toEqual([]);
});

test("works offline after the first visit", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  await onboard(page, { name: "Lee" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".words .wword")).toBeVisible();
  await page.goto("/#/journey");
  await expect(page.locator(".jnode.current")).toBeVisible();
  await context.setOffline(false);
});

test("sync server rejects unsafe requests", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "server checks run once");
  const fid = "a".repeat(64);
  expect((await request.post("/api/sync", { headers: { "content-type": "text/plain" }, data: JSON.stringify({ fid, since: 0, changes: [] }) })).status()).toBe(415);
  expect((await request.post("/api/sync", { headers: { "content-type": "application/json" }, data: "x".repeat(1_100_000) })).status()).toBe(413);
  expect((await request.post("/api/sync", { data: { fid: "nope", since: 0, changes: [] } })).status()).toBe(400);
  expect((await request.post("/api/sync", { data: { fid, since: 0, changes: [{ id: "a".repeat(32), u: 1, d: 0, c: "x".repeat(16_001) }] } })).status()).toBe(400);
  expect((await request.get("/api/sync")).status()).toBe(405);
  const ok = await request.post("/api/sync", { data: { fid: "b".repeat(64), since: 0, changes: [{ id: "c".repeat(32), u: 1, d: 0, c: "abc" }] } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.changes).toEqual([{ id: "c".repeat(32), u: 1, d: 0, c: "abc" }]);
  const page = await request.get("/");
  expect(page.headers()["content-security-policy"]).toContain("style-src 'self';");
});

test("every word served comes from the chosen level", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "data check, one browser is enough");
  await page.goto("/#/setup");
  const res = await page.evaluate(async () => {
    const m = await import("/js/model.js");
    for (let i = 0; i < 100 && !(m.WORDS.length && m.TRAILS.length); i++) await new Promise((r) => setTimeout(r, 100));
    const out = [];
    for (let lv = 0; lv <= m.MAX_LEVEL; lv++) {
      const p = m.profile(m.newProfile({ name: "L" + lv, role: lv <= 1 ? "kid" : lv <= 3 ? "teen" : "adult", level: lv }).id);
      const lists = [m.queue(p), m.chapterWords(lv).flatMap((c) => c.words), m.practicePool(p, 40)];
      for (const t of Object.keys(m.topicCounts(p))) lists.push(m.queue({ ...p, feedTopic: t }));
      for (const s of ["beautiful", "funny"]) lists.push(m.queue({ ...p, feedSet: s }));
      for (const t of m.trailsFor(p)) lists.push(m.trailWords(t, p));
      lists.push(lists[0].slice(0, 40).flatMap((w) => m.distractors(w, 3, "d")));
      const all = lists.flat();
      const sets = ["beautiful", "funny"].map((k) => m.MAIN.filter((w) => w.x && w.x.includes(k) && w.l === lv).length);
      const trails = m.trailsFor(p).map((t) => [t.key, m.trailWords(t, p).length]);
      out.push({ lv, size: lists[0].length, outside: all.filter((w) => w.l !== lv).map((w) => w.w), sets, trails });
    }
    return out;
  });
  for (const r of res) {
    expect(r.outside, `level ${r.lv} shows words from other levels`).toEqual([]);
    expect(r.size, `level ${r.lv} has enough words`).toBeGreaterThanOrEqual(1100);
    // the side packs and side trails follow the level too, with a real set of words at every level
    for (const n of r.sets) expect(n, `level ${r.lv} collection size`).toBeGreaterThanOrEqual(9);
    expect(r.trails.length, `level ${r.lv} side trails`).toBeGreaterThanOrEqual(15);
    for (const [k, n] of r.trails) expect(n, `${k} at level ${r.lv}`).toBeGreaterThanOrEqual(9);
  }
});

test("words play their recorded audio in the chosen voice", async ({ page }) => {
  const clips = [];
  page.on("response", (r) => { if (r.url().includes("/audio/")) clips.push([new URL(r.url()).pathname, r.status()]); });
  await onboard(page, { name: "Lee" });
  const word = (await page.locator(".words .wword").first().innerText()).trim();
  const slug = word.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  await page.getByRole("button", { name: new RegExp(`^Hear ${word}`) }).first().click();
  await expect.poll(() => clips.some(([u, s]) => u === `/audio/us/${slug}.mp3` && s === 200)).toBe(true);
  // switch to the British voice: it plays a sample
  await page.goto("/#/settings/sound");
  await page.getByRole("radio", { name: "British" }).click();
  await expect.poll(() => clips.some(([u, s]) => u === "/audio/gb/luminous.mp3" && s === 200)).toBe(true);
});
