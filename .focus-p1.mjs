import { chromium, devices, BASE, SHOT, watch, onboard, playThrough, overflow } from "./.focus-lib.mjs";
const log = [];
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ ...devices["iPhone SE"] });
const page = await ctx.newPage(); watch(page, "kid", log);
const step = async (n, f) => { try { await f(); log.push(`ok ${n}`); } catch (e) { log.push(`FAIL ${n}: ${e.message.split("\n")[0]}`); await page.screenshot({ path: SHOT + `p1-${n.replace(/\W+/g,"_")}.png` }).catch(()=>{}); } };
await step("onboard", () => onboard(page, { name: "Mia", role: "A kid" }));
log.push("overflow words " + await overflow(page));
await page.screenshot({ path: SHOT + "p1-words.png" });
await step("journey open", async () => { await page.goto(BASE + "/#/journey"); await page.locator(".jnode.current").waitFor({ timeout: 8000 }); });
log.push("overflow journey " + await overflow(page));
await page.screenshot({ path: SHOT + "p1-journey.png" });
// scenery taps
await step("scenery", async () => {
  const sel = await page.evaluate(() => [...document.querySelectorAll("main *")].filter(e => e.matches("button,[role=button],[tabindex]") && !e.closest(".jnode") && /scen|decor|tree|cloud|critter|animal|prop/i.test(e.className?.baseVal ?? e.className)).map(e => e.className?.baseVal ?? e.className).slice(0, 10));
  log.push("scenery candidates " + JSON.stringify(sel));
  const els = await page.locator("main button:not(.jnode), main [role=button]:not(.jnode)").all();
  log.push("buttons on journey " + els.length);
  for (const el of els.slice(0, 12)) { const t = (await el.getAttribute("aria-label")) || (await el.textContent()).trim().slice(0, 30); if (/trail|Show all|passport|settings/i.test(t)) continue; await el.click({ timeout: 2000 }).catch(e => log.push("scenery click fail " + t)); await page.waitForTimeout(200); if (!page.url().includes("journey")) { log.push("scenery navigated to " + page.url() + " via " + t); await page.goto(BASE + "/#/journey"); } }
});
await step("first stop", async () => { await page.goto(BASE + "/#/journey"); await page.locator(".jnode.current").click(); await playThrough(page); await page.locator(".endcard").waitFor({ timeout: 5000 }); });
await page.screenshot({ path: SHOT + "p1-end.png" });
log.push("overflow end " + await overflow(page));
await step("back to road", async () => { await page.getByRole("button", { name: "Back to the road" }).click(); await page.locator(".jnode.done").first().waitFor({ timeout: 5000 }); });
await step("practice", async () => { await page.goto(BASE + "/#/practice"); await page.waitForTimeout(800); await page.screenshot({ path: SHOT + "p1-practice.png", fullPage: true }); log.push("overflow practice " + await overflow(page));
  const games = await page.locator("main button").allTextContents(); log.push("practice buttons: " + games.map(s=>s.trim().replace(/\s+/g," ").slice(0,25)).join(" | "));
  await page.locator("main .gcard, main button").first().click(); await page.waitForTimeout(800); await page.screenshot({ path: SHOT + "p1-game.png" }); await playThrough(page); });
// double tap on an option
await step("double tap", async () => { await page.goto(BASE + "/#/practice"); await page.locator("main .gcard").nth(1).click(); await page.locator(".opt, .flash, .ltile, .meet, .hkeys").first().waitFor({timeout:5000});
  if (await page.locator(".opt").count()) { await page.locator('.opt[data-right="1"]').first().dblclick(); await page.waitForTimeout(500); log.push("after dblclick answered opts " + await page.locator(".opts.answered").count()); }
  const c = page.getByRole("button", { name: /Continue|See results/ }); if (await c.count()) { await c.dblclick(); await page.waitForTimeout(800); log.push("after continue dblclick: " + (await page.locator(".qprompt .qd").first().textContent().catch(()=>"none"))); }
  await page.screenshot({ path: SHOT + "p1-dbl.png" }); });
// back in middle of game
await step("back mid game", async () => { await page.goto(BASE + "/#/journey"); await page.locator(".jnode.current").click(); await page.waitForTimeout(1000); const u = page.url(); await page.goBack(); await page.waitForTimeout(1000); log.push(`back: ${u} -> ${page.url()}`); await page.screenshot({ path: SHOT + "p1-back.png" }); await page.goForward(); await page.waitForTimeout(800); log.push("forward -> " + page.url()); await page.screenshot({ path: SHOT + "p1-fwd.png" }); });
// landscape
await step("landscape", async () => { await page.goto(BASE + "/#/journey"); await page.locator(".jnode.current").click(); await page.waitForTimeout(800); await page.setViewportSize({ width: 667, height: 375 }); await page.waitForTimeout(800); log.push("overflow landscape game " + await overflow(page)); await page.screenshot({ path: SHOT + "p1-land-game.png" }); await page.goto(BASE + "/#/words"); await page.waitForTimeout(800); log.push("overflow landscape words " + await overflow(page)); await page.screenshot({ path: SHOT + "p1-land-words.png" }); await page.goto(BASE + "/#/journey"); await page.waitForTimeout(800); await page.screenshot({ path: SHOT + "p1-land-journey.png" }); });
console.log(log.join("\n"));
await browser.close();
