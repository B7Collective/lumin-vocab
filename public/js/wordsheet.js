// Lumin Vocab: a word's details, lists, your own words, and the word card used in lists.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import { app, render } from "./app.js";
import { h, icon, toast, sheet, closeSheet, ask, speak, canSpeak, share, plural } from "./ui.js";
import { play, buzz } from "./sound.js";

export const POS_SHORT = { noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.", phrase: "phr." };
const LEVEL = (l) => model.LEVELS[l] || model.LEVELS[4];

// Pronunciation pill: IPA for older levels, a simple respelling for young readers. Tap to hear it.
export function sayPill(w, p, cls = "dipa") {
  const kid = model.isKid(p);
  const text = (kid ? w.s : w.i) || w.s || "";
  const label = text ? (kid ? text : `/${text}/`) : "Hear it";
  if (!canSpeak()) return text ? h("span", { class: cls }, label) : null;
  const btn = h("button", { class: cls, type: "button", "aria-label": `Hear ${w.w}${text ? ", " + text : ""}`, onclick: (e) => {
    e.stopPropagation(); speak(w.w, p); btn.classList.add("playing"); setTimeout(() => btn.classList.remove("playing"), 1200);
  } }, h("span", {}, label), icon("speak"));
  return btn;
}

// Little paper pieces flying out of a button
export function burst(el, colors = ["#FF8FB3", "#F2B544", "#7CC6CE"]) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm")) return;
  for (let i = 0; i < 8; i++) {
    const b = h("i", { class: "burst", style: { "--r": `${i * 45 + 10}deg`, "--c": colors[i % colors.length] } });
    el.append(b); setTimeout(() => b.remove(), 800);
  }
}

export function toggleFav(btn, w) {
  const on = model.toggleFav(app.profile.id, w);
  btn.setAttribute("aria-pressed", String(on));
  btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
  if (on) { burst(btn); play("heart"); buzz(12); }
  return on;
}
export function toggleSave(btn, w) {
  const p = app.profile, c = model.card(p.id, w), on = !(c && c.st === "learning");
  if (on) model.learn(p.id, w); else model.setCard(p.id, w, { st: "seen", srs: null });
  btn.setAttribute("aria-pressed", String(on));
  btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
  if (on) { burst(btn, ["#F2B544", "#FFE1A0", "#FFFFFF"]); play("tap"); buzz(10); toast(`"${w}" will come back in Practice`); }
  return on;
}

export function details(wordText) {
  const p = app.profile, w = model.lookup(wordText);
  if (!w) return;
  sheet(w.w, (b) => {
    const c = model.card(p.id, w.w);
    const sec = (title, ...kids) => h("div", { class: "dsec" }, h("h3", {}, title), ...kids);
    b.append(
      h("div", { class: "dhead" }, h("span", { class: "muted" }, w.p), sayPill(w, p)),
      sec("Meaning", h("p", { style: { fontSize: "var(--t-l)" } }, w.d)),
      w.e ? sec("Example", h("p", { class: "ex" }, w.e), w.e2 ? h("p", { class: "ex" }, w.e2) : null) : null,
      w.cf && model.BY.get(w.cf) ? sec("Don't mix it up with", h("p", {}, h("button", { class: "chip", onclick: () => details(w.cf) }, w.cf), " ", model.BY.get(w.cf).d)) : null,
      w.m && w.m.length ? sec("Similar words", h("p", {}, w.m.join(", "))) : null,
      w.f && w.f.length ? sec("Word family", h("div", { class: "wordchips" }, w.f.map((f) => model.BY.get(f) ? h("button", { class: "chip", onclick: () => details(f) }, f) : h("span", { class: "chip" }, f)))) : null,
      sec("Where it lives", h("p", {}, w.custom ? "Your own word" : w.c ? `Side trails, ${w.t}` : `${LEVEL(w.l).name}, ${w.t}`),
        (() => { const ts = (w.x || []).map((k) => model.trail(k)).filter(Boolean); return ts.length ? h("div", { class: "wordchips" }, ts.map((t) => h("a", { class: "chip", href: `#/journey/trail/${t.key}`, onclick: () => closeSheet() }, t.name))) : null; })()),
      h("div", { class: "actions" },
        h("button", { class: "btn small" + (c && c.st === "learning" ? "" : " primary"), onclick: () => { model.learn(p.id, w.w); toast(`"${w.w}" will come back in Practice`); closeSheet(); } }, icon("bookmark"), c && c.st === "learning" ? "Saved to practice" : "Save to practice"),
        h("button", { class: "btn quiet", onclick: () => listPicker(w.w) }, icon("folder"), "Add to a list"),
        h("button", { class: "btn quiet", onclick: () => share(w) }, icon("share"), "Share"),
        c && c.st === "known" ? null : h("button", { class: "btn quiet", onclick: () => { model.know(p.id, w.w); toast("Got it. We won't show it again."); closeSheet(); document.dispatchEvent(new CustomEvent("lumin-known", { detail: w.w })); } }, icon("check"), "I already know it")),
      h("p", { class: "muted small" }, w.custom ? "Added by you." : "Written for Lumin Vocab. Similar words from Open English WordNet (CC BY 4.0). ", h("a", { href: "#/about", onclick: () => closeSheet() }, "Credits")));
  });
}

