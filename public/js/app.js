// Lumin Vocab: app core (boot, theming, navigation, routing).
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as store from "./store.js";
import * as model from "./model.js";
import * as sync from "./sync.js";
import * as device from "./device.js";
import { h, icon, avatar, closeSheet, toast } from "./ui.js";

export const VERSION = "1.3.0";
export const app = {
  device: device.current(),
  installPrompt: null,
  pid: null,
  get profile() { return this.pid ? model.profile(this.pid) : null; },
  unlocked: false, // grown-up settings unlocked for this visit
};

const ROUTES = {};
export function route(name, fn) { ROUTES[name] = fn; }
export function go(path) { if (location.hash !== "#" + path) location.hash = path; else render(); }

// ---- Theme ---------------------------------------------------------------
export function applyLook() {
  const p = app.profile;
  const root = document.documentElement;
  let theme = (p && p.theme) || "morning";
  const dark = p ? p.dark : "device";
  const hour = new Date().getHours();
  if (!model.DARK.has(theme)) {
    if (dark === "device" && matchMedia("(prefers-color-scheme: dark)").matches) theme = "night";
    if (dark === "sunset" && (hour >= 19 || hour < 7)) theme = "night";
  }
  root.dataset.theme = theme;
  root.style.setProperty("--scale", String((p && p.scale) || (p && model.isKid(p) ? 1.08 : 1)));
  root.classList.toggle("calm", !!(p && p.calm));
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim() || "#EEF2F4";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", bg);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyLook);

// ---- Shell ---------------------------------------------------------------
const NAV = [["feed", "Words", "book"], ["review", "Review", "review"], ["saved", "Saved", "heart"], ["family", "Family", "family"]];
function shell(active) {
  const p = app.profile;
  const topnav = document.getElementById("topnav"), bottom = document.getElementById("bottomnav"), me = document.getElementById("me");
  topnav.replaceChildren(); bottom.replaceChildren();
  const show = !!p && active !== "setup" && active !== "welcome";
  bottom.hidden = !show; me.hidden = !show; topnav.hidden = !show;
  if (!show) return;
  const dueN = model.due(p.id).length;
  for (const [key, label, ic] of NAV) {
    const cur = active === key ? "page" : null;
    const badge = key === "review" && dueN ? dueN : null;
    topnav.append(h("a", { href: "#/" + key, "aria-current": cur }, label, badge ? h("span", { class: "count", "aria-label": `${badge} due` }, String(badge)) : null));
    bottom.append(h("a", { href: "#/" + key, "aria-current": cur }, icon(ic), label, badge ? h("span", { class: "dot", "aria-label": `${badge} due` }, String(badge)) : null));
  }
  me.replaceChildren(avatar(p), h("span", { class: "me-name" }, p.name));
  me.setAttribute("aria-label", `${p.name}. Open your settings or switch profile`);
  me.onclick = () => go("/settings");
}

let ready = false; // screens are loaded; a hash change during start-up waits for boot to render
let wordsReady = null, wordsLoaded = false;
const NO_WORDS = ["welcome", "join", "install", "about"]; // screens that can draw before the word list arrives
export function render() {
  if (!ready) return;
  closeSheet();
  document.querySelectorAll("#layer .toast.undo").forEach((t) => t.remove());
  app.device = device.current();
  const hash = location.hash.slice(1);
  if (hash.startsWith("join=")) { sessionStorage.setItem("lumin-join", hash.slice(5)); history.replaceState(null, "", "#/join"); }
  const path = (location.hash.slice(1) || "/").replace(/^\//, "");
  let [name, ...rest] = path.split("/");
  const hasProfiles = model.profiles().length > 0;
  if (!hasProfiles && !["setup", "join", "install", "about"].includes(name)) name = "welcome";
  else if (hasProfiles && (!app.profile && !["who", "setup", "join", "install", "about"].includes(name))) name = "who";
  else if (!name) name = "feed";
  if (!ROUTES[name]) name = hasProfiles ? "feed" : "welcome";
  if (!wordsLoaded && !NO_WORDS.includes(name)) { wordsReady.then(render); return; }
  applyLook();
  shell(name);
  const main = document.getElementById("main");
  const swap = () => {
    document.getElementById("app").dataset.route = name;
    main.replaceChildren();
    ROUTES[name](main, rest.map(decodeURIComponent));
    main.focus({ preventScroll: true });
    scrollTo(0, 0);
  };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm");
  // Soft crossfade between screens where the browser supports it; instant otherwise
  if (document.startViewTransition && !calm && lastRoute && lastRoute !== name) document.startViewTransition(swap); else swap();
  lastRoute = name;
}
let lastRoute = null;
addEventListener("hashchange", render);
addEventListener("resize", () => { const d = device.current(); if (d.layout !== app.device.layout || d.installed !== app.device.installed) { app.device = d; } });

export async function selectProfile(id) {
  app.pid = id; app.unlocked = false;
  await store.setMeta("activeProfile", id);
  go("/feed");
}

// ---- Boot ----------------------------------------------------------------
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); app.installPrompt = e; document.dispatchEvent(new CustomEvent("lumin-install-ready")); });
addEventListener("appinstalled", () => { app.installPrompt = null; app.device = device.current(); toast("Installed. You can open Lumin Vocab from your apps."); });

async function boot() {
  // The word list is the largest file, so only screens that need it wait for it
  wordsReady = model.loadWords().then(() => { wordsLoaded = true; });
  await store.open();
  const saved = await store.getMeta("activeProfile");
  if (saved && model.profile(saved)) app.pid = saved;
  await import("./views.js");
  store.onChange((kind, rec) => {
    if (kind !== "remote") return;
    if (rec.type === "profile" && app.pid && !model.profile(app.pid)) { app.pid = null; render(); return; }
    // refresh lightweight pieces when another device changes something
    if (["profile", "family", "collection", "custom"].includes(rec.type)) clearTimeout(boot.t), boot.t = setTimeout(() => { if (!document.querySelector(".sheet") && !document.querySelector(".review")) render(); }, 400);
  });
  await sync.init("");
  // The two preloaded fonts usually arrive with the scripts; wait briefly so the first screen doesn't jump when they swap in
  try { if (document.fonts) await Promise.race([Promise.all(["400 1em Literata", "400 1em \"Atkinson Hyperlegible\""].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 700))]); } catch {}
  ready = true;
  render();
  await wordsReady;
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1")) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    // A new version took over: offer a quick reload so every screen uses it
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) toast("Lumin Vocab was updated", { label: "Reload", fn: () => location.reload() });
    });
  }
}
boot().catch((e) => {
  console.error(e);
  document.getElementById("main").replaceChildren(h("div", { class: "page narrow" }, h("h1", {}, "Something went wrong"),
    h("p", { class: "lead" }, "Lumin Vocab couldn't start. Reloading usually fixes it."), h("button", { class: "btn primary", onclick: () => location.reload() }, "Reload")));
});
