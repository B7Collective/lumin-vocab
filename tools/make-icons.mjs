// Renders the PNG icons and social image from the SVG logo with headless Chrome.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const logo = readFileSync("public/icons/logo.svg", "utf8");
const inner = logo.replace(/^[\s\S]*?<rect width="512" height="512" rx="112" fill="#18212B"\/>/, "").replace("</svg>", "");
const font = (f) => "data:font/woff2;base64," + readFileSync("public/fonts/" + f).toString("base64");
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage();
async function shot(html, w, h, out) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: true });
}
const full = (s, rounded = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${s}" height="${s}"><rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="#18212B"/>${inner}</svg>`;
const maskable = (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${s}" height="${s}"><rect width="512" height="512" fill="#18212B"/><g transform="translate(51.2 51.2) scale(.8)">${inner}</g></svg>`;
await shot(full(192), 192, 192, "public/icons/icon-192.png");
await shot(full(512), 512, 512, "public/icons/icon-512.png");
await shot(maskable(512), 512, 512, "public/icons/icon-maskable-512.png");
await shot(full(180, false), 180, 180, "public/icons/apple-touch-icon.png");
await shot(full(32), 32, 32, "public/icons/favicon-32.png");
await shot(`<style>@font-face{font-family:L;src:url(${font("literata-latin-400-normal.woff2")})}@font-face{font-family:LI;font-style:italic;src:url(${font("literata-latin-400-italic.woff2")})}@font-face{font-family:A;src:url(${font("atkinson-hyperlegible-latin-400-normal.woff2")})}</style>
<div style="width:1200px;height:630px;background:#EEF2F4;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box;font-family:A;color:#18212B">
${full(240)}
<div><div style="font-size:22px;letter-spacing:.08em;text-transform:uppercase;color:#4A5866">adjective</div>
<div style="font-family:L;font-size:120px;line-height:1">luminous</div>
<div style="font-size:30px;margin-top:22px;max-width:640px">Giving off light, or glowing in the dark.</div>
<div style="font-family:L;font-size:34px;margin-top:40px">Lumin Vocab <span style="font-family:A;font-size:24px;color:#4A5866">· a new word every day, for the whole family</span></div></div></div>`, 1200, 630, "public/icons/og-image.png");
await browser.close();
console.log("icons done");