export function listPicker(word) {
  const p = app.profile;
  sheet("Add to a list", (b) => {
    const list = h("div", { class: "menu" });
    const draw = () => {
      list.replaceChildren();
      const cols = model.collections(p.id);
      if (!cols.length) list.append(h("p", { class: "muted", style: { padding: "var(--s4) 0" } }, "No lists yet. Make one for a book, a trip or a test."));
      for (const col of cols) list.append(h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, col.name), h("small", {}, plural(col.words.length, "word") + (col.shared ? ", shared with family" : ""))),
        h("input", { type: "checkbox", checked: col.words.includes(word), onchange: () => model.toggleInCollection(model.collections(p.id).find((x) => x.id === col.id), word) })));
    };
    draw();
    b.append(list, h("button", { class: "btn quiet start", onclick: async () => { const name = await ask("New list", { label: "Name", confirm: "Create", maxlength: 40 }); if (name && name.trim()) { const col = model.newCollection(p.id, name.trim()); model.toggleInCollection(col, word); toast(`Added to ${col.name}`); } } }, icon("plus"), "New list"));
  });
}

export function addWord(prefill = "") {
  const p = app.profile;
  sheet("Add your own word", (b) => {
    const w = h("input", { type: "text", id: "cw-w", maxlength: 40, autocomplete: "off", autocapitalize: "none", value: prefill });
    const pos = h("select", { id: "cw-p" }, ["noun", "verb", "adjective", "adverb", "phrase"].map((x) => h("option", { value: x }, x)));
    const d = h("textarea", { id: "cw-d", maxlength: 240, rows: 3 });
    const e = h("textarea", { id: "cw-e", maxlength: 240, rows: 2 });
    const note = h("small", {});
    const fill = () => { const hit = model.BY.get(w.value.trim().toLowerCase()); if (hit) { if (!d.value) d.value = hit.d; if (!e.value) e.value = hit.e || ""; pos.value = ["noun", "verb", "adjective", "adverb"].includes(hit.p) ? hit.p : "phrase"; note.textContent = "Filled in from Lumin Vocab. Edit anything you like."; } };
    w.addEventListener("change", fill); w.addEventListener("blur", fill);
    b.append(h("form", { class: "stack loose", onsubmit: (ev) => {
      ev.preventDefault();
      const word = w.value.trim();
      if (!word || !d.value.trim()) { toast("Add the word and what it means"); return; }
      if (model.BY.get(word.toLowerCase())) { model.learn(p.id, word.toLowerCase()); toast(`"${word}" is already in Lumin Vocab. Saved to practice.`); closeSheet(); render({ refresh: true }); return; }
      model.addCustom(p.id, { w: word, p: pos.value, d: d.value.trim(), e: e.value.trim() });
      toast(`Added "${word}"`); closeSheet(); render({ refresh: true });
    } },
      h("div", { class: "field" }, h("label", { for: "cw-w" }, "Word"), w, note),
      h("div", { class: "field" }, h("label", { for: "cw-p" }, "Kind of word"), pos),
      h("div", { class: "field" }, h("label", { for: "cw-d" }, "What it means"), d),
      h("div", { class: "field" }, h("label", { for: "cw-e" }, "Example sentence (optional)"), e),
      h("div", { class: "actions" }, h("button", { class: "btn primary", type: "submit" }, "Add word"))));
    if (prefill) fill();
    setTimeout(() => (prefill ? d : w).focus(), 60);
  });
}

const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
// A word in a list: the word, how to say it, what it means, and quick actions
export function wordCard(wordText, { when } = {}) {
  const p = app.profile, w = model.lookup(wordText); if (!w) return null;
  const c = model.card(p.id, w.w) || {};
  const fav = h("button", { class: "iconbtn fav", "aria-label": `Favorite ${w.w}`, "aria-pressed": String(!!c.fav), onclick: () => toggleFav(fav, w.w) }, icon("heart"));
  const save = h("button", { class: "iconbtn save", "aria-label": `Save ${w.w} to practice`, "aria-pressed": String(c.st === "learning"), onclick: () => toggleSave(save, w.w) }, icon("bookmark"));
  return h("article", { class: "wcard" },
    h("div", { class: "top" }, h("button", { class: "w", onclick: () => details(w.w) }, w.w), sayPill(w, p)),
    h("p", { class: "d" }, h("span", { class: "muted" }, `(${POS_SHORT[w.p] || w.p}) `), w.d),
    w.e ? h("p", { class: "e" }, w.e) : null,
    h("div", { class: "bot" }, h("span", {}, when ? dateFmt.format(new Date(when)) : ""), h("div", { class: "acts" }, fav, save, h("button", { class: "iconbtn", "aria-label": `Add ${w.w} to a list`, onclick: () => listPicker(w.w) }, icon("folder")), h("button", { class: "iconbtn", "aria-label": `Share ${w.w}`, onclick: () => share(w) }, icon("share")))));
}
