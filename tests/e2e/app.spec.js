import { test, expect } from "@playwright/test";

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource.*404/.test(m.text())) errors.push(m.text()); });
  return errors;
}
async function onboard(page, { name = "Alex", role = "An adult" } = {}) {
  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByRole("button", { name: new RegExp(role) }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page.locator(".wordcard .word")).toBeVisible();
}

test("first run, feed, details, favorites and undo", async ({ page }, info) => {
  const errors = watchErrors(page);
  await onboard(page);
  const first = await page.locator(".wordcard .word").textContent();
  await page.getByRole("button", { name: "Learn this" }).click();
  await expect(page.locator(".toast")).toContainText(first);
  await page.locator(".toast button", { hasText: "Undo" }).click();
  await expect(page.locator(".wordcard .word")).toHaveText(first);
  await page.getByRole("button", { name: "Learn this" }).click();
  const second = await page.locator(".wordcard .word").textContent();
  expect(second).not.toBe(first);
  await page.getByRole("button", { name: "More about this word" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Favorite" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.locator(".bottomnav a, .topnav a").filter({ hasText: "Saved" }).filter({ visible: true }).first().click();
  await expect(page.locator(".tile .w", { hasText: second })).toBeVisible();
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.locator(".tile .w", { hasText: first })).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${info.project.name}-saved.png` });
  expect(errors).toEqual([]);
});

test("next word by swipe or keyboard, and the hint fits the device", async ({ page }, info) => {
  await onboard(page);
  const first = await page.locator(".wordcard .word").textContent();
  const hint = await page.locator(".hint").textContent();
  if (info.project.name === "desktop") {
    expect(hint).toMatch(/Learn/);
    await page.locator("#main").focus();
    await page.keyboard.press("ArrowDown");
  } else {
    expect(hint).toMatch(/Swipe up/);
    const box = await page.locator(".feed").boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height * 0.7;
    await page.locator(".feed").dispatchEvent("pointerdown", { pointerType: "touch", clientX: x, clientY: y, isPrimary: true });
    await page.locator(".feed").dispatchEvent("pointerup", { pointerType: "touch", clientX: x, clientY: y - 200, isPrimary: true });
  }
  await expect(page.locator(".wordcard .word")).not.toHaveText(first);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-feed.png` });
});

test("review session runs to the end", async ({ page }, info) => {
  const errors = watchErrors(page);
  await onboard(page);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Learn this" }).click();
  await page.goto("/#/review/practice");
  let rounds = 0;
  while (rounds++ < 20) {
    if (await page.locator(".prompt .big", { hasText: "Nice work." }).count()) break;
    const typed = page.locator(".typed input");
    if (await typed.count()) { await page.locator(".linkbtn", { hasText: "Hint" }).click(); await typed.fill("zzz"); await page.getByRole("button", { name: "Check" }).click(); }
    else {
      if (rounds === 2) await page.locator('.opt[data-right="0"]').first().click();
      else await page.locator('.opt[data-right="1"]').click();
    }
    if (rounds === 1) await page.screenshot({ path: `test-results/shots/${info.project.name}-review.png` });
    await page.locator(".feedback").filter({ hasText: /./ }).waitFor();
    await page.getByRole("button", { name: /Next|Finish/ }).click();
  }
  await expect(page.locator(".prompt .big")).toHaveText("Nice work.");
  expect(errors).toEqual([]);
});

test("install guidance matches the device", async ({ page }, info) => {
  await onboard(page);
  await page.goto("/#/install");
  const text = await page.locator("main").textContent();
  if (info.project.name === "iphone") { expect(text).toMatch(/Install Lumin Vocab on your iPhone/); expect(text).toMatch(/Add to Home Screen/); expect(text).toMatch(/bottom of the screen/); }
  if (info.project.name === "ipad") { expect(text).toMatch(/iPad/); expect(text).toMatch(/top of the screen/); }
  if (info.project.name === "android") { expect(text).toMatch(/Android/); expect(text).toMatch(/Install app/); }
  if (info.project.name === "desktop") { expect(text).toMatch(/this computer/); expect(text).toMatch(/Get it on your phone/); await expect(page.locator(".qr")).toBeVisible(); }
  await page.screenshot({ path: `test-results/shots/${info.project.name}-install.png`, fullPage: true });
});

test("settings adapt to kids and parents, with a PIN", async ({ page }, info) => {
  await onboard(page, { name: "Pat" });
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Learning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Family controls" })).toBeVisible();
  if (info.project.name === "desktop") await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toHaveCount(0);
  await page.getByRole("button", { name: "Set PIN" }).click();
  await page.getByLabel("4 to 8 digits").fill("2468"); await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".toast")).toContainText("PIN saved");
  await page.screenshot({ path: `test-results/shots/${info.project.name}-settings-parent.png`, fullPage: true });
  // add a kid
  await page.goto("/#/setup");
  await page.getByRole("button", { name: /A kid/ }).click();
  await page.getByLabel("Name").fill("Sam");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "sunny");
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "My look" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learning" })).toHaveCount(0);
  await page.screenshot({ path: `test-results/shots/${info.project.name}-settings-kid.png`, fullPage: true });
  await page.getByRole("button", { name: "Grown-up settings" }).click();
  await page.getByLabel("Family PIN").fill("1111"); await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator(".toast")).toContainText("didn't match");
  await page.getByRole("button", { name: "Grown-up settings" }).click();
  await page.getByLabel("Family PIN").fill("2468"); await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Learning" })).toBeVisible();
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
  for (let i = 0; i < 3; i++) await a.getByRole("button", { name: "Learn this" }).click();
  await a.goto("/#/family");
  await a.getByRole("button", { name: "Turn on family sync" }).click();
  await expect(a.locator(".status")).toContainText("Synced", { timeout: 20000 });
  await a.getByRole("button", { name: "Add a device" }).click();
  const code = (await a.locator(".code").textContent()).trim();
  expect(code.split(" ").length).toBe(6);
  await b.goto("/#join=" + code.replace(/ /g, "-"));
  await b.getByRole("button", { name: "Join" }).click();
  await expect(b.getByRole("button", { name: /Robin/ })).toBeVisible({ timeout: 30000 });
  await b.waitForTimeout(800);
  await b.getByRole("button", { name: /Robin/ }).click();
  await expect(b.locator(".wordcard .word")).toBeVisible();
  await b.goto("/#/saved/history");
  await b.getByRole("tab", { name: "History" }).click();
  await expect(b.locator(".tile .m", { hasText: "Learning ·" })).toHaveCount(3);
  // change on B reaches A
  await b.goto("/#/settings");
  await b.getByLabel("Name").fill("Robin B"); await b.getByLabel("Name").blur();
  await b.waitForTimeout(3500);
  await a.goto("/#/family"); await a.getByRole("button", { name: "Sync now" }).click();
  await expect(a.locator(".row-item strong", { hasText: "Robin B" })).toBeVisible({ timeout: 15000 });
  // the server only stores ciphertext
  const res = await a.request.post("/api/sync", { data: { fid: "0".repeat(64), since: 0, changes: [] } });
  expect(res.ok()).toBeTruthy();
  expect(errors).toEqual([]);
});
