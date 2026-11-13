import { chromium, devices, BASE, SHOT, watch, onboard, playThrough, overflow } from "./.focus-lib.mjs";
const log = [];
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ ...devices["iPhone SE"] });
const page = await ctx.newPage(); watch(page, "kid", log);
const step = async (n, f) => { try { await f(); log.push(`ok ${n}`); } catch (e) { log.push(`FAIL ${n}: ${e.message.split("\n")[0]}`); await page.screenshot({ path: SHOT + `p1b-${n.replace(/\W+/g,"_")}.png` }).catch(()=>{}); } };
await step("onboard", () => onboard(page, { name: "Mia", role: "A kid" }));
await page.goto(BASE + "/#/journey"); await page.locator(".jnode.current").waitFor();
await page.waitForTimeout(1500);
await step("scenery", async () => {
  const n = await page.locator(".dc").count(); log.push("decor pieces " + n);
  for (let i = 0; i < n; i++) { const d = page.locator(".dc").nth(i); const bb = await d.boundingBox(); if (!bb) { log.push(`decor ${i} no box`); continue; }
    await d.tap({ timeout: 3000 }).catch(e => log.push(`decor ${i} tap fail: ${e.message.split("\n")[0]}`)); await page.waitForTimeout(300); }
  // tap one rapidly many times
  const d0 = page.locator(".dc").first(); for (let k = 0; k < 8; k++) await d0.tap({ force: true }).catch(()=>{});
  await page.waitForTimeout(1500); await page.screenshot({ path: SHOT + "p1b-scenery.png" });
  log.push("url after scenery " + page.url() + " dialogs " + await page.getByRole("dialog").count());
});
// word chips on journey
await step("word chip sheet then nav", async () => {
  const chip = page.getByRole("button", { name: "cheerful" }); log.push("cheerful chips " + await chip.count());
  if (await chip.count()) { await chip.first().scrollIntoViewIfNeeded(); await chip.first().tap(); await page.waitForTimeout(600); log.push("dialog after chip " + await page.getByRole("dialog").count() + " url " + page.url());
    await page.goBack(); await page.waitForTimeout(600); log.push("after back: dialog " + await page.getByRole("dialog").count() + " url " + page.url());
    if (await page.getByRole("dialog").count()) { await page.goto(BASE + "/#/practice"); await page.waitForTimeout(600); log.push("after goto practice: dialog " + await page.getByRole("dialog").count()); await page.screenshot({ path: SHOT + "p1b-sheetstuck.png" }); }
  }
});
await step("first stop", async () => { await page.goto(BASE + "/#/journey"); await page.waitForTimeout(500); if (await page.getByRole("dialog").count()) { log.push("dialog still open on journey"); await page.keyboard.press("Escape"); }
  await page.locator(".jnode.current").tap(); await page.waitForTimeout(800); await page.screenshot({ path: SHOT + "p1b-stop1.png" }); await playThrough(page); await page.locator(".endcard").waitFor({ timeout: 5000 }); log.push("overflow end " + await overflow(page)); await page.screenshot({ path: SHOT + "p1b-end.png" }); });
await step("back to road", async () => { await page.getByRole("button", { name: "Back to the road" }).click(); await page.locator(".jnode.done").first().waitFor({ timeout: 5000 }); });
console.log(log.join("\n"));
await browser.close();
