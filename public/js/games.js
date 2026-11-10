// Lumin Vocab: the Play screen. Every game, review and Journey step runs through here.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import * as srs from "./srs.js";
import { app, route, go } from "./app.js";
import { h, icon, speak, canSpeak, fitWord, reduced, plural } from "./ui.js";
import { play, buzz } from "./sound.js";
import { icon as artIcon, art, keeperArt } from "./art.js";
import { sayPill, toggleFav, toggleSave, details, burst } from "./wordsheet.js";
import { sceneFor, sceneUrl } from "./art.js";
import { countUp, enter } from "./motion.js";

// Several ways to ask each kind of question, so games don't read the same every time
const ASK = {
  meaning: ["What does it mean?", "Pick the meaning", "Which definition fits?", "What's this word saying?", "Know this one?"],
  word: ["Which word fits?", "Name that word", "Which word means this?", "Find the word", "What's the word?"],
  gap: ["Fill the gap", "Finish the sentence", "Which word belongs here?", "Complete it", "Something's missing"],
  listen: ["Which word did you hear?", "Listen closely", "Ears on"],
  spell: ["Spell it", "Type it out", "From memory"],
  unscramble: ["Unscramble", "Put it back together", "Letters in a tangle"],
  flash: ["Flash card", "Meet the word", "Say it, then flip"],
  truefalse: ["True or false?", "Right or wrong?", "Is this right?"],
  synonym: ["Closest in meaning?", "Find its twin", "Which word is most like it?"],
  usage: ["Which sentence gets it right?", "Spot the right use", "Only one sounds right"],
  mixup: ["Which one fits?", "Don't mix them up", "Look-alikes"],
};
export const KIND_NAME = Object.fromEntries(Object.entries(ASK).map(([k, v]) => [k, v[0]]));
const oneOf = (a) => a[Math.floor(Math.random() * a.length)];
const PRAISE = ["Nice.", "Exactly.", "Spot on.", "Well done.", "That's it.", "Yes!", "Nailed it.", "Bright work.", "Sharp.", "Right on.", "Lovely.", "Got it.", "Brilliant.", "Perfect."];
const KID_PRAISE = ["Yes!", "You got it!", "Super!", "Woohoo!", "Great job!", "Amazing!", "High five!", "Brilliant!", "Way to go!"];
const OOPS = ["Not quite.", "Almost.", "Close one.", "Not this time.", "Tricky one."];
const STREAK = { 3: "Three in a row", 5: "Five in a row. On fire.", 8: "Eight straight", 10: "Ten in a row!", 15: "Fifteen. Unstoppable.", 20: "Twenty in a row!" };
// Show a sentence with the word picked out
function marked(text, w) {
  const re = new RegExp(`(^|[^\\w])(${model.escapeRe(w)})(?![\\w])`, "i"), m = text.match(re);
  if (!m) return [text];
  const at = m.index + m[1].length;
  return [text.slice(0, at), h("mark", {}, text.slice(at, at + m[2].length)), text.slice(at + m[2].length)];
}
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
  // A soft layer of scenery behind the cards
  const sc = sceneFor(p, (s.words[0] && s.words[0].w) || s.title);
  main.append(h("div", { class: "playbg", "aria-hidden": "true" }, h("img", { src: sceneUrl(sc.id), alt: "", decoding: "async" }), h("div", { class: "motes" }, Array.from({ length: 6 }, (_, k) => h("i", { style: { "--x": `${10 + k * 15}%`, "--d": `${16 + k * 3}s`, "--delay": `${-k * 3.1}s`, "--s": `${2 + (k % 3)}px` } })))));
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
    if (scrollY > 0) scrollTo(0, 0);
    progress();
    foot.replaceChildren();
    let kind = kindFor(w);
    let q = kind === "listen" && canSpeak()
      ? { ...model.question(w, "word", kid), kind: "listen" }
      : model.question(w, kind === "listen" ? "meaning" : kind, kid);
    const asked = Date.now();
    const card = h("div", { class: "qcard" }, h("span", { class: "qkind" }, s.mode === "placement" ? "Do you know this word?" : oneOf(ASK[q.kind] || [KIND_NAME[q.kind]])));
    body.replaceChildren(card);

    const answer = (ok, chosenText) => {
      if (done) return;
      const ms = Date.now() - asked;
      results.push({ w: w.w, ok });
      if (ok) { right++; run++; best = Math.max(best, run); play("right"); buzz(12); if (STREAK[run] && q.kind !== "flash") streakCall(run); }
      else { wrongs++; run = 0; play("wrong"); buzz([20, 40, 20]); if (s.mode === "rush") lives--; }
      if (s.grade && s.mode !== "placement") model.grade(p.id, w.w, srs.gradeFor(ok, ms));
      model.markActive(p.id);
      i++;
      progress();
      const out = (s.mode === "perfection" && !ok) || (s.mode === "rush" && lives <= 0) || (!endless && i >= total);
      const fast = endless || s.mode === "placement";
      if (q.kind === "flash") { setTimeout(() => out ? finish() : ask(), 260); return; } // you graded yourself: no verdict needed
      const reveal = () => requestAnimationFrame(() => { const r = foot.getBoundingClientRect(); if (r.bottom > innerHeight - 8) foot.scrollIntoView({ block: "end", behavior: reduced() ? "auto" : "smooth" }); });
      if (ok) {
        foot.replaceChildren(verdict(true, w, q)); reveal();
        setTimeout(() => out ? finish() : ask(), fast ? 650 : 900);
      } else {
        const go2 = h("button", { class: "btn primary wide", onclick: () => out ? finish() : ask() }, out ? "See results" : "Continue");
        foot.replaceChildren(verdict(ok, w, q), go2); reveal();
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
    const bigWord = () => { const el = h("div", { class: "qw" }, w.w); prompt.append(el, sayPill(w, p)); requestAnimationFrame(() => fitWord(el)); };
    if (q.kind === "meaning" || q.kind === "synonym" || q.kind === "usage") bigWord();
    else if (q.kind === "truefalse") { bigWord(); prompt.append(h("p", { class: "qd tf" }, h("span", { class: "muted" }, "means "), q.prompt)); }
    else if (q.kind === "gap" || q.kind === "mixup") { const [a, b] = q.prompt.split("_____"); prompt.append(h("p", { class: "qs" }, a, h("span", { class: "gap" }), b)); }
    else if (q.kind === "listen") { const again = h("button", { class: "btn", onclick: () => speak(w.w, p) }, icon("speak"), "Play again"); prompt.append(h("p", { class: "qd muted" }, "Listen, then pick the word."), again); setTimeout(() => speak(w.w, p), 350); }
    else prompt.append(h("p", { class: "qd" }, q.prompt));
    card.append(prompt);

    if (q.options) {
      const look = q.kind === "truefalse" ? " tfopt" : q.kind === "usage" ? " sent" : q.kind === "meaning" || q.kind === "listen" ? "" : " word";
      const opts = h("div", { class: "opts" + (q.kind === "truefalse" || q.kind === "mixup" ? " two" : ""), role: "group", "aria-label": "Answers" });
      q.options.forEach((o, k) => {
        const b = h("button", { class: "opt" + look, style: { "--i": k }, "data-right": o.right ? "1" : "0", onclick: () => {
          if (opts.classList.contains("answered")) return;
          opts.classList.add("answered");
          b.classList.add(o.right ? "right" : "wrong");
          if (o.right) burst(b, ["#F2B544", "#7CC6CE", "#FFFFFF"]);
          if (!o.right) opts.querySelectorAll(".opt").forEach((x, j) => { if (q.options[j].right) x.classList.add("right"); });
          answer(o.right);
        } }, q.kind === "usage" ? marked(o.text, w.w) : o.text);
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

  function verdict(ok, w, q) {
    const other = q && q.kind === "mixup" ? model.lookup(w.cf) : null;
    const note = other ? `${w.w}: ${w.d} ${other.w}: ${other.d}` : q && q.kind === "truefalse" && !q.truth ? `${w.w} means: ${w.d}` : w.d;
    const head = ok ? oneOf(kid ? KID_PRAISE : PRAISE) : q && q.kind === "truefalse" ? `${oneOf(OOPS)} It's ${q.truth ? "true" : "false"}.`
      : q && q.kind === "usage" ? `${oneOf(OOPS)} The green one uses "${w.w}" right.` : q && q.kind === "synonym" ? `${oneOf(OOPS)} The closest is the green one.` : `${oneOf(OOPS)} It's "${w.w}"`;
    return h("div", { class: "verdict " + (ok ? "good" : "bad"), role: "status" }, icon(ok ? "check" : "x"),
      h("div", {}, h("strong", {}, head), ok && !other ? null : h("span", {}, note)));
  }
  function streakCall(n) {
    if (reduced()) return;
    const el = h("div", { class: "streakcall", "aria-hidden": "true" }, icon("flame", 22), STREAK[n]);
    page.append(el); play("unlock"); setTimeout(() => el.remove(), 1700);
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
      art(String(s.art).startsWith("keeper:") ? keeperArt(s.art.slice(7)) : artIcon(s.art), "", 160),
      h("h1", {}, head),
      s.endNote ? h("p", { class: "lead" }, s.endNote(result)) : null,
      h("div", { class: "score" }, tiles.map(([b, t]) => h("div", {}, h("b", {}, b), h("span", {}, t)))),
      results.length ? h("div", { class: "reviewlist" }, [...new Map(results.map((r) => [r.w, r])).values()].slice(0, 16).map((r) => {
        const w = model.lookup(r.w);
        const c = model.card(p.id, r.w) || {};
        const fav = h("button", { class: "iconbtn fav", "aria-label": `Favorite ${r.w}`, "aria-pressed": String(!!c.fav), onclick: () => toggleFav(fav, r.w) }, icon("heart", 20));
        const sv = h("button", { class: "iconbtn save", "aria-label": `Save ${r.w} to practice`, "aria-pressed": String(c.st === "learning"), onclick: () => toggleSave(sv, r.w) }, icon("bookmark", 20));
        return h("div", { class: "row-item" }, h("span", { class: r.ok ? "rk good" : "rk bad" }, icon(r.ok ? "check" : "x", 20)),
          h("button", { class: "grow rw", onclick: () => details(r.w) }, h("strong", { class: "serif" }, r.w), h("span", { class: "muted small" }, w ? w.d : "")), fav, sv);
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
