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
  hidden: ["Light the letters", "Guess the word", "Letter by letter"],
  hearspell: ["Hear and spell", "Type what you hear", "Listen and spell"],
  incontext: ["What does it mean here?", "Read the clues", "Meaning from context"],
  oddone: ["Odd one out", "Which one doesn't belong?", "Spot the stranger"],
  opposite: ["What's the opposite?", "Flip it", "Find its opposite"],
  useit: ["Make it yours", "Your turn", "In your own words"],
  build: ["Build the sentence", "Put it in order", "Sentence shuffle"],
  pairs: ["Match the pairs"],
  wordsearch: ["Word hunt"],
  memory: ["Memory cards"],
  cloze: ["Fill the story"],
};
const QUICK = ["meaning", "word", "truefalse", "opposite", "synonym", "listen"];
const BOARDS = new Set(["pairs", "wordsearch", "memory", "cloze"]);
// Ways to give a missed word its second chance
const RETRY_KINDS = ["meaning", "word", "gap", "incontext", "unscramble"];
// A to Z in rows of seven: every key the same size, and big enough for any finger
const KEYS = ["abcdefg", "hijklmn", "opqrstu", "vwxyz"];
// Letter tiles never shrink below a comfortable tap size. A long word wraps onto balanced rows of equal tiles.
function letterGrid(n, min = 46, max = 56, gap = 8) {
  const w = Math.min(innerWidth || 390, 620), gutter = Math.min(32, Math.max(16, w * 0.04));
  const avail = w - 2 * gutter, most = Math.max(4, Math.floor((avail + gap) / (min + gap)));
  const cols = Math.ceil(n / Math.ceil(n / most));
  const size = Math.min(max, Math.floor((avail - (cols - 1) * gap) / cols));
  return { "--cols": cols, "--lt": size + "px" };
}
export const KIND_NAME = Object.fromEntries(Object.entries(ASK).map(([k, v]) => [k, v[0]]));
const oneOf = (a) => a[Math.floor(Math.random() * a.length)];
const PRAISE = ["Nice.", "Exactly.", "Spot on.", "Well done.", "That's it.", "Yes!", "Nailed it.", "Bright work.", "Sharp.", "Right on.", "Lovely.", "Got it.", "Brilliant.", "Perfect."];
const KID_PRAISE = ["Yes!", "You got it!", "Super!", "Woohoo!", "Great job!", "Amazing!", "High five!", "Brilliant!", "Way to go!"];
const OOPS = ["Not quite.", "Almost.", "Close one.", "Not this time.", "Tricky one."];
const STREAK = { 3: "Three in a row", 5: "Five in a row. On fire.", 8: "Eight straight", 10: "Ten in a row!", 15: "Fifteen. Unstoppable.", 20: "Twenty in a row!" };
// Show a sentence with the word picked out
// Spelling: exact is right. For long words, one slip is still right, just not perfect.
function editDist(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}
export function spellCheck(typed, target) {
  if (typed === target) return { ok: true, near: false };
  if (target.length >= 8 && editDist(typed, target) === 1) return { ok: true, near: true };
  return { ok: false, near: false };
}
// Fold an element away smoothly (its height, then gone)
function stepAside(el) {
  if (reduced()) { el.hidden = true; return; }
  const hgt = el.getBoundingClientRect().height;
  el.style.height = hgt + "px"; el.style.overflow = "hidden"; void el.offsetHeight;
  el.classList.add("aside");
  el.addEventListener("transitionend", () => { el.hidden = true; }, { once: true });
}
const closeTry = (typed, target) => editDist(typed, target) <= Math.max(2, Math.floor(target.length / 3));
// The right spelling, with the letters you missed picked out
function compareLetters(typed, target) {
  return h("span", { class: "lcmp", "aria-label": `The spelling is ${target}` }, [...target].map((c, k) => h("b", { class: typed[k] === c ? "" : "diff" }, c)));
}
// Does a sentence use the word, or a form of it (walk, walked, walking; happy, happily)?
export function usesWord(text, word) {
  const first = word.toLowerCase().split(/[\s-]/)[0];
  const stem = first.length > 4 ? first.replace(/(e|y|le)$/, "") : first;
  return new RegExp(`(^|[^a-z])${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text);
}
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
  session = { kind: "mixed", mode: "normal", grade: true, study: false, retry: false, noKinds: null, back: "/practice", art: "shuffle", ...opts };
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
  const results = []; // { w, ok, retry }
  // Missed words come back once at the end, asked a different way (a second try right after feedback is how a miss turns into memory)
  const retryOn = s.retry && !endless && s.mode === "normal" && !s.study, retryQ = [], retried = new Set(), firstKind = new Map();
  const slow = kid ? 1.5 : 1, read = !!p.readAloud && canSpeak();
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

  let total = endless ? null : pool.length;
  const firstTotal = total;
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
  const kindFor = (w, again) => {
    if (again) {
      // a second chance comes as a different kind of question
      const was = firstKind.get(w.w), ok = RETRY_KINDS.filter((k) => k !== was && model.canAsk(w, k, kid));
      return ok[Math.floor(Math.random() * ok.length)] || "meaning";
    }
    if (s.kind === "quick") { const ok = QUICK.filter((k) => model.canAsk(w, k, kid)); return ok[Math.floor(Math.random() * ok.length)] || "meaning"; }
    if (s.kind !== "mixed") return s.kind;
    const c = model.card(p.id, w.w); return model.mixedKind(w, (c && c.srs && c.srs.reps) || 0, kid, s.noKinds || undefined);
  };

  function ask() {
    if (done) return;
    const w = pick();
    if (!w) return finish();
    if (scrollY > 0) scrollTo(0, 0);
    progress();
    foot.replaceChildren();
    const again = retried.has(w.w) && i >= firstTotal;
    let kind = kindFor(w, again);
    if (!again) firstKind.set(w.w, kind);
    let q = kind === "listen" && canSpeak()
      ? { ...model.question(w, "word", kid), kind: "listen" }
      : model.question(w, kind === "listen" ? "meaning" : kind, kid);
    const asked = Date.now();
    const label = s.mode === "placement" ? "Do you know this word?" : again ? "One more try" : s.study ? "New word" : oneOf(ASK[q.kind] || [KIND_NAME[q.kind]]);
    const card = h("div", { class: "qcard" + (again ? " retry" : "") }, h("span", { class: "qkind" }, label));
    body.replaceChildren(card);

    const answer = (ok, opts2 = {}) => {
      if (done) return;
      const ms = Date.now() - asked, quiet = q.kind === "flash" || q.kind === "useit";
      results.push({ w: w.w, ok, retry: again });
      if (!again) { if (ok) right++; else wrongs++; }
      if (ok) { run++; best = Math.max(best, run); if (!quiet) { play("right"); buzz(12); } if (STREAK[run] && !quiet) streakCall(run); }
      else { run = 0; play("wrong"); buzz([20, 40, 20]); if (s.mode === "rush") lives--; }
      if (s.grade && s.mode !== "placement" && !again) model.grade(p.id, w.w, srs.gradeFor(ok, ms, !!opts2.hinted, q.kind, slow));
      if (!ok && retryOn && !again && !retried.has(w.w)) { retried.add(w.w); retryQ.push(w); }
      model.markActive(p.id);
      i++;
      // the misses join the end of the line
      if (!endless && i >= total && retryQ.length) { pool.push(...retryQ.splice(0)); total = pool.length; }
      progress();
      const out = (s.mode === "perfection" && !ok) || (s.mode === "rush" && lives <= 0) || (!endless && i >= total);
      const fast = endless || s.mode === "placement";
      if (quiet) { setTimeout(() => out ? finish() : ask(), 200); return; } // nothing to grade: straight on
      const reveal = () => {}; // the footer sticks to the bottom of the screen, so the feedback is always in view
      if (ok) {
        foot.replaceChildren(verdict(true, w, q)); reveal();
        setTimeout(() => out ? finish() : ask(), fast ? 650 : 900);
      } else {
        const go2 = h("button", { class: "btn wide vgo", onclick: () => out ? finish() : ask() }, out ? "See results" : "Continue");
        foot.replaceChildren(verdict(ok, w, q), go2); reveal();
        setTimeout(() => go2.focus(), 60);
      }
    };

    // Meet the words: read, listen, move on. Nothing to get wrong.
    if (q.kind === "flash" && s.study) {
      const meet = h("div", { class: "meet" },
        h("div", { class: "meethead" }, h("span", { class: "ws-pos" }, w.p), h("div", { class: "qw serif" }, w.w), sayPill(w, p)),
        h("p", { class: "meetdef" }, w.d),
        w.e ? h("p", { class: "meetex serif" }, marked(w.e, w.w)) : null,
        (w.m || []).length ? h("p", { class: "meetlike" }, h("span", { class: "muted" }, "Close to "), (w.m || []).slice(0, 3).join(", ")) : null);
      card.append(meet);
      requestAnimationFrame(() => fitWord(meet.querySelector(".qw")));
      if (read || kid) setTimeout(() => speak(w.w, p), 300);
      const last = i + 1 >= total;
      const next = h("button", { class: "btn primary wide", onclick: () => { removeEventListener("keydown", keyNext); answer(true); } }, last ? "Done" : "Next word");
      const keyNext = (e) => { if (!document.body.contains(next)) { removeEventListener("keydown", keyNext); return; } if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next.click(); } };
      addEventListener("keydown", keyNext);
      foot.replaceChildren(next);
      return;
    }
    if (q.kind === "useit") return useIt(w, q, card, answer);
    if (q.kind === "flash") {
      const fl = h("div", { class: "flash", role: "button", tabindex: "0", "aria-label": "Flip the card" },
        h("div", { class: "inner" },
          h("div", { class: "face front" }, h("div", { class: "qw serif" }, w.w), sayPill(w, p), h("span", { class: "tap" }, "Tap to flip")),
          h("div", { class: "face back" }, h("p", { class: "qd" }, w.d), w.e ? h("p", { class: "serif muted", style: { fontStyle: "italic" } }, w.e) : null)));
      const flip = () => { if (fl.classList.contains("flipped")) return; fl.classList.add("flipped"); play("tap");
        foot.replaceChildren(h("div", { class: "actions fill" },
          h("button", { class: "btn", onclick: () => answer(false) }, "Didn't know"),
          h("button", { class: "btn primary", onclick: () => answer(true) }, "Knew it")));
      };
      fl.onclick = flip; fl.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
      card.append(fl); fl.querySelector(".qw").classList.add("qw");
      requestAnimationFrame(() => fitWord(fl.querySelector(".qw")));
      return;
    }

    const prompt = h("div", { class: "qprompt" });
    const bigWord = () => { const el = h("div", { class: "qw" }, w.w); prompt.append(el, sayPill(w, p)); requestAnimationFrame(() => fitWord(el)); if (read) setTimeout(() => speak(w.w, p), 350); };
    if (q.kind === "hidden") return hiddenWord(w, q, card, answer);
    if (q.kind === "hearspell") return hearSpell(w, q, card, answer);
    if (q.kind === "build") return buildSentence(w, q, card, answer);
    if (q.kind === "incontext") prompt.append(h("p", { class: "qs ctx" }, marked(q.prompt, w.w)));
    else if (q.kind === "oddone") prompt.append(h("p", { class: "qd" }, "Three of these are close in meaning. Which one doesn't belong?"));
    else if (q.kind === "opposite") { bigWord(); prompt.append(h("p", { class: "qd tf" }, h("span", { class: "muted" }, "is the opposite of...")));  }
    else if (q.kind === "meaning" || q.kind === "synonym" || q.kind === "usage") bigWord();
    else if (q.kind === "truefalse") { bigWord(); prompt.append(h("p", { class: "qd tf" }, h("span", { class: "muted" }, "means "), q.prompt)); }
    else if (q.kind === "gap" || q.kind === "mixup") { const [a, b] = q.prompt.split("_____"); prompt.append(h("p", { class: "qs" }, a, h("span", { class: "gap" }), b)); }
    else if (q.kind === "listen") { const again = h("button", { class: "btn", onclick: () => speak(w.w, p) }, icon("speak"), "Play again"); prompt.append(h("p", { class: "qd muted" }, "Listen, then pick the word."), again); setTimeout(() => speak(w.w, p), 350); }
    else prompt.append(h("p", { class: "qd" }, q.prompt));
    card.append(prompt);

    if (q.options) {
      const look = q.kind === "truefalse" ? " tfopt" : q.kind === "usage" ? " sent" : q.kind === "meaning" || q.kind === "listen" || q.kind === "incontext" ? "" : " word";
      const opts = h("div", { class: "opts" + (q.kind === "truefalse" || q.kind === "mixup" || q.kind === "oddone" ? " two" : ""), role: "group", "aria-label": "Answers" });
      q.options.forEach((o, k) => {
        const b = h("button", { class: "opt" + look, style: { "--i": k }, "data-right": o.right ? "1" : "0", onclick: () => {
          if (opts.classList.contains("answered")) return;
          opts.classList.add("answered");
          b.classList.add(o.right ? "right" : "wrong");
          if (o.right) burst(b, ["#F2B544", "#7CC6CE", "#FFFFFF"]);
          if (!o.right) {
            opts.querySelectorAll(".opt").forEach((x, j) => { if (q.options[j].right) x.classList.add("right"); });
            if (!opts.classList.contains("two")) setTimeout(() => opts.querySelectorAll(".opt:not(.right):not(.wrong)").forEach(stepAside), 380);
          }
          answer(o.right);
        } }, q.kind === "usage" ? marked(o.text, w.w) : o.text);
        opts.append(b);
      });
      card.append(opts);
      // Early readers can hear the whole question, answers included
      if (read && q.kind !== "listen") {
        const said = [q.kind === "gap" || q.kind === "mixup" ? String(q.prompt).replace("_____", "blank") : q.kind === "incontext" ? q.prompt : q.kind === "truefalse" ? `${w.w} means ${q.prompt}` : "",
          ...q.options.map((o, k) => `${k + 1}. ${o.text}`)].filter(Boolean).join(". ");
        card.append(h("button", { class: "linkbtn readme", type: "button", onclick: () => speak(said, p) }, icon("speak", 18), "Read it to me"));
      }
      if (s.mode === "placement") card.append(h("button", { class: "linkbtn", onclick: () => { opts.classList.add("answered"); answer(false); } }, "I don't know this one"));
      return;
    }

    const target = w.w.toLowerCase();
    if (q.kind === "spell") {
      const input = h("input", { type: "text", class: "spellin", autocomplete: "off", autocapitalize: "none", spellcheck: "false", "aria-label": "Type the word", placeholder: target[0] + " " + "_ ".repeat(target.length - 1).trim() });
      const hint = h("p", { class: "muted small" }, `${target.length} letters, starting with "${target[0]}"`);
      const check = () => {
        const typed = input.value.trim().toLowerCase(); if (!typed) return; input.disabled = true;
        const res = spellCheck(typed, target);
        input.style.color = res.ok && !res.near ? "var(--good)" : res.ok ? "var(--warn, #B07A1E)" : "var(--bad)";
        if (!res.ok) input.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 300 });
        if (res.near || (!res.ok && closeTry(typed, target))) hint.replaceChildren(compareLetters(typed, target), h("span", { class: "small" }, res.near ? "One letter off. Close enough, but here's the spelling." : ""));
        answer(res.ok, { hinted: res.near });
      };
      card.append(h("form", { class: "stack", style: { alignItems: "center", width: "100%" }, onsubmit: (e) => { e.preventDefault(); check(); } }, input,
        hint, h("button", { class: "btn primary", type: "submit" }, "Check")));
      setTimeout(() => input.focus(), 80);
      return;
    }
    if (q.kind === "unscramble") {
      const grid = letterGrid(target.length);
      const slots = h("div", { class: "slots", "aria-live": "polite", style: grid }, [...target].map(() => h("span", { class: "slot" })));
      const picked = [];
      const tiles = h("div", { class: "tiles", style: grid });
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

  // The moment after an answer: one calm panel. A miss shows something new (the word in a real sentence)
  // rather than repeating what's already on screen.
  function verdict(ok, w, q) {
    const k = q && q.kind, other = k === "mixup" ? model.lookup(w.cf) : null;
    const inUse = () => { const sent = k === "gap" || k === "mixup" ? String(q.prompt).replace(/\b([aA])\/an _____/, (m, A) => (/^[aeiou]/i.test(w.w) ? A + "n " : A + " ") + w.w).replace("_____", w.w) : model.sentences(w)[0]; return sent ? marked(sent, w.w) : w.d; };
    let head, body = null;
    if (ok) {
      head = oneOf(kid ? KID_PRAISE : PRAISE);
      if (other) body = [h("b", {}, w.w), `: ${w.d}. `, h("b", {}, other.w), `: ${other.d}.`];
      else if (k === "opposite") body = [h("b", {}, w.w), ` and ${q.answer} are opposites.`];
      else if (k === "oddone") body = [`${w.w}, ${q.twins.join(" and ")}: all about ${w.d.replace(/\.$/, "").toLowerCase()}.`];
    } else {
      const oops = oneOf(OOPS);
      if (k === "meaning" || k === "listen" && q.options && q.options[0] && q.options[0].text !== w.w) { head = oops; body = inUse(); }
      else if (k === "truefalse") { head = `${oops} It's ${q.truth ? "true" : "false"}.`; body = [h("b", {}, w.w), ` means ${w.d.replace(/^./, (c) => c.toLowerCase())}`]; }
      else if (k === "usage") { head = `${oops} The green one fits.`; body = [h("b", {}, w.w), `: ${w.d}`]; }
      else if (k === "synonym") { head = `${oops} The green one is closest.`; body = [h("b", {}, w.w), `: ${w.d}`]; }
      else if (k === "incontext") { head = `${oops} Here it means:`; body = w.d; }
      else if (k === "oddone") { head = `${oops} It's "${q.odd}".`; body = `${w.w} and ${q.twins.join(" and ")} share a meaning: ${w.d.replace(/\.$/, "").toLowerCase()}.`; }
      else if (k === "opposite") { head = `${oops} It's "${q.answer}".`; body = [h("b", {}, w.w), `: ${w.d}`]; }
      else if (k === "build") { head = `${oops} Here's the sentence:`; body = marked(q.sentence, w.w); }
      else if (other) { head = `${oops} It's "${w.w}".`; body = [h("b", {}, other.w), ` means ${other.d.replace(/^./, (c) => c.toLowerCase())}`]; }
      else { head = `${oops} It's "${w.w}".`; body = k === "gap" || k === "word" || k === "listen" ? inUse() : w.d; }
    }
    return verdictBox(ok, head, body);
  }
  function verdictBox(ok, head, body) {
    return h("div", { class: "verdict " + (ok ? "good" : "bad"), role: "status" },
      h("div", { class: "vhead" }, h("span", { class: "vbadge", "aria-hidden": "true" }, icon(ok ? "check" : "x", 18)), h("strong", {}, head)),
      body ? h("p", { class: "vbody" }, body) : null);
  }
  // ---- Light the letters: guess the word letter by letter, six lanterns ----
  function hiddenWord(w, q, card, answer) {
    const target = w.w.toLowerCase(), letters = new Set([...target].filter((c) => /[a-z]/.test(c)));
    const got = new Set(), misses = [];
    const MAX = 6;
    if (kid) got.add(target[0]);
    const slots = h("div", { class: "hslots", "aria-live": "polite", style: letterGrid([...target].length, 30, 40, 6) });
    const lights = h("div", { class: "hlights", "aria-label": "Lanterns left" });
    const kb = h("div", { class: "hkeys", role: "group", "aria-label": "Letters" });
    const paint = () => {
      slots.replaceChildren(...[...target].map((c) => /[a-z]/.test(c) ? h("span", { class: "hslot" + (got.has(c) ? " on" : "") }, got.has(c) ? c : "") : h("span", { class: "hgap" }, c === " " ? "" : c)));
      lights.replaceChildren(...Array.from({ length: MAX }, (_, k) => h("i", { class: k < MAX - misses.length ? "lit" : "" })));
      lights.setAttribute("aria-label", `${MAX - misses.length} lanterns left`);
    };
    let over = false;
    const guess = (c, btn) => {
      if (over || got.has(c) || misses.includes(c)) return;
      if (letters.has(c)) { got.add(c); play("tap"); btn && btn.classList.add("hit"); }
      else { misses.push(c); play("wrong"); buzz(15); btn && btn.classList.add("miss"); }
      if (btn) btn.disabled = true;
      paint();
      const solved = [...letters].every((x) => got.has(x));
      if (solved || misses.length >= MAX) {
        over = true; removeEventListener("keydown", keys);
        if (!solved) { [...letters].forEach((x) => got.add(x)); paint(); slots.classList.add("reveal"); } else slots.classList.add("solved");
        kb.querySelectorAll("button").forEach((b) => b.disabled = true);
        answer(solved);
      }
    };
    KEYS.forEach((row) => kb.append(h("div", { class: "hrow" }, [...row].map((c) => { const b = h("button", { type: "button", class: "hkey", "aria-label": `Letter ${c}`, onclick: () => guess(c, b) }, c); if (got.has(c)) { b.disabled = true; b.classList.add("hit"); } return b; }))));
    const keys = (e) => { if (!document.body.contains(kb)) { removeEventListener("keydown", keys); return; } const c = e.key.toLowerCase(); if (/^[a-z]$/.test(c) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); guess(c, kb.querySelector(`[aria-label="Letter ${c}"]`)); } };
    addEventListener("keydown", keys);
    paint();
    card.append(h("div", { class: "qprompt" }, h("p", { class: "qd" }, q.prompt)), slots, lights, kb);
  }

  // ---- Hear and spell ----
  function hearSpell(w, q, card, answer) {
    const target = w.w.toLowerCase();
    const again = h("button", { class: "btn hearbtn", type: "button", onclick: () => speak(w.w, p) }, icon("speak", 26), "Play the word");
    const input = h("input", { type: "text", class: "spellin", autocomplete: "off", autocapitalize: "none", spellcheck: "false", "aria-label": "Type the word you heard", placeholder: "_ ".repeat(target.length).trim() });
    const hint = h("p", { class: "muted small" }, `${target.length} letters`);
    const check = () => {
      const typed = input.value.trim().toLowerCase(); if (!typed) return; input.disabled = true;
      const res = spellCheck(typed, target);
      input.style.color = res.ok && !res.near ? "var(--good)" : res.ok ? "var(--warn, #B07A1E)" : "var(--bad)";
      if (!res.ok) input.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 300 });
      if (res.near || (!res.ok && closeTry(typed, target))) hint.replaceChildren(compareLetters(typed, target));
      answer(res.ok, { hinted: res.near });
    };
    card.append(h("div", { class: "qprompt" }, again, h("p", { class: "qd muted small" }, `Hint: ${q.prompt}`)),
      h("form", { class: "stack", style: { alignItems: "center", width: "100%" }, onsubmit: (e) => { e.preventDefault(); check(); } }, input,
        hint, h("button", { class: "btn primary", type: "submit" }, "Check")));
    setTimeout(() => speak(w.w, p), 300);
    setTimeout(() => input.focus(), 80);
  }

  // ---- Make it yours: write your own sentence with the word ----
  function useIt(w, q, card, answer) {
    const c = model.card(p.id, w.w) || {};
    const ta = h("textarea", { class: "mine", rows: 3, maxlength: 240, autocapitalize: "sentences", "aria-label": `Your sentence with ${w.w}`,
      placeholder: "Something true about your day, your friends, or what you like" });
    ta.value = c.mine || "";
    const note = h("p", { class: "muted small minenote", "aria-live": "polite" }, "Write about your own life. It sticks better.");
    const save = () => {
      const t = ta.value.trim().replace(/\s+/g, " ");
      if (!t) { ta.focus(); return; }
      if (!usesWord(t, w.w) && !(w.f || []).some((x) => usesWord(t, x))) { note.textContent = `Use "${w.w}" (or a form of it) somewhere in your sentence.`; note.classList.add("warn"); ta.focus(); return; }
      if (t.split(" ").length < 3) { note.textContent = "Make it a sentence, a few words at least."; note.classList.add("warn"); ta.focus(); return; }
      model.setMine(p.id, w.w, t); play("right"); buzz(10); answer(true);
    };
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } };
    const head = h("div", { class: "meethead" }, h("span", { class: "ws-pos" }, w.p), h("div", { class: "qw serif" }, w.w), sayPill(w, p));
    card.append(h("div", { class: "meet" }, head, h("p", { class: "meetdef" }, w.d),
      q.model ? h("p", { class: "meetex serif" }, h("span", { class: "exlabel" }, "For example"), marked(q.model, w.w)) : null),
      h("div", { class: "useit" }, ta, note));
    requestAnimationFrame(() => fitWord(head.querySelector(".qw")));
    foot.replaceChildren(h("div", { class: "actions mineacts" }, h("button", { class: "btn quiet", onclick: () => answer(true) }, "Skip"), h("button", { class: "btn primary", onclick: save }, "Save my sentence")));
    setTimeout(() => ta.focus({ preventScroll: true }), 120);
  }

  // ---- Build the sentence: tap the words in order ----
  function buildSentence(w, q, card, answer) {
    const built = [], line = h("div", { class: "bline", "aria-live": "polite" }), bank = h("div", { class: "bbank", role: "group", "aria-label": "Words to place" });
    const target = new RegExp(`^\\W*${model.escapeRe(w.w)}\\W*$`, "i");
    const check = h("button", { class: "btn primary", type: "button", disabled: true, onclick: () => {
      const text = built.map((x) => x.t).join(" ");
      const norm = (x) => x.toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();
      const ok = norm(text) === norm(q.sentence) || model.sentences(w).some((x) => norm(x) === norm(text));
      line.classList.add(ok ? "right" : "wrong");
      bank.querySelectorAll("button").forEach((b) => b.disabled = true); line.querySelectorAll("button").forEach((b) => b.disabled = true); check.disabled = true;
      answer(ok);
    } }, "Check");
    const paint = () => {
      line.replaceChildren(...(built.length ? built.map((x, k) => h("button", { type: "button", class: "btile placed" + (target.test(x.t) ? " key" : ""), onclick: () => { built.splice(k, 1); x.el.classList.remove("used"); x.el.disabled = false; play("tap"); paint(); } }, x.t)) : [h("span", { class: "bhint" }, "Tap the words in order")]));
      check.disabled = built.length !== q.tiles.length;
    };
    q.tiles.forEach((x) => {
      const b = h("button", { type: "button", class: "btile" + (target.test(x.t) ? " key" : ""), onclick: () => { if (b.classList.contains("used")) return; b.classList.add("used"); b.disabled = true; built.push({ t: x.t, el: b }); play("tap"); paint(); } }, x.t);
      bank.append(b);
    });
    paint();
    card.append(h("div", { class: "qprompt" }, h("p", { class: "qd muted" }, `A sentence with "${w.w}", scrambled.`)), line, bank, h("div", { class: "actions" }, check));
  }

  // ---- Boards: several words on one screen (Match the pairs, Word hunt) ----
  function runBoard() {
    const uniq = [...new Map(pool.map((w) => [w.w, w])).values()];
    if (s.kind === "pairs" || s.kind === "memory" || s.kind === "cloze") {
      const size = kid ? 3 : s.kind === "memory" ? 4 : s.kind === "cloze" ? 3 : 4, groups = [];
      const use = s.kind === "cloze" ? uniq.filter((w) => model.canAsk(w, "gap", kid)) : uniq;
      const rest = s.kind === "cloze" ? uniq.filter((w) => !use.includes(w)) : [];
      if (use.length < 2) { s.kind = "meaning"; pool.splice(0, pool.length, ...uniq); total = pool.length; return ask(); }
      for (let k = 0; k < use.length; k += size) groups.push(use.slice(k, k + size));
      if (groups.length > 1 && groups[groups.length - 1].length < 2) groups[groups.length - 2].push(...groups.pop());
      let g = 0;
      const board = s.kind === "memory" ? memoryBoard : s.kind === "cloze" ? clozeBoard : pairsBoard;
      const next = () => {
        if (g >= groups.length) { if (!rest.length) return finish(); s.kind = "meaning"; pool.splice(0, pool.length, ...rest); i = 0; total = rest.length; return ask(); }
        bar.style.setProperty("--p", (g / groups.length) * 100 + "%"); stat.textContent = `${g + 1}/${groups.length}`; board(groups[g++], next);
      };
      next();
      return;
    }
    if (false) {
      const size = kid ? 3 : 4, groups = [];
      for (let k = 0; k < uniq.length; k += size) groups.push(uniq.slice(k, k + size));
      if (groups.length > 1 && groups[groups.length - 1].length < 2) groups[groups.length - 2].push(...groups.pop());
      let g = 0;
      const next = () => { if (g >= groups.length) return finish(); bar.style.setProperty("--p", (g / groups.length) * 100 + "%"); stat.textContent = `${g + 1}/${groups.length}`; pairsBoard(groups[g++], next); };
      next();
      return;
    }
    // Word hunt: words that fit a grid go in it; anything else gets a normal question afterward
    // phones get a smaller grid so every letter stays easy to tap
    const narrow = innerWidth < 560, short = innerHeight < 700, max = kid || (narrow && short) ? 8 : narrow ? 9 : 11;
    const fit = uniq.filter((w) => /^[a-z]+$/i.test(w.w) && w.w.length >= 3 && w.w.length <= max).slice(0, 8);
    const rest = uniq.filter((w) => !fit.includes(w));
    if (fit.length < 3) { s.kind = "meaning"; pool.splice(0, pool.length, ...uniq); total = pool.length; return ask(); }
    wordSearch(fit, () => {
      if (!rest.length) return finish();
      s.kind = "meaning"; pool.splice(0, pool.length, ...rest); i = 0; total = rest.length; ask();
    });
  }
  const gradeWord = (w, ok, ms = 5000, kind = "", hinted = false) => {
    results.push({ w: w.w, ok }); if (ok) { right++; run++; best = Math.max(best, run); } else { wrongs++; run = 0; }
    if (s.grade) model.grade(p.id, w.w, srs.gradeFor(ok, ms, hinted, kind, slow));
    model.markActive(p.id);
  };
  function pairsBoard(words, done2) {
    const t0b = Date.now(), missed = new Set(), left = h("div", { class: "pcol" }), rightCol = h("div", { class: "pcol" });
    let sel = null, matched = 0;
    const card = h("div", { class: "qcard" }, h("span", { class: "qkind" }, "Match the pairs"), h("p", { class: "qd muted" }, "Tap a word, then its meaning."));
    const board = h("div", { class: "pairs" }, left, rightCol);
    const tryMatch = (a, b) => {
      const wa = a.dataset.w, wb = b.dataset.w;
      if (wa === wb) {
        [a, b].forEach((x) => { x.classList.remove("sel"); x.classList.add("done"); x.disabled = true; });
        play("right"); buzz(10); burst(b, ["#F2B544", "#7CC6CE", "#FFFFFF"]); matched++;
        // the last pair is a giveaway, so it isn't graded
        const w = words.find((x) => x.w === wa); if (matched < words.length || words.length === 1) gradeWord(w, !missed.has(wa), (Date.now() - t0b) / words.length, "meaning");
        if (matched === words.length) setTimeout(done2, 650);
      } else {
        // the miss belongs to the word you were matching, not the meaning you tapped by mistake
        const wordEl = a.classList.contains("pcw") ? a : b; missed.add(wordEl.dataset.w); play("wrong"); buzz([20, 40, 20]);
        [a, b].forEach((x) => { x.classList.remove("sel"); x.classList.add("nope"); setTimeout(() => x.classList.remove("nope"), 450); });
      }
      sel = null;
    };
    const pick = (el) => {
      if (el.disabled) return;
      if (!sel) { sel = el; el.classList.add("sel"); play("tap"); return; }
      if (sel === el) { el.classList.remove("sel"); sel = null; return; }
      if (sel.parentNode === el.parentNode) { sel.classList.remove("sel"); sel = el; el.classList.add("sel"); play("tap"); return; }
      tryMatch(sel, el);
    };
    shuffledCopy(words).forEach((w) => left.append(h("button", { type: "button", class: "pc pcw" + (w.w.length > 11 ? " long" : ""), "data-w": w.w, onclick: (e) => pick(e.currentTarget) }, w.w)));
    shuffledCopy(words).forEach((w) => rightCol.append(h("button", { type: "button", class: "pc pcd", "data-w": w.w, onclick: (e) => pick(e.currentTarget) }, w.d)));
    card.append(board);
    body.replaceChildren(card); foot.replaceChildren();
  }
  // Memory: cards face down, flip two at a time, find each word's meaning
  function memoryBoard(words, done2) {
    const cards = shuffledCopy(words.flatMap((w) => [{ w, side: "w" }, { w, side: "d" }]));
    const seen = new Set(), tries = new Map();
    let open = [], lock = false, matched = 0;
    const grid = h("div", { class: "memo", style: { "--c": cards.length > 6 ? 4 : 3 } });
    const els = cards.map((c, k) => {
      const el = h("button", { type: "button", class: "mcard", "aria-label": `Card ${k + 1}, face down`, onclick: () => flip(k) },
        h("span", { class: "mface mback", "aria-hidden": "true" }),
        h("span", { class: "mface mfront " + (c.side === "w" ? "isw serif" : "isd") }, c.side === "w" ? c.w.w : c.w.d));
      grid.append(el); return el;
    });
    const flip = (k) => {
      const el = els[k], c = cards[k];
      if (lock || el.classList.contains("up") || el.classList.contains("done")) return;
      el.classList.add("up"); el.setAttribute("aria-label", c.side === "w" ? c.w.w : c.w.d); play("tap");
      open.push(k);
      if (open.length < 2) return;
      const [a, b] = open.map((x) => cards[x]); const pair = [...open]; open = [];
      if (a.w.w === b.w.w && a.side !== b.side) {
        pair.forEach((x) => els[x].classList.add("done")); play("right"); buzz(10); burst(els[pair[1]], ["#F2B544", "#7CC6CE", "#FFFFFF"]);
        matched++; const t = tries.get(a.w.w) || 0; gradeWord(a.w, t <= 1, 6000, "meaning");
        if (matched === words.length) setTimeout(done2, 800);
      } else {
        // a miss only counts against a word once you've already seen where its pair was
        [a, b].forEach((x) => { const key = x.w.w + x.side, other = x.w.w + (x.side === "w" ? "d" : "w"); if (seen.has(other)) tries.set(x.w.w, (tries.get(x.w.w) || 0) + 1); });
        lock = true; play("wrong");
        setTimeout(() => { pair.forEach((x) => { els[x].classList.remove("up"); els[x].setAttribute("aria-label", `Card ${x + 1}, face down`); }); lock = false; }, 1100);
      }
      [a, b].forEach((x) => seen.add(x.w.w + x.side));
    };
    const card = h("div", { class: "qcard wide" }, h("span", { class: "qkind" }, "Memory cards"), h("p", { class: "qd muted" }, "Flip two cards. Find each word and its meaning."), grid);
    body.replaceChildren(card); foot.replaceChildren();
  }
  // Fill the story: a few sentences with gaps; tap a word, then the gap it belongs in
  function clozeBoard(words, done2) {
    const t0b = Date.now();
    const lines = words.map((w) => ({ w, text: model.gapSentence(w) })).filter((x) => x.text);
    let sel = null;
    const placed = new Map(); // line index -> word
    const bank = h("div", { class: "bbank", role: "group", "aria-label": "Words" });
    const story = h("div", { class: "story" });
    const check = h("button", { class: "btn primary", type: "button", disabled: true, onclick: () => {
      lines.forEach((ln, k) => { const ok = placed.get(k) === ln.w.w; gaps[k].classList.add(ok ? "right" : "wrong"); if (!ok) gaps[k].textContent = ln.w.w; gradeWord(ln.w, ok, (Date.now() - t0b) / lines.length, "gap"); });
      story.querySelectorAll("button").forEach((b) => b.disabled = true); bank.querySelectorAll("button").forEach((b) => b.disabled = true); check.remove();
      const allOk = lines.every((ln, k) => placed.get(k) === ln.w.w);
      play(allOk ? "right" : "wrong");
      foot.replaceChildren(verdictBox(allOk, allOk ? oneOf(kid ? KID_PRAISE : PRAISE) : `${oneOf(OOPS)} The right words are in green.`, null),
        h("button", { class: "btn wide vgo", onclick: done2 }, "Continue"));
    } }, "Check");
    const refresh = () => {
      bank.querySelectorAll(".btile").forEach((b) => { const used = [...placed.values()].includes(b.dataset.w); b.classList.toggle("used", used); b.classList.toggle("sel", sel === b.dataset.w); });
      gaps.forEach((g, k) => { g.textContent = placed.get(k) || ""; g.classList.toggle("filled", placed.has(k)); });
      check.disabled = placed.size !== lines.length;
    };
    const gaps = lines.map((ln, k) => {
      const [a, b] = ln.text.split("_____");
      const g = h("button", { type: "button", class: "sgap", "aria-label": `Gap ${k + 1}`, onclick: () => {
        if (placed.has(k)) { placed.delete(k); play("tap"); refresh(); return; }
        if (!sel) return;
        placed.set(k, sel); sel = null; play("tap"); refresh();
      } });
      story.append(h("p", { class: "sline serif" }, a, g, b));
      return g;
    });
    shuffledCopy(lines).forEach((ln) => bank.append(h("button", { type: "button", class: "btile", "data-w": ln.w.w, onclick: (e) => {
      const w = e.currentTarget.dataset.w; if ([...placed.values()].includes(w)) return;
      // tap a word to pick it up, then tap the gap it belongs in
      const empty = gaps.findIndex((_, k) => !placed.has(k));
      if (sel === w || empty < 0) { sel = sel === w ? null : w; refresh(); return; }
      sel = w; refresh();
    } }, ln.w.w)));
    const card = h("div", { class: "qcard wide" }, h("span", { class: "qkind" }, "Word bank"), h("p", { class: "qd muted" }, "Tap a word, then the sentence it belongs in."), story, bank, h("div", { class: "actions" }, check));
    body.replaceChildren(card); foot.replaceChildren();
    refresh();
  }
  function wordSearch(words, done2) {
    const n = Math.max(kid || (innerWidth < 560 && innerHeight < 700) ? 8 : innerWidth < 560 ? 9 : 10, ...words.map((w) => w.w.length));
    const dirs = kid ? [[0, 1], [1, 0]] : [[0, 1], [1, 0], [1, 1]];
    let grid, placed;
    for (let attempt = 0; attempt < 60; attempt++) {
      grid = Array.from({ length: n }, () => Array(n).fill("")); placed = [];
      let okAll = true;
      for (const w of [...words].sort((a, b) => b.w.length - a.w.length)) {
        const t = w.w.toLowerCase(); let put = false;
        for (let tries = 0; tries < 200 && !put; tries++) {
          const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
          const r0 = Math.floor(Math.random() * (n - dr * (t.length - 1))), c0 = Math.floor(Math.random() * (n - dc * (t.length - 1)));
          if ([...t].every((ch, k) => { const v = grid[r0 + dr * k][c0 + dc * k]; return !v || v === ch; })) {
            [...t].forEach((ch, k) => { grid[r0 + dr * k][c0 + dc * k] = ch; });
            placed.push({ w, cells: [...t].map((_, k) => (r0 + dr * k) * n + c0 + dc * k) }); put = true;
          }
        }
        if (!put) { okAll = false; break; }
      }
      if (okAll) break;
    }
    const abc = "eeeaaaiioonnrrsstlcdmuhgpbfkwyv";
    grid.forEach((row) => row.forEach((v, k) => { if (!v) row[k] = abc[Math.floor(Math.random() * abc.length)]; }));
    const t0b = Date.now(), found = new Set(), hinted = new Set(), gaveUp = new Set();
    const cells = h("div", { class: "wsgrid", style: { "--n": n }, role: "grid", "aria-label": "Letter grid" });
    grid.flat().forEach((ch, k) => cells.append(h("span", { class: "wc", "data-k": k, role: "gridcell" }, ch)));
    const clues = h("ol", { class: "wsclues" }, placed.map((x) => h("li", { "data-w": x.w.w }, h("span", { class: "len" }, `${x.w.w.length} letters`), h("span", { class: "cd" }, x.w.d), h("strong", { class: "cw serif" }, x.w.w))));
    const status = h("p", { class: "muted small wsstatus", "aria-live": "polite" }, `Find ${placed.length} words. Drag across a word, or tap its first and last letter.`);
    // On phones the clues show one at a time, so the grid and its clue fit on one screen
    let cur = 0;
    const nowText = h("span", { class: "cd" }), nowLen = h("span", { class: "len" });
    const step = (d) => {
      const left = placed.map((x, k) => k).filter((k) => !found.has(placed[k].w.w));
      if (!left.length) { nowText.textContent = "All found!"; nowLen.textContent = ""; return; }
      let k = cur;
      for (let n = 0; n < placed.length; n++) { k = (k + d + placed.length) % placed.length; if (!found.has(placed[k].w.w)) break; }
      cur = d === 0 && !found.has(placed[cur].w.w) ? cur : k; paintNow();
    };
    const paintNow = () => { const x = placed[cur]; nowText.textContent = x.w.d; nowLen.textContent = `${x.w.w.length} letters, clue ${cur + 1} of ${placed.length}`; };
    const now = h("div", { class: "wsnow", "aria-live": "polite" },
      h("button", { type: "button", class: "iconbtn", "aria-label": "Previous clue", onclick: () => { play("tap"); step(-1); } }, icon("left", 20)),
      h("div", { class: "wsnowtext" }, nowText, nowLen),
      h("button", { type: "button", class: "iconbtn", "aria-label": "Next clue", onclick: () => { play("tap"); step(1); } }, icon("right", 20)));
    const phoneClues = () => getComputedStyle(now).display !== "none";
    let start = null, dragging = false;
    const cellAt = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.classList && el.classList.contains("wc") ? el : null; };
    const line = (a, b) => {
      const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
      const dr = Math.sign(rb - ra), dc = Math.sign(cb - ca), len = Math.max(Math.abs(rb - ra), Math.abs(cb - ca)) + 1;
      if (!(ra === rb || ca === cb || Math.abs(rb - ra) === Math.abs(cb - ca))) return null;
      return Array.from({ length: len }, (_, k) => (ra + dr * k) * n + ca + dc * k);
    };
    const show = (ks, cls) => { cells.querySelectorAll(".wc." + cls).forEach((c) => c.classList.remove(cls)); (ks || []).forEach((k) => cells.children[k].classList.add(cls)); };
    const tryLine = (ks) => {
      if (!ks) return false;
      const hit = placed.find((x) => !found.has(x.w.w) && (x.cells.join() === ks.join() || x.cells.join() === [...ks].reverse().join()));
      if (!hit) return false;
      found.add(hit.w.w); hit.cells.forEach((k) => cells.children[k].classList.add("found", "f" + (found.size % 5)));
      clues.querySelector(`[data-w="${hit.w.w}"]`).classList.add("got");
      play("right"); buzz(10); burst(cells.children[hit.cells[hit.cells.length - 1]], ["#F2B544", "#7CC6CE", "#FFFFFF"]);
      // a first-letter hint still counts as found; only "Show the rest" counts as a miss
      gradeWord(hit.w, !gaveUp.has(hit.w.w), (Date.now() - t0b) / placed.length, "word", hinted.has(hit.w.w));
      status.textContent = found.size === placed.length ? "All found!" : `${found.size} of ${placed.length} found`;
      if (placed[cur] === hit) step(1); else step(0);
      if (found.size === placed.length) { hintBtn.disabled = true; setTimeout(done2, 900); }
      return true;
    };
    cells.addEventListener("pointerdown", (e) => { const c = cellAt(e); if (!c) return; e.preventDefault(); dragging = true; const k = +c.dataset.k;
      if (start != null && start !== k) { const ok = tryLine(line(start, k)); if (!ok) play("wrong"); show(null, "sel"); start = null; dragging = false; return; }
      start = k; show([k], "sel"); });
    cells.addEventListener("pointermove", (e) => { if (!dragging || start == null) return; const c = cellAt(e); if (c) show(line(start, +c.dataset.k), "sel"); });
    const up = (e) => { if (!dragging) return; dragging = false; const c = cellAt(e); if (!c || start == null) return; const k = +c.dataset.k;
      if (k === start) return; // a tap: wait for the second tap
      const ok = tryLine(line(start, k)); if (!ok) play("wrong"); show(null, "sel"); start = null; };
    addEventListener("pointerup", up);
    const hintBtn = h("button", { type: "button", class: "btn small", onclick: () => {
      const left2 = phoneClues() && !found.has(placed[cur].w.w) ? placed[cur] : placed.find((x) => !found.has(x.w.w) && !hinted.has(x.w.w)) || placed.find((x) => !found.has(x.w.w));
      if (!left2) return; hinted.add(left2.w.w); cells.children[left2.cells[0]].classList.add("hintc"); play("tap");
    } }, icon("star", 18), "First letter");
    const giveUp = h("button", { type: "button", class: "btn small quiet", onclick: () => {
      placed.filter((x) => !found.has(x.w.w)).forEach((x) => { gaveUp.add(x.w.w); tryLine(x.cells); });
    } }, "Show the rest");
    const card = h("div", { class: "qcard wide" }, h("span", { class: "qkind" }, "Word hunt"), status, now, cells, h("div", { class: "actions wsacts" }, hintBtn, giveUp), clues);
    paintNow();
    body.replaceChildren(card); foot.replaceChildren();
    stat.textContent = ""; bar.style.setProperty("--p", "0%");
    addEventListener("hashchange", () => removeEventListener("pointerup", up), { once: true });
  }
  const shuffledCopy = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  function streakCall(n) {
    if (reduced()) return;
    const el = h("div", { class: "streakcall", "aria-hidden": "true" }, icon("flame", 22), STREAK[n]);
    page.append(el); play("unlock"); setTimeout(() => el.remove(), 1700);
  }

  function finish(stopped = false) {
    if (done) return; done = true;
    clearInterval(timer);
    const first = results.filter((r) => !r.retry), answered = first.length, acc = answered ? Math.round((right / answered) * 100) : 0;
    // a word passes if you got it, first time or on its second chance
    const passed = new Set(results.filter((r) => r.ok).map((r) => r.w)).size;
    const result = { right, wrong: wrongs, answered, acc, best, stopped, results, passed };
    if (stopped && !answered) { history.length > 1 ? history.back() : go(s.back); return; }
    if (s.onFinish) { const r = s.onFinish(result); if (r && r.redirect) return; }
    const good = (acc >= 70 || s.study) && !stopped;
    if (good) { play("done"); if (!s.study) confetti(); }
    const head = s.mode === "placement" ? s.placementTitle(result) : stopped ? "Good practice" : s.study ? (s.studyHead || "All done")
      : s.mode === "sprint" ? `${right} right in a minute` : endless ? `Best run: ${best}`
      : acc === 100 ? "Perfect" : acc >= 70 ? "Well done" : "Keep going";
    const tiles = s.study ? [] : [[String(right), "Right"], [acc + "%", "Accuracy"], s.mode === "sprint" ? [String(answered), "Answered"] : retried.size ? [`${passed}/${new Set(results.map((r) => r.w)).size}`, "Got in the end"] : [String(best), "Best streak"]];
    body.replaceChildren(h("div", { class: "endcard" },
      art(String(s.art).startsWith("src:") ? s.art.slice(4) : String(s.art).startsWith("keeper:") ? keeperArt(s.art.slice(7)) : artIcon(s.art), "", 160),
      h("h1", {}, head),
      s.endNote ? h("p", { class: "lead" }, s.endNote(result)) : null,
      tiles.length ? h("div", { class: "score" }, tiles.map(([b, t]) => h("div", {}, h("b", {}, b), h("span", {}, t)))) : null,
      results.length ? h("div", { class: "reviewlist" }, [...new Map(results.map((r) => [r.w, r])).values()].slice(0, 16).map((r) => {
        const w = model.lookup(r.w);
        const c = model.card(p.id, r.w) || {};
        const fav = h("button", { class: "iconbtn fav", "aria-label": `Favorite ${r.w}`, "aria-pressed": String(!!c.fav), onclick: () => toggleFav(fav, r.w) }, icon("heart", 20));
        const sv = h("button", { class: "iconbtn save", "aria-label": `Save ${r.w} to practice`, "aria-pressed": String(c.st === "learning"), onclick: () => toggleSave(sv, r.w) }, icon("bookmark", 20));
        return h("div", { class: "row-item" }, s.study ? h("span", { class: "rk dot", "aria-hidden": "true" }) : h("span", { class: r.ok ? "rk good" : "rk bad" }, icon(r.ok ? "check" : "x", 20)),
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
  if (BOARDS.has(s.kind) && !endless) runBoard(); else ask();
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
