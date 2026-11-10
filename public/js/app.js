// Lumin Vocab: app core (boot, theming, navigation, routing).
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as store from "./store.js";
import * as model from "./model.js";
import * as sync from "./sync.js";
import * as device from "./device.js";
import { h, icon, avatar, closeSheet, toast } from "./ui.js";
import * as sound from "./sound.js";
import * as motion from "./motion.js";

export const VERSION = "3.1.3";
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
  // Appearance: light paper or dark ink, or follow the device
  const pref = (p && p.dark) || "device";
  const dark = pref === "dark" || (pref !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  sound.setEnabled(!p || p.sound !== false);
  root.style.setProperty("--scale", String((p && p.scale) || (p && model.isKid(p) ? 1.08 : 1)));
  root.classList.toggle("calm", !!(p && p.calm));
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim() || "#E8E5E0";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", bg);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyLook);

// ---- Shell ---------------------------------------------------------------
const NAV = [["words", "Words", "book"], ["journey", "Journey", "map"], ["practice", "Practice", "cap"], ["library", "Library", "books"], ["you", "You", "user"]];
function shell(active) {
  const p = app.profile;
  const topnav = document.getElementById("topnav"), bottom = document.getElementById("bottomnav"), me = document.getElementById("me");
  topnav.replaceChildren(); bottom.replaceChildren();
  // The landing page offers the app straight away, so a family can install before setting anything up
  const getapp = document.getElementById("getapp");
  getapp.hidden = !(active === "welcome" && app.canInstall && app.canInstall());
  getapp.onclick = () => app.installFlow && app.installFlow();
  const show = !!p && !["setup", "welcome", "play", "who", "join"].includes(active);
  document.getElementById("app").classList.toggle("has-nav", show);
  bottom.hidden = !show; me.hidden = !show; topnav.hidden = !show;
  if (!show) return;
  const dueN = model.due(p.id).length;
  for (const [key, label, ic] of NAV) {
    const cur = active === key ? "page" : null;
    const badge = key === "practice" && dueN ? dueN : null;
    topnav.append(h("a", { href: "#/" + key, "aria-current": cur }, label, badge ? h("span", { class: "count", "aria-label": `${badge} due` }, String(badge)) : null));
    bottom.append(h("a", { href: "#/" + key, "aria-current": cur }, icon(ic), label, badge ? h("span", { class: "dot", "aria-label": `${badge} due` }, String(badge)) : null));
  }
  motion.glide(topnav, active); motion.glide(bottom, active);
  me.replaceChildren(avatar(p), h("span", { class: "me-name" }, p.name));
  me.setAttribute("aria-label", `${p.name}. Open your settings or switch profile`);
  me.onclick = () => go("/you");
}

let ready = false; // screens are loaded; a hash change during start-up waits for boot to render
let wordsReady = null, wordsLoaded = false;
const NO_WORDS = ["welcome", "join", "install", "about"]; // screens that can draw before the word list arrives
// render({ refresh: true }) redraws the current screen in place (keeps the scroll position, no transition),
// used when another device changes something
export function render(opts) {
  if (!ready) return;
  const refresh = !!(opts && opts.refresh === true);
  if (!refresh) { closeSheet(); document.querySelectorAll("#layer .toast.undo").forEach((t) => t.remove()); }
  app.device = device.current();
  const hash = location.hash.slice(1);
  if (hash.startsWith("join=")) { sessionStorage.setItem("lumin-join", hash.slice(5)); history.replaceState(null, "", "#/join"); }
  const path = (location.hash.slice(1) || "/").replace(/^\//, "");
  let [name, ...rest] = path.split("/");
  const hasProfiles = model.profiles().length > 0;
  if (!hasProfiles && !["setup", "join", "install", "about"].includes(name)) name = "welcome";
  else if (hasProfiles && (!app.profile && !["who", "setup", "join", "install", "about"].includes(name))) name = "who";
  else if (!name) name = "words";
  name = ({ feed: "words", review: "practice", saved: "library", categories: "topics" })[name] || name; // addresses from version 1
  if (!ROUTES[name]) name = hasProfiles ? "words" : "welcome";
  if (!wordsLoaded && !NO_WORDS.includes(name)) { app.needWords && app.needWords(); wordsReady.then(render); return; }
  if (app.profile && !app.profile.v3) model.migrate(app.profile);
  applyLook();
  shell(name);
  const main = document.getElementById("main");
  const y = scrollY;
  const swap = () => {
    document.getElementById("app").dataset.route = name;
    main.replaceChildren();
    ROUTES[name](main, rest.map(decodeURIComponent));
    if (refresh) { scrollTo(0, y); return; }
    if (!["words", "play", "welcome"].includes(name)) motion.enter(main.firstElementChild);
    main.focus({ preventScroll: true });
    scrollTo(0, 0);
  };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm");
  // Soft crossfade between screens where the browser supports it; instant otherwise
  if (!refresh && document.startViewTransition && !calm && lastRoute && lastRoute !== name) { const vt = document.startViewTransition(swap); vt.ready.catch(() => {}); vt.finished.catch(() => {}); } else swap();
  lastRoute = name;
}
let lastRoute = null;
addEventListener("hashchange", render);
addEventListener("resize", () => { const d = device.current(); if (d.layout !== app.device.layout || d.installed !== app.device.installed) { app.device = d; } });

// ---- Changes from other devices -------------------------------------------
// Progress made on another device shows up here without anyone reloading. Lists and settings redraw in place;
// the word screen updates its counts and skips words already handled elsewhere, but never pulls away the word
// you're reading; a review in progress is left alone. Nothing redraws while you're typing or a panel is open.
let remoteTypes = new Set(), remoteTimer = null;
const REDRAW = ["library", "journey", "practice", "you", "family", "who", "topics", "settings"];
function remoteRefresh() {
  const busy = document.querySelector(".sheet") || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
  if (busy) { remoteTimer = setTimeout(remoteRefresh, 2000); return; }
  const types = remoteTypes; remoteTypes = new Set();
  const route = document.getElementById("app").dataset.route;
  if (types.has("profile") || types.has("family")) applyLook();
  if (REDRAW.includes(route)) { render({ refresh: true }); return; }
  if (app.profile && route) shell(route);
  if (route === "words") document.dispatchEvent(new CustomEvent("lumin-remote", { detail: { types: [...types] } }));
}

export async function selectProfile(id) {
  app.pid = id; app.unlocked = false;
  await store.setMeta("activeProfile", id);
  go("/words");
}

// ---- Boot ----------------------------------------------------------------
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); app.installPrompt = e; document.dispatchEvent(new CustomEvent("lumin-install-ready")); });
addEventListener("appinstalled", () => { app.installPrompt = null; app.device = device.current(); document.getElementById("getapp").hidden = true; toast("Installed. You can open Lumin Vocab from your apps."); });

async function boot() {
  // The word list is the largest file, so only screens that need it wait for it. A first visit
  // (the welcome page) fetches it a moment after the page appears, so the page itself arrives first.
  let startWords; wordsReady = new Promise((r) => { startWords = r; }).then(() => model.loadWords()).then(() => { wordsLoaded = true; });
  app.needWords = () => startWords();
  // Soft drifting light behind the app's pages (hidden behind full-screen scenes)
  document.body.prepend(h("div", { class: "ambient", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("b", { class: "grain" })));
  await store.open();
  if (model.profiles().length || !NO_WORDS.includes((location.hash.slice(2) || "welcome").split(/[/=]/)[0])) startWords();
  else setTimeout(startWords, 1500);
  const saved = await store.getMeta("activeProfile");
  if (saved && model.profile(saved)) app.pid = saved;
  await import("./views.js");
  store.onChange((kind, rec) => {
    if (kind !== "remote") return;
    if (rec.type === "profile" && app.pid && !model.profile(app.pid)) { app.pid = null; render(); return; }
    remoteTypes.add(rec.type);
    clearTimeout(remoteTimer); remoteTimer = setTimeout(remoteRefresh, 400);
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
