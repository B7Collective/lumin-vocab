// Lumin Vocab: small UI helpers. User text is always set with textContent, never as HTML.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import { COLORS } from "./model.js";

// Optional pieces are often written as "cond ? el : null". Skip empty values everywhere
// instead of printing "null" or "false" on screen.
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const name of ["append", "prepend", "replaceChildren"]) {
    const orig = proto[name];
    proto[name] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false)); };
  }
}

// Drawing elements must be created as SVG, or the browser keeps them but never paints them
const SVG_TAGS = new Set(["svg", "use", "path", "rect", "circle", "g", "line", "polyline", "polygon", "ellipse"]);
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG_TAGS.has(tag) ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml", tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") for (const [prop, val] of Object.entries(v)) { if (prop.startsWith("--")) el.style.setProperty(prop, val); else el.style[prop] = val; }
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
export const icon = (name, size = 24) => { const s = h("svg", { class: "icon", width: size, height: size, "aria-hidden": "true" }); s.append(h("use", { href: "#i-" + name })); return s; };
export const TOPIC_ICON = { Describing: "t-describing", Actions: "t-actions", "Words and talk": "t-words", People: "t-people", Feelings: "t-feelings", Mind: "t-mind", Senses: "t-senses", Nature: "t-nature", Arts: "t-arts", Food: "t-food", Body: "t-body", Money: "t-money", Animals: "t-animals", Science: "t-science", Places: "t-places", Time: "t-time", Things: "t-things", "My words": "t-mine" };
const TOPIC_TINT = { Describing: 3, Actions: 4, "Words and talk": 5, People: 2, Feelings: 2, Mind: 5, Senses: 1, Nature: 6, Arts: 2, Food: 4, Body: 4, Money: 3, Animals: 6, Science: 1, Places: 5, Time: 1, Things: 3, "My words": 1 };
export const tint = (t) => `var(--c${TOPIC_TINT[t] || 1})`;
export const topicIcon = (t, size = 18) => { const s = icon(TOPIC_ICON[t] || "t-describing", size); s.style.color = tint(t); return s; };
export const topicChip = (t) => h("span", { class: "topic" }, topicIcon(t), t);
export const badge = (name, color, cls = "") => h("span", { class: "badge " + cls, style: color ? { color } : null, "aria-hidden": "true" }, icon(name));
// A line of facts separated by dots, where each fact stays on one line
export const meta = (...parts) => h("span", { class: "meta" }, parts.flat().filter(Boolean).map((t) => h("span", {}, t)));
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// Shrink a single word until it fits its container, so it never breaks mid-word
export function fitWord(el) {
  if (!el || !el.isConnected) return;
  el.style.fontSize = "";
  const box = el.parentElement, cs = getComputedStyle(box);
  const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const need = el.scrollWidth;
  if (avail > 0 && need > avail) el.style.fontSize = Math.floor(parseFloat(getComputedStyle(el).fontSize) * (avail / need) * 0.97) + "px";
}
export const avatar = (p, cls = "") => { const c = COLORS[(p && p.color) || 0] || COLORS[0]; return h("span", { class: "avatar " + cls, style: { background: c.bg, color: c.fg }, "aria-hidden": "true" }, ((p && p.name) || "?").trim().charAt(0).toUpperCase() || "?"); };

let toastEl = null, toastTimer = null;
export function toast(msg, action) {
  if (toastEl) toastEl.remove();
  document.querySelectorAll("#layer .toast").forEach((t) => t.remove());
  clearTimeout(toastTimer);
  toastEl = h("div", { class: "toast" + (action ? " undo" : ""), role: "status" }, h("span", {}, msg),
    action ? h("button", { onclick: () => { action.fn(); toastEl.remove(); toastEl = null; } }, action.label) : null);
  document.getElementById("layer").append(toastEl);
  toastTimer = setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, action ? 6000 : 3200);
}

let sheetClose = null;
export function sheet(title, build, { onClose } = {}) {
  closeSheet();
  const layer = document.getElementById("layer");
  const prevFocus = document.activeElement;
  const scrim = h("div", { class: "scrim", onclick: () => closeSheet() });
  const body = h("section", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title });
  const close = h("button", { class: "iconbtn", "aria-label": "Close", onclick: () => closeSheet() }, icon("x"));
  body.append(h("div", { class: "sheet-head" }, h("h2", {}, title), close));
  build(body);
  layer.append(scrim, body);
  // Phones: drag the sheet down from its top edge to close it
  let sy = null;
  body.addEventListener("pointerdown", (e) => { if (innerWidth >= 720 || e.clientY - body.getBoundingClientRect().top > 56 || e.target.closest("button, a, input, select, textarea")) return; sy = e.clientY; body.classList.add("dragging"); body.setPointerCapture(e.pointerId); });
  body.addEventListener("pointermove", (e) => { if (sy == null) return; const dy = Math.max(0, e.clientY - sy); body.style.transform = `translateY(${dy}px)`; });
  const end = (e) => { if (sy == null) return; const dy = e.clientY - sy; sy = null; body.classList.remove("dragging"); body.classList.add("release");
    if (dy > 110) { body.style.transform = "translateY(100%)"; setTimeout(() => closeSheet(), 200); } else body.style.transform = ""; };
  body.addEventListener("pointerup", end); body.addEventListener("pointercancel", end);
  const keyer = (e) => { if (e.key === "Escape") closeSheet(); };
  addEventListener("keydown", keyer);
  sheetClose = () => { scrim.remove(); body.remove(); removeEventListener("keydown", keyer); sheetClose = null; onClose && onClose(); prevFocus && prevFocus.focus && prevFocus.focus(); };
  setTimeout(() => close.focus(), 30);
  return body;
}
export function closeSheet() { if (sheetClose) sheetClose(); }
export const sheetOpen = () => !!sheetClose;

