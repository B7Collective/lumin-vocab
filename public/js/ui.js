// Lumin Vocab: small UI helpers. User text is always set with textContent, never as HTML.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import { COLORS } from "./model.js";

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(tag === "svg" || tag === "use" ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml", tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
export const icon = (name, size = 24) => { const s = h("svg", { class: "icon", width: size, height: size, "aria-hidden": "true" }); s.append(h("use", { href: "#i-" + name })); return s; };
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
  const close = h("button", { class: "iconbtn", "aria-label": "Close", onclick: () => closeSheet() }, icon("x", 20));
  body.append(h("div", { class: "sheet-head" }, h("h2", {}, title), close));
  build(body);
  layer.append(scrim, body);
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
        h("div", { style: { display: "flex", gap: "12px", marginTop: "12px" } }, h("button", { class: "btn primary", type: "submit" }, confirm)));
      b.append(form);
      setTimeout(() => input.focus(), 60);
    }, { onClose: () => { if (!done) resolve(null); } });
  });
}
export function confirmBox(title, text, yes = "Yes", danger = false) {
  return new Promise((resolve) => {
    let done = false;
    sheet(title, (b) => {
      b.append(h("p", { class: "lead" }, text), h("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap" } },
        h("button", { class: "btn " + (danger ? "danger" : "primary"), onclick: () => { done = true; closeSheet(); resolve(true); } }, yes),
        h("button", { class: "btn quiet", onclick: () => closeSheet() }, "Cancel")));
    }, { onClose: () => { if (!done) resolve(false); } });
  });
}

// ---- Speech --------------------------------------------------------------
export const canSpeak = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
export function voices() { if (!canSpeak()) return []; return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); }
export function speak(text, p) {
  if (!canSpeak() || !text) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = voices();
    const pick = (p && p.voice && vs.find(v => v.name === p.voice)) || vs.find(v => /en-US/i.test(v.lang) && v.localService) || vs.find(v => /en-US/i.test(v.lang)) || vs[0];
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
