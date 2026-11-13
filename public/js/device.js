// Lumin Vocab: device, OS, browser and screen detection.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

// Pure function so it can be unit tested with any user agent.
// env: { ua, platform, maxTouchPoints, standalone, displayStandalone, width, height,
//        coarse, hover, brave, uaData }
export function detect(env) {
  const ua = env.ua || "";
  const touch = (env.maxTouchPoints || 0) > 0;

  // OS
  let os = "other";
  const iPadDesktopUA = /Macintosh/.test(ua) && (env.maxTouchPoints || 0) > 1; // iPadOS 13+ reports as a Mac
  if (/iPad/.test(ua) || iPadDesktopUA) os = "ipados";
  else if (/iPhone|iPod/.test(ua)) os = "ios";
  else if (/Android/.test(ua)) os = "android";
  else if (/CrOS/.test(ua)) os = "chromeos";
  else if (/Windows/.test(ua)) os = "windows";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macos";
  else if (/Linux|X11/.test(ua)) os = "linux";
  const apple = os === "ios" || os === "ipados";

  // Browser
  let browser = "other";
  if (/FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|; wv\)|GSA\//.test(ua)) browser = "inapp";
  else if (/EdgiOS|EdgA|Edg\//.test(ua)) browser = "edge";
  else if (/SamsungBrowser/.test(ua)) browser = "samsung";
  else if (/OPR\/|OPiOS|OPT\//.test(ua)) browser = "opera";
  else if (/FxiOS|Firefox\//.test(ua)) browser = "firefox";
  else if (/CriOS|Chrome\//.test(ua) || /Chromium/.test(ua)) browser = env.brave ? "brave" : "chrome";
  else if (/Safari\//.test(ua)) browser = "safari";
  if (browser === "chrome" && env.brave) browser = "brave";

  // Screen and input
  const w = env.width || 1024, h = env.height || 768;
  const short = Math.min(w, h);
  const coarse = env.coarse ?? touch;
  let form = "desktop";
  if (os === "ios" || (os === "android" && /Mobile/.test(ua))) form = "phone";
  else if (os === "ipados" || (os === "android" && !/Mobile/.test(ua))) form = "tablet";
  else if (coarse && short < 600) form = "phone";
  else if (coarse && touch && short < 1100 && os !== "windows" && os !== "macos") form = "tablet";

  const installed = !!(env.standalone || env.displayStandalone);
  const keyboard = !coarse || (env.hover && !touch);

  return { os, browser, form, apple, touch, coarse: !!coarse, keyboard: !!keyboard, installed, width: w, height: h,
           layout: w < 720 ? "compact" : "wide", install: installGuide(os, browser, form, installed) };
}

// How to install as an app on this exact device. "prompt" means the browser can show
// its own install dialog (we offer a button when the beforeinstallprompt event fires).
export function installGuide(os, browser, form, installed) {
  if (installed) return { kind: "installed" };
  if (browser === "inapp") return { kind: "openInBrowser", target: os === "ios" || os === "ipados" ? "Safari" : "Chrome" };
  if (os === "ios" || os === "ipados") {
    const where = form === "tablet" ? "at the top of the screen" : "at the bottom of the screen";
    if (browser === "safari" || browser === "other") {
      return { kind: "steps", steps: [
        { icon: "share", text: `Tap the Share button ${where}. On newer iPhones it can be inside the ••• menu.` },
        { icon: "plus", text: "Scroll down and tap Add to Home Screen, then Add." },
        { icon: "check", text: "Open Lumin Vocab from your Home Screen. It opens full screen, like any app." },
      ] };
    }
    return { kind: "steps", steps: [
      { icon: "share", text: "Tap the Share button next to the address bar." },
      { icon: "plus", text: "Tap Add to Home Screen. If you don't see it, open this page in Safari and do the same." },
      { icon: "check", text: "Open Lumin Vocab from your Home Screen." },
    ] };
  }
  if (os === "android") {
    if (browser === "firefox") return { kind: "steps", steps: [
      { icon: "menu", text: "Tap the menu button (three dots)." },
      { icon: "plus", text: "Tap Install, or Add to Home screen." },
    ] };
    return { kind: "prompt", fallback: [
      { icon: "menu", text: "Tap the menu button (three dots) next to the address bar." },
      { icon: "plus", text: browser === "samsung" ? "Tap Add page to, then Home screen." : "Tap Install app, or Add to Home screen." },
    ] };
  }
  if (os === "macos" && browser === "safari") return { kind: "steps", steps: [
    { icon: "menu", text: "In the menu bar, choose File, then Add to Dock." },
    { icon: "check", text: "Lumin Vocab opens in its own window from the Dock." },
  ] };
  if (browser === "firefox") return { kind: "unsupported", note: "Firefox on computers can't install web apps yet. Lumin Vocab works fully in this tab, or open it in Chrome, Edge or Brave to install it." };
  if (["chrome", "edge", "brave", "opera"].includes(browser)) return { kind: "prompt", fallback: [
    { icon: "plus", text: "Click the install icon at the right end of the address bar." },
    { icon: "menu", text: "Or open the browser menu and choose Install Lumin Vocab." },
  ] };
  return { kind: "unsupported", note: "This browser can't install web apps. Lumin Vocab still works here, or open it in Chrome, Edge or Safari to install it." };
}

export function current() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const mm = (q) => typeof matchMedia === "function" && matchMedia(q).matches;
  return detect({
    ua: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints,
    standalone: nav.standalone === true, displayStandalone: mm("(display-mode: standalone)") || mm("(display-mode: fullscreen)") || mm("(display-mode: window-controls-overlay)"),
    width: typeof innerWidth === "number" ? innerWidth : 1024, height: typeof innerHeight === "number" ? innerHeight : 768,
    coarse: mm("(pointer: coarse)"), hover: mm("(hover: hover)"), brave: !!nav.brave,
  });
}

export const LABELS = {
  os: { ios: "iPhone", ipados: "iPad", android: "Android", windows: "Windows", macos: "Mac", linux: "Linux", chromeos: "ChromeOS", other: "this device" },
  browser: { safari: "Safari", chrome: "Chrome", edge: "Edge", firefox: "Firefox", samsung: "Samsung Internet", brave: "Brave", opera: "Opera", inapp: "an in-app browser", other: "your browser" },
};
