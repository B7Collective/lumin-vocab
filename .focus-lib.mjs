import { chromium, devices } from "@playwright/test";
export { chromium, devices };
const expect = null;
// Answer whatever question is showing, wrongly (tiles in their scrambled order are never the word)
export async function answerWrong(page) {
  await page.locator(".flash:not(.flipped), .ltile, .spellin, .opts:not(.answered), .hkeys").first().waitFor();
  if (await page.locator(".hkeys").count()) {
    // Guess the word: press letters that are not in it until the lanterns run out
    const target = await page.evaluate(async () => { const m = await import("/js/model.js"); const d = document.querySelector(".qprompt .qd").textContent.replace(/^Hint: /, ""); return m.WORDS.find((w) => w.d === d).w.toLowerCase(); });
    for (const c of "abcdefghijklmnopqrstuvwxyz") {
      if (target.includes(c)) continue;
      const k = page.locator(`.hkey[aria-label="Letter ${c}"]:not([disabled])`);
      if (!(await page.locator(".hkeys").count()) || await page.getByRole("button", { name: /Continue|See results/ }).count()) break;
      if (await k.count()) await k.click();
    }
    return true;
  }
  if (await page.locator(".flash").count()) { await page.locator(".flash").click(); await page.getByRole("button", { name: "Still learning" }).click(); return false; }
  if (await page.locator(".ltile").count()) { for (const t of await page.locator(".ltile").all()) await t.click(); return true; }
  if (await page.locator(".spellin").count()) { await page.locator(".spellin").fill("zzzz"); await page.getByRole("button", { name: "Check" }).click(); return true; }
  await page.locator('.opt[data-right="0"]').first().click();
  return true;
}
export const word = (page) => page.locator(".wslide").first().getAttribute("data-word");
// Play through a session, answering every option question right (or wrong when asked)
export async function playThrough(page, { wrongAt = -1 } = {}) {
  const wordFor = (page) => page.evaluate(async () => { const m = await import("/js/model.js"); const d = document.querySelector(".qprompt .qd").textContent.replace(/^Hint: /, ""); return m.WORDS.find((w) => w.d === d).w; });
  for (let n = 0; n < 60; n++) {
    await page.locator(".endcard, .flash:not(.flipped), .meet, .ltile, .spellin:not([disabled]), .opts:not(.answered), .hkeys, .bbank, .pairs, .wsgrid, .memo, .story").first().waitFor();
    if (await page.locator(".endcard").count()) return;
    const flash = page.locator(".flash");
    if (await flash.count()) { await flash.click(); await page.getByRole("button", { name: "Knew it", exact: true }).click(); await page.waitForTimeout(350); continue; }
    if (await page.locator("textarea.mine").count()) {
      const w = await page.locator(".meethead .qw").textContent();
      await page.locator("textarea.mine").fill(`Today I thought about the word ${w} at home.`);
      await page.getByRole("button", { name: "Save my sentence" }).click(); await page.waitForTimeout(350); continue;
    }
    if (await page.locator(".meet").count()) { await page.locator(".pfoot .btn.primary").click(); await page.waitForTimeout(300); continue; }
    if (await page.locator(".pairs").count()) {
      const ks = await page.evaluate(() => [...document.querySelectorAll(".pc.pcw:not(.done)")].map((x) => x.dataset.w));
      for (const k of ks) { await page.locator(`.pc.pcw[data-w="${k}"]`).click(); await page.locator(`.pc.pcd[data-w="${k}"]`).click(); }
      await page.waitForTimeout(900); continue;
    }
    if (await page.locator(".memo").count()) {
      const cards = await page.evaluate(async () => { const m = await import("/js/model.js"); return [...document.querySelectorAll(".mcard .mfront")].map((f) => { const t = f.textContent; const w = m.WORDS.find((x) => x.w === t) || m.WORDS.find((x) => x.d === t); return w ? w.w : t; }); });
      const done = new Set();
      for (let a = 0; a < cards.length; a++) { if (done.has(a)) continue; const b = cards.findIndex((x, k) => k !== a && x === cards[a]); done.add(a); done.add(b);
        await page.locator(".mcard").nth(a).click(); await page.locator(".mcard").nth(b).click(); await page.waitForTimeout(250); }
      await page.waitForTimeout(1000); continue;
    }
    if (await page.locator(".story").count()) {
      const answers = await page.evaluate(async () => { const m = await import("/js/model.js"); return [...document.querySelectorAll(".sline")].map((l) => { const txt = l.textContent; const bank = [...document.querySelectorAll(".bbank .btile")].map((b) => b.dataset.w); const norm = (x) => x.replace(/\b(a\/an|an|a) /gi, "").replace(/\s+/g, " ").trim(); return bank.find((w) => m.sentences(m.BY.get(w)).some((s) => norm(s.replace(new RegExp(`(^|[^\\w])${m.escapeRe(w)}(?![\\w])`, "i"), "$1")) === norm(txt))) || bank[0]; }); });
      for (let k = 0; k < answers.length; k++) { await page.locator(`.bbank .btile[data-w="${answers[k]}"]`).click(); await page.locator(".sgap").nth(k).click(); }
      await page.getByRole("button", { name: "Check" }).click();
      await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(400); continue;
    }
    if (await page.locator(".wsgrid").count()) { await page.getByRole("button", { name: "Show the rest" }).click(); await page.waitForTimeout(1300); continue; }
    if (await page.locator(".hkeys").count()) {
      const target = await wordFor(page);
      for (const c of new Set(target.toLowerCase().replace(/[^a-z]/g, ""))) { const k = page.locator(`.hkey[aria-label="Letter ${c}"]:not([disabled])`); if (await k.count()) await k.click(); }
    } else if (await page.locator(".bbank").count()) {
      const sent = await page.evaluate(async () => { const m = await import("/js/model.js"); const tiles = [...document.querySelectorAll(".bbank .btile")].map((b) => b.textContent); return m.WORDS.flatMap((w) => m.sentences(w)).find((x) => { const t = x.trim().split(/\s+/); return t.length === tiles.length && [...t].sort().join("|") === [...tiles].sort().join("|"); }); });
      for (const t of sent.trim().split(/\s+/)) await page.evaluate((t) => [...document.querySelectorAll(".bbank .btile:not(.used)")].find((b) => b.textContent === t).click(), t);
      await page.getByRole("button", { name: "Check" }).click();
    } else if (await page.locator(".ltile").count()) {
      const target = await wordFor(page);
      for (const ch of target) await page.locator(".ltile:not(.used)", { hasText: new RegExp(`^${ch}$`) }).first().click();
    } else if (await page.locator(".spellin:not([disabled])").count()) {
      const target = await wordFor(page);
      await page.locator(".spellin").fill(target); await page.getByRole("button", { name: "Check" }).click();
    } else {
      await page.locator(".opt").first().waitFor();
      await page.locator(n === wrongAt ? '.opt[data-right="0"]' : '.opt[data-right="1"]').first().click();
    }
    const cont = page.getByRole("button", { name: /Continue|See results/ });
    await Promise.race([cont.waitFor({ timeout: 2500 }).then(() => cont.click()).catch(() => {}), page.waitForTimeout(1100)]);
  }
}

export const BASE = "http://127.0.0.1:8787";
export const SHOT = "/tmp/claude-0/-home-claude/8b9c25c7-7a29-5190-b4be-dac30109a355/scratchpad/focus/";
export function watch(page, tag, log) {
  page.on("pageerror", (e) => log.push(`[${tag}] PAGEERROR ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) log.push(`[${tag}] CONSOLE ${m.text()}`); });
}
export async function onboard(page, { name = "Alex", role = "An adult" } = {}) {
  await page.goto(BASE + "/");
  await page.getByRole("link", { name: "Get your first word" }).first().click();
  await page.getByRole("button", { name: new RegExp(role) }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).click();
  await page.locator(".words .wword").waitFor();
}
export async function overflow(page) { return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }
