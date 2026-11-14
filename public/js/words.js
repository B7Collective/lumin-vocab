// Lumin Vocab: the Words screen. One word at a time over a full-screen scene; swipe up for the next.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import { app, route, go } from "./app.js";
import { h, icon, speak, share, fitWord, reduced, preloadWord } from "./ui.js";
import { sceneFor, sceneBig as sceneUrl, sceneFx } from "./art.js";
import { sayPill, details, toggleFav, toggleSave, POS_SHORT } from "./wordsheet.js";

const HINT_KEY = "lumin-swipe-hint";

// A link to one word (#/word/serendipity, used by Lumin Lookup) opens the Words screen with that word's card
route("word", (main, args = []) => {
  const w = model.lookup(args[0] || "");
  location.replace("#/words");
  if (w) setTimeout(() => details(w.w), 350);
});

route("words", (main) => {
  const p = app.profile;
  let queue = model.queue(p), idx = 0, busy = false;
  const back = []; // words already shown this visit, for going back
  const root = h("div", { class: "words", role: "region", "aria-label": "Words" });
  main.append(root);

  // Heads-up row: streak, what you're browsing
  const before = model.streak(model.profile(p.id));
  if (queue[idx]) model.markActive(p.id); // seeing a word counts toward the streak
  const n = model.streak(model.profile(p.id));
  const filter = p.feedSet ? (p.feedSet === "beautiful" ? "Beautiful words" : p.feedSet === "funny" ? "Funny words" : (model.trail(p.feedSet) || {}).name || "Collection") : p.feedTopic || "All words";
  const hud = h("div", { class: "whud" },
    h("a", { class: "hudchip glass", href: "#/you", "aria-label": n ? `${n} day streak` : "Start a streak" }, icon("flame", 18), n ? String(n) : "0"),
    h("a", { class: "hudchip glass", href: "#/topics" }, icon("grid", 18), filter));
  const nav = h("div", { class: "wnav" },
    h("button", { class: "wbtn glass", "aria-label": "Previous word", onclick: () => prev() }, icon("up")),
    h("button", { class: "wbtn glass", "aria-label": "Next word", onclick: () => next() }, icon("down")));
  root.append(hud, nav);
  if (n > before) setTimeout(() => hud.firstChild.classList.add("bump"), 900);

  let showHint = true; try { showHint = (+localStorage.getItem(HINT_KEY) || 0) < 3; } catch {}

  function slide(word) {
    if (!word) {
      const sc = sceneFor(p, "end");
      return h("div", { class: "wslide" }, h("img", { class: "wbg", src: sceneUrl(sc.id), alt: "", style: { "--fx": sceneFx(sc) + "%" } }), h("div", { class: "wshade" }),
        h("div", { class: "wbody" }, h("div", { class: "wdone" },
          h("h2", {}, p.feedTopic || p.feedSet ? "That's every word in this topic" : "You've seen every word at this level"),
          h("p", {}, "Practice the ones you saved, or pick another topic."),
          h("div", { class: "actions center-x" }, h("a", { class: "btn primary", href: "#/practice" }, "Practice"), h("a", { class: "btn", href: "#/topics" }, "Topics")))));
    }
    const sc = sceneFor(p, word.w), c = model.card(p.id, word.w) || {};
    const wordEl = h("h1", { class: "wword", lang: "en" }, [...word.w].map((ch, i) => h("span", { class: "ch", style: { "--i": i } }, ch === " " ? " " : ch)));
    const fav = h("button", { class: "wbtn glass fav", "aria-label": "Favorite", "aria-pressed": String(!!c.fav), onclick: () => toggleFav(fav, word.w) }, icon("heart"));
    const save = h("button", { class: "wbtn glass save", "aria-label": "Save to practice", "aria-pressed": String(c.st === "learning"), onclick: () => toggleSave(save, word.w) }, icon("bookmark"));
    const el = h("div", { class: "wslide" + (sc.light ? " light" : ""), "data-word": word.w },
      h("img", { class: "wbg", src: sceneUrl(sc.id), alt: "", style: { "--fx": sceneFx(sc) + "%" }, decoding: "async" }),
      h("div", { class: "wshade" }),
      h("div", { class: "motes", "aria-hidden": "true" }, Array.from({ length: 7 }, (_, k) => h("i", { style: { "--x": `${8 + ((k * 37 + word.w.length * 11) % 84)}%`, "--d": `${14 + (k * 5) % 11}s`, "--delay": `${-k * 2.7}s`, "--s": `${2 + (k % 3)}px` } }))),
      h("div", { class: "wbody" },
        wordEl,
        sayPill(word, p, "wipa glass"),
        h("p", { class: "wdef" }, `(${POS_SHORT[word.p] || word.p}) `, word.d),
        word.e ? h("p", { class: "wex" }, word.e) : null,
        word.cf && model.BY.get(word.cf) ? h("p", { class: "wcf glass" }, "Not to be confused with ", h("strong", {}, word.cf)) : null),
      h("div", { class: "wactions" },
        h("button", { class: "wbtn glass", "aria-label": "More about this word", onclick: () => details(word.w) }, icon("info")),
        h("button", { class: "wbtn glass", "aria-label": "Share", onclick: () => share(word) }, icon("share")),
        fav, save),
      showHint ? h("div", { class: "whint", "aria-hidden": "true" }, icon("up", 20), "Swipe up") : null);
    requestAnimationFrame(() => fitWord(wordEl));
    return el;
  }

  let cur = slide(queue[idx]);
  root.prepend(cur);
  const preload = () => { const w = queue[idx + 1]; if (w) { const img = new Image(); img.src = sceneUrl(sceneFor(p, w.w).id); } };
  preload();
  const onShow = (w) => { if (!w) return; preloadWord(w.w, p); if (p.readAloud) setTimeout(() => speak(w.w, p), 500); };
  onShow(queue[idx]);

  // Move to another word. dir 1 = next (up), -1 = back (down).
  // The words lift away while the scene dissolves into the next one underneath.
  function swap(word, dir) {
    if (busy) return; busy = true;
    const old = cur, fresh = slide(word);
    root.prepend(fresh); cur = fresh;
    const calm = reduced(), ease = "cubic-bezier(.22,.8,.24,1)";
    const body = old.querySelector(".wbody"), acts = old.querySelector(".wactions"), bg = old.querySelector(".wbg"), shade = old.querySelector(".wshade");
    const from = body.style.transform || "translateY(0)";
    if (calm) { old.remove(); busy = false; }
    else {
      body.animate([{ transform: from, opacity: 1, filter: "blur(0)" }, { transform: `translateY(${-dir * 90}px)`, opacity: 0, filter: "blur(6px)" }], { duration: 380, easing: ease, fill: "forwards" });
      acts && acts.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" });
      const fade = [{ opacity: 1 }, { opacity: 0 }];
      shade.animate(fade, { duration: 700, easing: ease, fill: "forwards" });
      const a = bg.animate([{ opacity: 1, transform: getComputedStyle(bg).transform }, { opacity: 0, transform: `scale(1.12) translateY(${-dir * 2}%)` }], { duration: 760, easing: ease, fill: "forwards" });
      fresh.querySelector(".wbody").animate([{ transform: `translateY(${dir * 40}px)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 560, delay: 120, easing: ease, fill: "backwards" });
      a.onfinish = () => { old.remove(); };
      setTimeout(() => { busy = false; }, 420);
    }
    onShow(word); preload();
  }
  function next() {
    const w = queue[idx];
    if (!w) return;
    model.seen(p.id, w.w); model.markActive(p.id);
    back.push(w); idx++;
    if (idx >= queue.length) { queue = model.queue(p); idx = 0; }
    // skip anything handled on another device in the meantime
    while (queue[idx] && model.card(p.id, queue[idx].w) && !back.includes(queue[idx])) idx++;
    if (showHint) { try { localStorage.setItem(HINT_KEY, String((+localStorage.getItem(HINT_KEY) || 0) + 1)); } catch {} }
    swap(queue[idx], 1);
  }
  function prev() {
    if (!back.length) { const body = cur.querySelector(".wbody"); body.style.transform = ""; body.style.opacity = ""; body.animate([{ transform: "translateY(0)" }, { transform: "translateY(26px)" }, { transform: "translateY(0)" }], { duration: 460, easing: "cubic-bezier(.34,1.4,.5,1)" }); return; }
    const w = back.pop(); queue.splice(idx, 0, w);
    swap(w, -1);
  }

  // Drag to turn the page
  let y0 = null, t0 = 0, dy = 0;
  root.addEventListener("pointerdown", (e) => { if (e.target.closest("button, a") || busy) return; y0 = e.clientY; t0 = performance.now(); dy = 0; root.setPointerCapture(e.pointerId); });
  const parts = () => [cur.querySelector(".wbody"), cur.querySelector(".wbg"), cur.querySelector(".wactions")];
  root.addEventListener("pointermove", (e) => {
    if (y0 == null) return; dy = e.clientY - y0;
    const [body, bg, acts] = parts();
    body.style.transform = `translateY(${dy * 0.6}px)`; body.style.opacity = String(Math.max(0.35, 1 - Math.abs(dy) / 500));
    bg.style.translate = `0 ${dy * 0.12}px`; if (acts) acts.style.opacity = String(Math.max(0, 1 - Math.abs(dy) / 160));
  });
  const end = () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, performance.now() - t0); y0 = null;
    if (dy < -70 || v < -0.45) next();
    else if (dy > 70 || v > 0.45) prev();
    else if (dy) {
      const [body, bg, acts] = parts(), from = body.style.transform;
      body.style.transform = ""; body.style.opacity = ""; if (acts) acts.style.opacity = "";
      body.animate([{ transform: from }, { transform: "translateY(0)" }], { duration: 480, easing: "cubic-bezier(.34,1.4,.5,1)" });
      const t = bg.style.translate; bg.style.translate = ""; bg.animate([{ translate: t }, { translate: "0 0" }], { duration: 480, easing: "cubic-bezier(.34,1.4,.5,1)" });
    }
  };
  root.addEventListener("pointerup", end); root.addEventListener("pointercancel", end);
  let wheelLock = 0;
  root.addEventListener("wheel", (e) => { e.preventDefault(); if (Date.now() < wheelLock || Math.abs(e.deltaY) < 24) return; wheelLock = Date.now() + 650; e.deltaY > 0 ? next() : prev(); }, { passive: false });
  const keys = (e) => {
    if (!document.body.contains(root)) { removeEventListener("keydown", keys); return; }
    if (document.querySelector(".sheet") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const w = queue[idx]; const k = e.key;
    if (k === "ArrowDown" || k === " " || k === "j") { e.preventDefault(); next(); }
    else if (k === "ArrowUp" || k === "k") { e.preventDefault(); prev(); }
    else if (w && k === "f") cur.querySelector(".fav").click();
    else if (w && k === "s") cur.querySelector(".save").click();
    else if (w && (k === "i" || k === "Enter")) details(w.w);
    else if (w && k === "p") speak(w.w, p);
  };
  addEventListener("keydown", keys);
  // These listeners go away with the screen, so visits don't pile them up
  const onKnown = () => { if (!document.body.contains(root)) { document.removeEventListener("lumin-known", onKnown); return; } next(); };
  document.addEventListener("lumin-known", onKnown);
  // Progress from another device: refresh the streak chip, and drop words handled there from what's coming
  const onRemote = () => {
    if (!document.body.contains(root)) { document.removeEventListener("lumin-remote", onRemote); return; }
    const nn = model.streak(app.profile); hud.firstChild.lastChild.textContent = String(nn);
  };
  document.addEventListener("lumin-remote", onRemote);
});
