// Lumin Vocab: Practice. Today's review first, then games and challenges.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import { app, route, go } from "./app.js";
import { h, icon, untilText, plural, toast, canSpeak } from "./ui.js";
import { art, icon as artIcon } from "./art.js";
import { start, MODES } from "./games.js";

const GAMES = [
  { kind: "flash", name: "Flash cards", about: "Flip, then say if you knew it", art: "flashcards" },
  { kind: "meaning", name: "What it means", about: "Match the word to its meaning", art: "match" },
  { kind: "gap", name: "Fill the gap", about: "Find the word that fits", art: "gap" },
  { kind: "spell", name: "Spelling", about: "Type the word from its meaning", art: "spelling" },
  { kind: "unscramble", name: "Unscramble", about: "Put the letters in order", art: "unscramble" },
  { kind: "truefalse", name: "True or false", about: "Quick calls on what words mean", art: "perfect" },
  { kind: "synonym", name: "Find its twin", about: "Pick the word closest in meaning", art: "senses", grown: true },
  { kind: "usage", name: "Spot the right use", about: "Only one sentence gets it right", art: "talk", grown: true },
  { kind: "listen", name: "Listen closely", about: "Hear it, then find it", art: "senses" },
  { kind: "mixed", name: "Game shuffle", about: "A bit of everything", art: "shuffle" },
];

route("practice", (main) => {
  const p = app.profile, kid = model.isKid(p);
  const due = model.due(p.id), learning = model.stats(p.id).learning + model.stats(p.id).mastered;
  const page = h("div", { class: "hub" });
  main.append(page);
  page.append(h("div", { class: "phead" }, h("div", {}, h("h1", {}, "Practice"), h("p", {}, "Short games that make words stick."))));

  // Today's review
  let feature;
  if (due.length) {
    const words = due.slice(0, p.reviewSize || 20).map((c) => model.lookup(c.w)).filter(Boolean);
    feature = [h("h2", {}, `${plural(words.length, "word")} ready to review`), h("p", {}, "A few minutes now keeps them for good."),
      h("button", { class: "btn primary start", onclick: () => start({ title: "Today's review", words, kind: "mixed", art: "review" }) }, "Start review")];
  } else if (learning) {
    const nd = model.nextDue(p.id);
    feature = [h("h2", {}, "You're all caught up"), h("p", {}, nd ? `Your next review is ${untilText(nd)}. Want to warm up anyway?` : "Nothing is due right now."),
      h("button", { class: "btn start", onclick: () => start({ title: "Warm up", words: model.practicePool(p, 10), kind: "mixed", art: "review" }) }, "Practice anyway")];
  } else {
    feature = [h("h2", {}, "Your review lives here"), h("p", {}, "Save words with the bookmark, or walk a Journey chapter. They'll come back here just before you'd forget them."),
      h("a", { class: "btn primary start", href: "#/journey" }, "Start the Journey")];
  }
  page.append(h("section", { class: "feature" }, h("div", { class: "stack" }, ...feature), art(artIcon("review"), "", 132)));

  const pool = () => model.practicePool(p, 10);
  // Single-kind games pick words that suit them (a twin to find, sentences to compare)
  const poolFor = (kind) => () => ["synonym", "usage"].includes(kind) ? model.practicePool(p, 60).filter((w) => model.canAsk(w, kind, kid)).slice(0, 10) : pool();
  page.append(h("section", { class: "sec" }, h("h2", {}, "Games"), h("p", {}, "Uses the words you're learning, then your Journey words."),
    h("div", { class: "cards" }, GAMES.filter((g) => !(g.grown && kid) && (g.kind !== "listen" || canSpeak())).map((g) => h("button", { class: "gcard", onclick: () => start({ title: g.name, words: poolFor(g.kind)(), refill: poolFor(g.kind), kind: kid && g.kind === "spell" ? "unscramble" : g.kind, art: g.art }) },
      art(artIcon(g.art), "", 240), h("strong", {}, g.name), h("small", {}, g.about))))));

  const big = () => model.practicePool(p, 40);
  page.append(h("section", { class: "sec" }, h("h2", {}, "Challenges"),
    h("div", { class: "cards" }, Object.entries(MODES).map(([mode, m]) => h("button", { class: "gcard", onclick: () => start({ title: m.name, words: big(), refill: big, kind: "mixed", mode, art: m.art }) },
      art(artIcon(m.art), "", 240), h("strong", {}, m.name), h("small", {}, m.about))))));

  page.append(h("section", { class: "feature" }, h("div", { class: "stack" },
    h("h2", {}, "Find your level"), h("p", {}, `${kid ? "Six" : "Twelve"} quick questions, from easy to hard. We'll suggest the level that fits.`),
    h("button", { class: "btn start", onclick: () => placement(p) }, "Take the level check")), art(artIcon("leveltest"), "", 132)));
});

function placement(p) {
  const kid = p.role === "kid", top = kid ? 2 : model.MAX_LEVEL; // grown-up words stay with teens and adults
  const words = model.placementWords(top);
  const levelOf = (r) => {
    const byLevel = model.LEVELS.map(() => 0);
    r.results.forEach((x) => { const w = model.lookup(x.w); if (x.ok && w) byLevel[w.l]++; });
    let lv = 0; for (let l = 0; l <= top; l++) { if (byLevel[l] >= 2) lv = l; else break; }
    return lv;
  };
  start({
    title: "Level check", words, kind: "meaning", mode: "placement", grade: false, art: "leveltest", again: false,
    placementTitle: (r) => { const n = model.LEVELS[levelOf(r)].name; return `You're ${/^[AEIOU]/.test(n) ? "an" : "a"} ${n}`; },
    endNote: (r) => { const lv = levelOf(r); return lv === p.level ? "That's the level you're on now. Nice fit." : `${model.LEVELS[lv].ages}. You're on ${model.LEVELS[p.level].name} now.`; },
    extra: (r) => { const lv = levelOf(r); return lv === p.level ? null : { label: `Switch to ${model.LEVELS[lv].name}`, fn: () => { model.saveProfile({ ...model.profile(p.id), level: lv }); toast(`You're on ${model.LEVELS[lv].name} now`); go("/journey"); } }; },
  });
}
