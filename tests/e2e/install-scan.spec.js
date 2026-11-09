import { test, expect, chromium } from "@playwright/test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import qrcode from "../../public/js/vendor/qrcode.mjs";

test("home screen icons load for every phone", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBeTruthy();
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toContain(icon.type.split("+")[0]);
  }
  // iPhones fetch the home screen icon outside the page; a same-origin-only rule makes them fall back to a screenshot
  for (const src of ["/icons/app-apple-180.png", "/apple-touch-icon.png"]) {
    const r = await request.get(src);
    expect(r.status(), src).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
    expect(r.headers()["cross-origin-resource-policy"]).toBe("cross-origin");
  }
  const html = await (await request.get("/")).text();
  expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="/icons/app-apple-180.png"');
});

test("the landing page offers to install the app", async ({ page }, info) => {
  await page.goto("/");
  const btn = page.locator("#getapp");
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await btn.click();
  const sheet = page.locator(".sheet");
  await expect(sheet).toContainText("Install Lumin Vocab");
  if (["iphone", "ipad"].includes(info.project.name)) await expect(sheet).toContainText("Add to Home Screen");
  else await expect(sheet.locator(".steps li").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".w-close").getByRole("button", { name: "Install the app" })).toBeVisible();
});

test("QR codes are drawn, not blank", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  await page.goto("/#/install");
  const size = await page.locator(".qr path").evaluate((p) => [p.namespaceURI, p.getBBox().width]);
  expect(size[0]).toBe("http://www.w3.org/2000/svg");
  expect(size[1]).toBeGreaterThan(20);
});

// A camera "video" of a QR code, in the plain YUV format Chrome's fake camera reads
function qrVideo(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(), W = 640, H = 480, cell = Math.floor(400 / (n + 8)), size = cell * (n + 8);
  const ox = (W - size) / 2 + cell * 4, oy = (H - size) / 2 + cell * 4;
  const y = Buffer.alloc(W * H, 235), uv = Buffer.alloc((W / 2) * (H / 2), 128);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c))
    for (let dy = 0; dy < cell; dy++) y.fill(16, (oy + r * cell + dy) * W + ox + c * cell, (oy + r * cell + dy) * W + ox + (c + 1) * cell);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, uv, uv]);
  const file = join(mkdtempSync(join(tmpdir(), "lumin-cam-")), "qr.y4m");
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame, frame]));
  return file;
}

test("a second device joins by scanning the code inside the app", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  const a = await (await browser.newContext()).newPage();
  await a.goto("/");
  await a.getByRole("link", { name: "Get your first word" }).first().click();
  await a.getByRole("button", { name: /An adult/ }).click();
  await a.getByLabel("Name").fill("Noor");
  await a.getByRole("button", { name: "Continue" }).click();
  await a.getByRole("button", { name: "Continue" }).click();
  await a.getByRole("button", { name: "Start learning" }).click();
  await expect(a.locator(".wordcard .word")).toBeVisible();
  await a.goto("/#/family");
  await a.getByRole("button", { name: "Turn on sync" }).click();
  await expect(a.locator(".status")).toContainText("Synced", { timeout: 20000 });
  await a.getByRole("button", { name: "Add a device" }).click();
  await expect(a.locator(".qr path")).toHaveCount(1);
  const link = await a.evaluate(() => document.querySelector(".code") && location.origin);
  const code = (await a.locator(".code").textContent()).trim().replace(/ /g, "-");

  // Device B: a phone whose camera sees the code on A's screen
  const cam = qrVideo(link + "/#join=" + code);
  const phone = await chromium.launch({ ...info.project.use.launchOptions, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${cam}`] });
  const ctx = await phone.newContext({ baseURL: info.project.use.baseURL || "http://127.0.0.1:8787", viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
  const b = await ctx.newPage();
  const errors = []; b.on("pageerror", (e) => errors.push(e.message));
  await b.goto("/");
  await b.getByRole("link", { name: "I have a family code" }).click();
  await b.getByRole("button", { name: "Scan the code" }).click();
  await expect(b.getByRole("button", { name: /Noor/ })).toBeVisible({ timeout: 30000 });
  // the camera is off once the panel closes
  expect(await b.evaluate(() => document.querySelectorAll("video").length)).toBe(0);
  expect(errors).toEqual([]);
  await phone.close();
});
