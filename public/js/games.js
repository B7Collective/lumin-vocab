// Lumin Vocab: the Play screen. Every game, review and Journey step runs through here.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import * as srs from "./srs.js";
import { app, route, go } from "./app.js";
import { h, icon, speak, canSpeak, fitWord, reduced, plural } from "./ui.js";
import { play, buzz } from "./sound.js";
import { icon as artIcon, art } from "./art.js";
import { sayPill } from "./wordsheet.js";
import { countUp, enter } from "./motion.js";

export const KIND_NAME = { meaning: "What does it mean?", word: "Which word fits?", gap: "Fill the gap", listen: "Which word did you hear?", spell: "Spell it", unscramble: "Unscramble", flash: "Flash card" };
export const MODES = {
  perfection: { name: "Perfection", art: "perfect", about: "Keep going until your first mistake." },
  rush: { name: "Rush", art: "rush", about: "Three lives. How far can you get?" },
  sprint: { name: "Sprint", art: "sprint", about: "As many as you can in 60 seconds." },
};
let session = null;

// Start a session and open the Play screen.
// opts: { title, words, kind ("mixed" or one kind), mode, art, back, grade (default true), onFinish(result) }
export function start(opts) {
  session = { kind: "mixed", mode: "normal", grade: true, back: "/practice", art: "shuffle", ...opts };
  go("/play");
}

