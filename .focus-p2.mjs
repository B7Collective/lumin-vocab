import { chromium, devices, BASE, SHOT, watch, onboard, overflow } from "./.focus-lib.mjs";
const log = [];
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage(); watch(page, "parent", log);
const step = async (n, f) => { try { await f(); log.push(`ok ${n}`); } catch (e) { log.push(`FAIL ${n}: ${e.message.split("\n")[0]}`); await page.screenshot({ path: SHOT + `p2-${n.replace(/\W+/g,"_")}.png` }).catch(()=>{}); } };
await step("onboard parent", () => onboard(page, { name: "Dad", role: "An adult" }));
const add = async (name, role) => { await page.goto(BASE + "/#/family"); await page.getByRole("button", { name: "Add profile" }).click(); await page.waitForTimeout(300);
  if (await page.getByLabel("Family PIN").count()) { await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: "Unlock" }).click(); }
  await page.getByRole("button", { name: new RegExp(role) }).click(); await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click(); await page.getByRole("button", { name: "Continue" }).click(); await page.getByRole("button", { name: "Start learning" }).click(); await page.locator(".words .wword").waitFor(); };
await step("add Kid1", () => add("Lily", "A kid"));
// fast double click on Start learning: does it make two profiles?
await step("add Kid2 with double click", async () => { await page.goto(BASE + "/#/who"); await page.getByRole("button", { name: /Add profile/ }).click(); await page.waitForTimeout(300); if (await page.getByLabel("Family PIN").count()) log.push("PIN asked when kid adds profile"); 
  await page.getByRole("button", { name: /A kid/ }).click(); await page.getByLabel("Name").fill("Omar");
  await page.getByRole("button", { name: "Continue" }).dblclick(); await page.waitForTimeout(300); log.push("after dblclick Continue heading: " + await page.locator("h1").first().textContent());
  if (!(await page.getByRole("button", { name: "Start learning" }).count())) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).dblclick(); await page.waitForTimeout(800);
  const names = await page.evaluate(async () => (await import("/js/model.js")).profiles().map(p => p.name)); log.push("profiles after dbl start: " + names.join(",")); });
await step("add Teen", () => add("Zara", "A teen"));
await step("who screen", async () => { await page.goto(BASE + "/#/who"); await page.waitForTimeout(500); await page.screenshot({ path: SHOT + "p2-who.png" }); log.push("who overflow " + await overflow(page)); });
// switch between profiles
for (const n of ["Lily", "Zara", "Dad"]) await step("switch to " + n, async () => { await page.goto(BASE + "/#/who"); await page.getByRole("button", { name: new RegExp(n) }).click(); await page.waitForTimeout(500);
  if (await page.getByLabel("Family PIN").count()) { log.push("PIN asked opening " + n); await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: /Open|Unlock/ }).click(); await page.waitForTimeout(400); }
  const cur = await page.evaluate(async () => { const m = await import("/js/model.js"); return m.profiles().find(p => p.id === (window.app?.pid ?? localStorage.getItem("lumin-pid")))?.name; }); log.push(`now on ${n}, url ${page.url()}, model says ${cur}`); });
await step("set PIN", async () => { await page.goto(BASE + "/#/settings/profile"); await page.getByRole("button", { name: "Set PIN" }).click();
  await page.getByLabel("4 to 8 digits").fill("2468"); await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: "Save", exact: true }).click(); await page.locator(".toast").waitFor(); log.push("toast: " + await page.locator(".toast").textContent()); });
await step("PIN mismatch", async () => { await page.goto(BASE + "/#/settings/profile"); const b = page.getByRole("button", { name: /Change PIN|Set PIN/ }); log.push("pin btn: " + await b.allTextContents()); });
await step("edit kid level", async () => { await page.goto(BASE + "/#/family"); const row = page.locator(".row-item", { hasText: "Lily" }); await row.getByRole("button", { name: "Edit" }).click(); await page.waitForTimeout(300);
  if (await page.getByLabel("Family PIN").count()) { log.push("PIN asked to edit Lily while on Dad"); await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: /Unlock|OK|Open/ }).click(); await page.waitForTimeout(300); }
  const s = page.getByRole("dialog").getByRole("slider"); await s.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); log.push("slider now " + await s.getAttribute("aria-valuetext"));
  await page.screenshot({ path: SHOT + "p2-edit.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click(); await page.waitForTimeout(500);
  log.push("Lily row: " + (await page.locator(".row-item", { hasText: "Lily" }).textContent()));
  log.push("dialogs open after save " + await page.getByRole("dialog").count()); });
await step("delete Omar", async () => { const row = page.locator(".row-item", { hasText: "Omar" }); await row.getByRole("button", { name: "Edit" }).click(); await page.waitForTimeout(300);
  if (await page.getByLabel("Family PIN").count()) { await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: /Unlock|OK|Open/ }).click(); await page.waitForTimeout(300); }
  await page.getByRole("button", { name: "Remove profile" }).click(); await page.waitForTimeout(300); await page.getByRole("button", { name: "Remove", exact: true }).click(); await page.waitForTimeout(800);
  await page.screenshot({ path: SHOT + "p2-afterdelete.png" });
  log.push("dialogs after delete " + await page.getByRole("dialog").count() + "; dialog text: " + (await page.getByRole("dialog").first().textContent().catch(()=>"-")).slice(0, 80));
  log.push("rows: " + (await page.locator(".row-item strong").allTextContents()).join(",")); });
// switch to kid then try to go to parent and settings
await step("kid tries parent stuff", async () => { await page.keyboard.press("Escape"); await page.goto(BASE + "/#/who"); await page.getByRole("button", { name: /Lily/ }).click(); await page.waitForTimeout(400);
  await page.goto(BASE + "/#/family"); await page.waitForTimeout(400); const rows = page.locator(".row-item", { hasText: "Dad" }); await rows.getByRole("button", { name: "Edit" }).click(); await page.waitForTimeout(300);
  log.push("kid edit Dad -> PIN prompt? " + await page.getByLabel("Family PIN").count()); await page.keyboard.press("Escape");
  await page.goto(BASE + "/#/who"); await page.getByRole("button", { name: /Dad/ }).click(); await page.waitForTimeout(300); log.push("kid -> Dad PIN prompt? " + await page.getByLabel("Family PIN").count());
  // wrong pin many times
  for (let k = 0; k < 6; k++) { if (!(await page.getByLabel("Family PIN").count())) { await page.getByRole("button", { name: /Dad/ }).click(); await page.waitForTimeout(200); } await page.getByLabel("Family PIN").fill("000" + k); await page.getByRole("button", { name: /Open|Unlock/ }).click(); await page.waitForTimeout(250); }
  log.push("after 6 wrong PINs toast: " + (await page.locator(".toast").last().textContent().catch(()=>"-"))); });
console.log(log.join("\n"));
await browser.close();
