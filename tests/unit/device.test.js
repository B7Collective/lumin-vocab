import { test } from "node:test";
import assert from "node:assert/strict";
import { detect } from "../../public/js/device.js";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1",
  iphoneInsta: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0",
  ipadDesktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15",
  pixelChrome: "Mozilla/5.0 (Linux; Android 16; Pixel 11 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 15; SM-S938U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 16; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0",
  androidTablet: "Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15",
  linuxChrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
};
const phone = { width: 393, height: 852, coarse: true, maxTouchPoints: 5 };
const desk = { width: 1440, height: 900, coarse: false, hover: true, maxTouchPoints: 0 };

test("iPhone Safari gets Share > Add to Home Screen steps", () => {
  const d = detect({ ua: UA.iphoneSafari, ...phone });
  assert.equal(d.os, "ios"); assert.equal(d.browser, "safari"); assert.equal(d.form, "phone"); assert.equal(d.layout, "compact");
  assert.equal(d.install.kind, "steps"); assert.match(d.install.steps[0].text, /bottom/); assert.match(d.install.steps[1].text, /Add to Home Screen/);
});
test("iPhone Chrome gets its own steps", () => {
  const d = detect({ ua: UA.iphoneChrome, ...phone });
  assert.equal(d.browser, "chrome"); assert.equal(d.install.kind, "steps"); assert.match(d.install.steps[0].text, /address bar/);
});
test("Instagram in-app browser is told to open Safari", () => {
  const d = detect({ ua: UA.iphoneInsta, ...phone });
  assert.equal(d.browser, "inapp"); assert.equal(d.install.kind, "openInBrowser"); assert.equal(d.install.target, "Safari");
});
test("iPad that reports a Mac user agent is still an iPad", () => {
  const d = detect({ ua: UA.ipadDesktop, width: 1180, height: 820, coarse: true, maxTouchPoints: 5 });
  assert.equal(d.os, "ipados"); assert.equal(d.form, "tablet"); assert.match(d.install.steps[0].text, /top/);
});
test("Android Chrome uses the native install prompt", () => {
  const d = detect({ ua: UA.pixelChrome, ...phone });
  assert.equal(d.os, "android"); assert.equal(d.form, "phone"); assert.equal(d.install.kind, "prompt");
});
test("Samsung Internet fallback mentions its menu wording", () => {
  const d = detect({ ua: UA.samsung, ...phone });
  assert.equal(d.browser, "samsung"); assert.match(d.install.fallback[1].text, /Add page to/);
});
test("Android Firefox gets menu steps", () => {
  const d = detect({ ua: UA.androidFirefox, ...phone });
  assert.equal(d.browser, "firefox"); assert.equal(d.install.kind, "steps");
});
test("Android tablet is a tablet", () => assert.equal(detect({ ua: UA.androidTablet, width: 1280, height: 800, coarse: true, maxTouchPoints: 10 }).form, "tablet"));
test("Windows Edge and Chrome can install, Firefox cannot", () => {
  assert.equal(detect({ ua: UA.winEdge, ...desk }).browser, "edge");
  assert.equal(detect({ ua: UA.winEdge, ...desk }).install.kind, "prompt");
  assert.equal(detect({ ua: UA.winChrome, ...desk }).install.kind, "prompt");
  assert.equal(detect({ ua: UA.winFirefox, ...desk }).install.kind, "unsupported");
});
test("Brave is detected through navigator.brave", () => assert.equal(detect({ ua: UA.winChrome, brave: true, ...desk }).browser, "brave"));
test("Mac Safari gets Add to Dock", () => {
  const d = detect({ ua: UA.macSafari, ...desk });
  assert.equal(d.os, "macos"); assert.equal(d.form, "desktop"); assert.match(d.install.steps[0].text, /Add to Dock/);
});
test("Linux and ChromeOS desktops", () => {
  assert.equal(detect({ ua: UA.linuxChrome, ...desk }).os, "linux");
  assert.equal(detect({ ua: UA.chromebook, ...desk }).os, "chromeos");
});
test("Keyboard hints only for fine pointers", () => {
  assert.equal(detect({ ua: UA.winChrome, ...desk }).keyboard, true);
  assert.equal(detect({ ua: UA.iphoneSafari, ...phone }).keyboard, false);
});
test("Installed apps never show install steps", () => {
  assert.equal(detect({ ua: UA.iphoneSafari, ...phone, standalone: true }).install.kind, "installed");
  assert.equal(detect({ ua: UA.pixelChrome, ...phone, displayStandalone: true }).install.kind, "installed");
});
