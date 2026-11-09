// Captures manifest screenshots from a running local server (npm run dev).
import { chromium, devices } from "@playwright/test";
const base = process.env.BASE_URL || "http://127.0.0.1:8787";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
async function cap(ctxOpts, out) {
  const page = await (await browser.newContext(ctxOpts)).newPage();
  await page.goto(base + "/"); await page.getByRole("link", { name: "Get your first word" }).first().click();
  await page.getByLabel("Name").fill("Alex"); await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click(); await page.getByRole("button", { name: "Start learning" }).click();
  await page.evaluate(async () => { const m = await import("/js/model.js"); const s = await import("/js/store.js"); });
  await page.goto(base + "/#/saved"); await page.goto(base + "/#/feed");
  await page.waitForTimeout(3800);
  await page.screenshot({ path: out });
}
await cap({ viewport: { width: 1280, height: 800 } }, "public/icons/screenshot-wide.png");
await cap({ ...devices["iPhone 15 Pro"], deviceScaleFactor: 1, viewport: { width: 390, height: 844 } }, "public/icons/screenshot-phone.png");
await browser.close();