export function ask(title, { label, type = "text", placeholder = "", confirm = "OK", inputmode, autocomplete = "off", maxlength = 60 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    sheet(title, (b) => {
      const input = h("input", { type, placeholder, inputmode, autocomplete, maxlength, id: "ask-input" });
      const form = h("form", { class: "field", onsubmit: (e) => { e.preventDefault(); done = true; const v = input.value; closeSheet(); resolve(v); } },
        label ? h("label", { for: "ask-input" }, label) : null, input,
        h("div", { class: "actions", style: { marginTop: "var(--s2)" } }, h("button", { class: "btn primary", type: "submit" }, confirm)));
      b.append(form);
      setTimeout(() => input.focus(), 60);
    }, { onClose: () => { if (!done) resolve(null); } });
  });
}
export function confirmBox(title, text, yes = "Yes", danger = false) {
  return new Promise((resolve) => {
    let done = false;
    sheet(title, (b) => {
      b.append(h("p", { class: "lead" }, text), h("div", { class: "actions" },
        h("button", { class: "btn " + (danger ? "danger" : "primary"), onclick: () => { done = true; closeSheet(); resolve(true); } }, yes),
        h("button", { class: "btn quiet", onclick: () => closeSheet() }, "Cancel")));
    }, { onClose: () => { if (!done) resolve(false); } });
  });
}

// ---- Speech --------------------------------------------------------------
export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm");
// A light tap on devices that support it (most Android phones). iPhones ignore it.
export function haptic(pattern = 8) { try { if (navigator.vibrate && !reduced()) navigator.vibrate(pattern); } catch {} }

export const canSpeak = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
// Devices list their voices in no useful order, and Macs include joke and old robot voices (Albert, Zarvox,
// Fred and friends). Hide those and rank the natural ones first, so "Automatic" picks the best voice the device has.
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|deranged|hysterical|pipe organ)\b/i;
const NATURAL = /(premium|enhanced|natural|neural|online)/i;
const GOOD = /^(google us english|ava|zoe|evan|nathan|noelle|allison|susan|samantha|tom|joelle|aria|jenny|guy|ana|michelle|christopher|eric|steffan|emma|andrew|brian|english united states)\b/i;
const rank = (v) => (NATURAL.test(v.name) ? 100 : 0) + (GOOD.test(v.name.replace(/^microsoft\s+/i, "")) ? 40 : 0) + (/en[-_]US/i.test(v.lang) ? 20 : 0) + (v.localService ? 2 : 0);
export function voices() {
  if (!canSpeak()) return [];
  return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang) && !NOVELTY.test(v.name)).sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name));
}
export function speak(text, p) {
  if (!canSpeak() || !text) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = voices();
    const pick = (p && p.voice && vs.find(v => v.name === p.voice)) || vs[0];
    if (pick) u.voice = pick;
    u.lang = (pick && pick.lang) || "en-US";
    u.rate = (p && p.rate) || 0.9;
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export async function share(word) {
  const text = `${word.w} (${word.p}): ${word.d}${word.e ? `\n"${word.e}"` : ""}\nFrom Lumin Vocab`;
  const url = location.origin + "/";
  try {
    if (navigator.share) { await navigator.share({ title: word.w, text, url }); return; }
    await navigator.clipboard.writeText(text + "\n" + url);
    toast("Copied to your clipboard");
  } catch (e) { if (e && e.name !== "AbortError") toast("Sharing isn't available here"); }
}

export function relTime(ms) {
  if (!ms) return "never";
  const d = Date.now() - ms, m = Math.round(d / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60); if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24); return days === 1 ? "yesterday" : `${days} days ago`;
}
export function untilText(ms) {
  const d = ms - Date.now(); if (d <= 0) return "now";
  const m = Math.round(d / 60000); if (m < 60) return `in ${m} min`;
  const hrs = Math.round(m / 60); if (hrs < 20) return `in ${hrs} hours`;
  const days = Math.round(hrs / 24); return days <= 1 ? "tomorrow" : `in ${days} days`;
}
export function download(name, text, type = "application/json") {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