route("play", (main) => {
  const s = session;
  if (!s || !s.words || !s.words.length) { go("/practice"); return; }
  session = null; // a reload or back button starts fresh
  scrollTo(0, 0);
  const p = app.profile, kid = model.isKid(p);
  const endless = ["perfection", "rush", "sprint"].includes(s.mode);
  const pool = [...s.words];
  let i = 0, right = 0, wrongs = 0, lives = 3, run = 0, best = 0, timer = null, timeLeft = 60, done = false;
  const results = []; // { w, ok }
  const t0 = Date.now();

  const page = h("div", { class: "play" });
  main.append(page);
  const bar = h("i", {}), stat = h("span", { class: "pstat", "aria-live": "polite" });
  const hud = h("div", { class: "phud" },
    h("button", { class: "iconbtn", "aria-label": "Stop and go back", onclick: () => finish(true) }, icon("x")),
    h("div", { class: "pbar", role: "progressbar", "aria-label": "Progress" }, bar), stat);
  const body = h("div", { class: "stack loose", style: { "--gap": "var(--s5)", flex: "1" } });
  const foot = h("div", { class: "pfoot" });
  page.append(hud, body, foot);

  const total = endless ? null : pool.length;
  const progress = () => {
    const pct = endless ? (s.mode === "sprint" ? (1 - timeLeft / 60) * 100 : Math.min(100, (run % 10) * 10)) : (i / total) * 100;
    bar.style.setProperty("--p", pct + "%");
    if (s.mode === "rush") stat.replaceChildren(...[0, 1, 2].map((k) => { const ic = icon("heart", 20); ic.style.color = "var(--berry)"; ic.style.fill = k < lives ? "currentColor" : "none"; if (k >= lives) ic.classList.add("lost"); return ic; }));
    else if (s.mode === "sprint") { stat.replaceChildren(icon("clock", 20), String(timeLeft)); stat.classList.toggle("low", timeLeft <= 10); }
    else if (endless) stat.textContent = String(run);
    else stat.textContent = `${Math.min(i + 1, total)}/${total}`;
  };
  if (s.mode === "sprint") timer = setInterval(() => { timeLeft--; progress(); if (timeLeft <= 0) finish(); }, 1000);

  const pick = () => {
    if (endless) { const w = pool[i % pool.length]; if (i && i % pool.length === 0) pool.sort(() => Math.random() - 0.5); return w; }
    return pool[i];
  };
  const kindFor = (w) => {
    if (s.kind !== "mixed") return s.kind;
    const c = model.card(p.id, w.w); return model.mixedKind(w, (c && c.srs && c.srs.reps) || 0, kid);
  };

  function ask() {
    if (done) return;
    const w = pick();
    if (!w) return finish();
    progress();
    foot.replaceChildren();
    let kind = kindFor(w);
    let q = kind === "listen" && canSpeak()
      ? { ...model.question(w, "word", kid), kind: "listen" }
      : model.question(w, kind === "listen" ? "meaning" : kind, kid);
    const asked = Date.now();
    const card = h("div", { class: "qcard" }, h("span", { class: "qkind" }, s.mode === "placement" ? "Do you know this word?" : KIND_NAME[q.kind]));
    body.replaceChildren(card);

    const answer = (ok, chosenText) => {
      if (done) return;
      const ms = Date.now() - asked;
      results.push({ w: w.w, ok });
      if (ok) { right++; run++; best = Math.max(best, run); play("right"); buzz(12); }
      else { wrongs++; run = 0; play("wrong"); buzz([20, 40, 20]); if (s.mode === "rush") lives--; }
      if (s.grade && s.mode !== "placement") model.grade(p.id, w.w, srs.gradeFor(ok, ms));
      model.markActive(p.id);
      i++;
      progress();
      const out = (s.mode === "perfection" && !ok) || (s.mode === "rush" && lives <= 0) || (!endless && i >= total);
      const fast = endless || s.mode === "placement";
      if (q.kind === "flash") { setTimeout(() => out ? finish() : ask(), 260); return; } // you graded yourself: no verdict needed
      if (ok) {
        foot.replaceChildren(verdict(true, w));
        setTimeout(() => out ? finish() : ask(), fast ? 650 : 900);
      } else {
        const go2 = h("button", { class: "btn primary wide", onclick: () => out ? finish() : ask() }, out ? "See results" : "Continue");
        foot.replaceChildren(verdict(ok, w), go2);
        setTimeout(() => go2.focus(), 60);
      }
    };

    if (q.kind === "flash") {
      const fl = h("div", { class: "flash", role: "button", tabindex: "0", "aria-label": "Flip the card" },
        h("div", { class: "inner" },
          h("div", { class: "face front" }, h("div", { class: "qw serif" }, w.w), sayPill(w, p), h("span", { class: "tap" }, "Tap to flip")),
          h("div", { class: "face back" }, h("p", { class: "qd" }, w.d), w.e ? h("p", { class: "serif muted", style: { fontStyle: "italic" } }, w.e) : null)));
      const flip = () => { if (fl.classList.contains("flipped")) return; fl.classList.add("flipped"); play("tap");
        foot.replaceChildren(h("div", { class: "actions fill" },
          h("button", { class: "btn", onclick: () => answer(false) }, "Still learning"),
          h("button", { class: "btn primary", onclick: () => answer(true) }, "I knew it")));
      };
      fl.onclick = flip; fl.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
      card.append(fl); fl.querySelector(".qw").classList.add("qw");
      requestAnimationFrame(() => fitWord(fl.querySelector(".qw")));
      return;
    }

    const prompt = h("div", { class: "qprompt" });
    if (q.kind === "meaning") { const el = h("div", { class: "qw" }, w.w); prompt.append(el, sayPill(w, p)); requestAnimationFrame(() => fitWord(el)); }
    else if (q.kind === "gap") { const [a, b] = q.prompt.split("_____"); prompt.append(h("p", { class: "qs" }, a, h("span", { class: "gap" }), b)); }
    else if (q.kind === "listen") { const again = h("button", { class: "btn", onclick: () => speak(w.w, p) }, icon("speak"), "Play again"); prompt.append(h("p", { class: "qd muted" }, "Listen, then pick the word."), again); setTimeout(() => speak(w.w, p), 350); }
    else prompt.append(h("p", { class: "qd" }, q.prompt));
    card.append(prompt);

    if (q.options) {
      const opts = h("div", { class: "opts", role: "group", "aria-label": "Answers" });
      q.options.forEach((o, k) => {
        const b = h("button", { class: "opt" + (q.kind === "meaning" ? "" : " word"), style: { "--i": k }, "data-right": o.right ? "1" : "0", onclick: () => {
          if (opts.classList.contains("answered")) return;
          opts.classList.add("answered");
          b.classList.add(o.right ? "right" : "wrong");
          if (!o.right) opts.querySelectorAll(".opt").forEach((x, j) => { if (q.options[j].right) x.classList.add("right"); });
          answer(o.right);
        } }, o.text);
        opts.append(b);
      });
      card.append(opts);
      if (s.mode === "placement") card.append(h("button", { class: "linkbtn", onclick: () => { opts.classList.add("answered"); answer(false); } }, "I don't know this one"));
      return;
    }

    const target = w.w.toLowerCase();
    if (q.kind === "spell") {
      const input = h("input", { type: "text", class: "spellin", autocomplete: "off", autocapitalize: "none", spellcheck: "false", "aria-label": "Type the word", placeholder: target[0] + " " + "_ ".repeat(target.length - 1).trim() });
      const check = () => { if (!input.value.trim()) return; input.disabled = true; const ok = input.value.trim().toLowerCase() === target; input.style.color = ok ? "var(--good)" : "var(--bad)"; if (!ok) input.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 300 }); answer(ok); };
      card.append(h("form", { class: "stack", style: { alignItems: "center", width: "100%" }, onsubmit: (e) => { e.preventDefault(); check(); } }, input,
        h("p", { class: "muted small" }, `${target.length} letters, starting with "${target[0]}"`),
        h("button", { class: "btn primary", type: "submit" }, "Check")));
      setTimeout(() => input.focus(), 80);
      return;
    }
    if (q.kind === "unscramble") {
      const slots = h("div", { class: "slots", "aria-live": "polite", style: { "--n": target.length } }, [...target].map(() => h("span", { class: "slot" })));
      const picked = [];
      const tiles = h("div", { class: "tiles", style: { "--n": target.length } });
      const fill = () => { [...slots.children].forEach((sl, k) => { sl.textContent = picked[k] ? picked[k].l : ""; sl.classList.toggle("filled", !!picked[k]); }); };
      q.tiles.forEach((l, k) => {
        const t = h("button", { class: "ltile", "aria-label": `Letter ${l}`, onclick: () => {
          if (t.classList.contains("used") || picked.length >= target.length) return;
          picked.push({ l, t }); t.classList.add("used"); play("tap"); fill();
          if (picked.length === target.length) {
            const ok = picked.map((x) => x.l).join("") === target;
            slots.classList.add(ok ? "right" : "wrong");
            if (!ok) [...slots.children].forEach((sl, k2) => setTimeout(() => { sl.textContent = target[k2]; }, 500));
            tiles.querySelectorAll("button").forEach((x) => x.disabled = true);
            answer(ok);
          }
        } }, l);
        tiles.append(t);
      });
      // Keyboards: type the letters, Backspace to undo
      const keys = (e) => {
        if (!document.body.contains(tiles)) { removeEventListener("keydown", keys); return; }
        if (e.key === "Backspace") { e.preventDefault(); slots.click(); return; }
        const t = [...tiles.children].find((x) => !x.classList.contains("used") && !x.disabled && x.textContent === e.key.toLowerCase());
        if (t) { e.preventDefault(); t.click(); }
      };
      addEventListener("keydown", keys);
      slots.onclick = () => { const last = picked.pop(); if (last && !slots.classList.contains("right") && !slots.classList.contains("wrong")) { last.t.classList.remove("used"); fill(); } };
      card.append(slots, tiles, h("p", { class: "muted small" }, "Tap the letters in order. Tap the word to undo."));
    }
  }

  function verdict(ok, w) {
    const praise = ["Nice.", "Exactly.", "Spot on.", "Well done.", "That's it."];
    return h("div", { class: "verdict " + (ok ? "good" : "bad"), role: "status" }, icon(ok ? "check" : "x"),
      h("div", {}, h("strong", {}, ok ? praise[Math.floor(Math.random() * praise.length)] : `The answer is "${w.w}"`), ok ? null : h("span", {}, w.d)));
  }

  function finish(stopped = false) {
    if (done) return; done = true;
    clearInterval(timer);
    const answered = results.length, acc = answered ? Math.round((right / answered) * 100) : 0;
    const result = { right, wrong: wrongs, answered, acc, best, stopped, results };
    if (stopped && !answered) { history.length > 1 ? history.back() : go(s.back); return; }
    if (s.onFinish) { const r = s.onFinish(result); if (r && r.redirect) return; }
    const good = acc >= 70 && !stopped;
    if (good) { play("done"); confetti(); }
    const head = s.mode === "placement" ? s.placementTitle(result) : stopped ? "Good practice"
      : s.mode === "sprint" ? `${right} right in a minute` : endless ? `Best run: ${best}`
      : acc === 100 ? "Perfect" : acc >= 70 ? "Well done" : "Keep going";
    const tiles = [[String(right), "Right"], [acc + "%", "Accuracy"], s.mode === "sprint" ? [String(answered), "Answered"] : [String(best), "Best streak"]];
    body.replaceChildren(h("div", { class: "endcard" },
      art(artIcon(s.art), "", 160),
      h("h1", {}, head),
      s.endNote ? h("p", { class: "lead" }, s.endNote(result)) : null,
      h("div", { class: "score" }, tiles.map(([b, t]) => h("div", {}, h("b", {}, b), h("span", {}, t)))),
      results.length ? h("div", { class: "reviewlist" }, [...new Map(results.map((r) => [r.w, r])).values()].slice(0, 12).map((r) => {
        const w = model.lookup(r.w);
        return h("div", { class: "row-item" }, h("span", { style: { color: r.ok ? "var(--good)" : "var(--bad)" } }, icon(r.ok ? "check" : "x", 20)), h("div", { class: "grow" }, h("strong", { class: "serif" }, r.w), h("span", { class: "muted small" }, w ? w.d : "")));
      })) : null));
    stat.textContent = ""; bar.style.setProperty("--p", "100%");
    body.querySelectorAll(".score b").forEach((b) => { const m = b.textContent.match(/^(\d+)(%?)$/); if (m) { const span = h("span", {}); b.replaceChildren(span, m[2]); countUp(span, +m[1], 1100); } });
    enter(body.firstElementChild);
    const extra = s.extra ? s.extra(result) : null;
    foot.replaceChildren(h("div", { class: "actions fill" },
      s.again === false || extra ? null : h("button", { class: "btn", onclick: () => start({ ...s, words: s.refill ? s.refill() : s.words }) }, "Play again"),
      extra ? h("button", { class: "btn", onclick: () => go(s.back) }, "Not now") : null,
      extra ? h("button", { class: "btn primary", onclick: extra.fn }, extra.label) : h("button", { class: "btn primary", onclick: () => go(s.back) }, s.doneLabel || "Done")));
  }

  // Leaving mid-game stops the clock
  addEventListener("hashchange", () => { done = true; clearInterval(timer); }, { once: true });
  ask();
});

// Paper confetti in the illustration colors
export function confetti() {
  if (reduced()) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.append(c);
  const dpr = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const g = c.getContext("2d"); g.scale(dpr, dpr);
  const colors = ["#F2B544", "#1F6F78", "#B4527A", "#6F8F6C", "#24304A", "#F8F6F2"];
  const bits = Array.from({ length: 90 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  const step = (t) => {
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) { b.vy += 0.32; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr; g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2))); g.restore(); }
    if (t - t0 < 2600) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}
