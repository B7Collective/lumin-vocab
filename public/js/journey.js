// Lumin Vocab: Journey. The Lantern Road (one chapter a day, region by region) and side trails (themed, any pace).
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import { app, route, go } from "./app.js";
import { h, icon, toast, sheet, closeSheet, plural } from "./ui.js";
import { art, landmark, icon as artIcon, sceneUrl, SCENES, trailArt, keeperArt, keeperSrc, landFor, groundUrl, decorUrl, decorSize, decorMove } from "./art.js";
import { play } from "./sound.js";
import { start } from "./games.js";
import { countUp } from "./motion.js";
import { wordCard, details } from "./wordsheet.js";

const UNLOCK_KEY = "lumin-unlocked";
const STEP_KIND = { learn: "flash", meaning: "meaning", gap: "gap", spell: "unscramble", spellit: "spell", mix: "mixed", test: "mixed", usage: "usage", mixup: "mixup" };
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const svgEl = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);

// Everything about one stop: its words, name, line and steps
export function chapterInfo(p, ch, trailKey) {
  const chapters = trailKey ? model.trailChapters(trailKey, p) : model.chapterWords(p.level), c = chapters[ch];
  if (!c) return { words: [], count: chapters.length, steps: model.stepsFor(null, trailKey) };
  if (trailKey) {
    const t = model.trail(trailKey);
    return { words: c.words, img: null, name: `Marker ${ch + 1}`, line: t.blurb, count: chapters.length, steps: model.stepsFor(c, trailKey), trail: t };
  }
  const [img, name, line] = c.landmark;
  const lap = c.lookout ? 0 : Math.floor((chapters.slice(0, ch + 1).filter((x) => !x.lookout).length - 1) / model.LANDMARKS.length);
  return { words: c.words, lookout: c.lookout, img, name: lap ? `${name}, part ${lap + 1}` : name, line, count: chapters.length, steps: model.stepsFor(c) };
}
// Words from the road behind you, mixed into each keeper's riddle so earlier chapters keep mattering
function lookBack(p, ch, n) {
  const before = model.chapterWords(p.level).slice(Math.max(0, ch - 6), ch).flatMap((c) => c.words);
  return before.sort(() => Math.random() - 0.5).slice(0, n);
}
const lights = (p) => { const chs = model.chapterWords(p.level); return model.journeyState(p).log.reduce((n, e) => n + (chs[e.ch] && !chs[e.ch].lookout ? chs[e.ch].words.length : 0), 0); };
const back = (trailKey) => (trailKey ? `/journey/trail/${trailKey}` : "/journey");

function runStep(p, ch, stepIdx, trailKey) {
  const info = chapterInfo(p, ch, trailKey), step = info.steps[stepIdx];
  let words = [...info.words].sort(() => Math.random() - 0.5);
  if (step.key === "mix") words = words.concat([...info.words].sort(() => Math.random() - 0.5));
  if (step.key === "test" && !info.lookout && !trailKey) words = words.concat(lookBack(p, ch, 4)).sort(() => Math.random() - 0.5);
  const need = step.key === "test" ? Math.ceil(words.length * 0.8) : 0;
  const keeper = trailKey ? "trail marker" : model.regionOf(ch)[2];
  start({
    title: step.name, words, kind: STEP_KIND[step.key], art: step.key === "test" && !trailKey ? "src:" + keeperSrc(model.regionOf(ch)) : step.icon, back: back(trailKey), doneLabel: trailKey ? "Back to the trail" : "Back to the road", again: false,
    endNote: (r) => step.key === "test" && r.right < need ? (trailKey ? `Get ${need} of ${words.length} right to pass the marker. Try again whenever you like.` : `${keeper[0].toUpperCase() + keeper.slice(1)} needs ${need} of ${words.length} right before you pass. Try again whenever you're ready.`)
      : step.key === "learn" ? "These words will come back in Practice, just before you'd forget them." : null,
    onFinish: (r) => {
      if (r.stopped) return;
      if (step.key === "learn") info.words.forEach((w) => { const c = model.card(p.id, w.w); if (!c || c.st !== "learning") model.learn(p.id, w.w); });
      if (step.key === "test" && r.right < need) return;
      const stars = r.acc === 100 ? 3 : r.acc >= 80 ? 2 : 1;
      const before = model.journeyState(model.profile(p.id), trailKey);
      const after = model.advanceJourney(p.id, ch, stepIdx, stars, trailKey);
      if (after.ch > before.ch) { try { sessionStorage.setItem(UNLOCK_KEY, (trailKey || "") + ":" + after.ch); } catch {} }
    },
  });
}
// Practice any stop again: it counts toward Practice, never against the road
function replay(p, ch, trailKey, kind = "mixed") {
  const ci = chapterInfo(p, ch, trailKey);
  if (!ci.words.length) return;
  closeSheet();
  start({ title: kind === "flash" ? "Flip through" : "Replay", words: [...ci.words, ...ci.words].sort(() => Math.random() - 0.5).slice(0, Math.max(8, ci.words.length)), kind, art: kind === "flash" ? "flashcards" : "review", back: back(trailKey) });
}
function justUnlocked(trailKey, ch) { try { const v = sessionStorage.getItem(UNLOCK_KEY); if (v === (trailKey || "") + ":" + ch) { sessionStorage.removeItem(UNLOCK_KEY); return true; } } catch {} return false; }

// ---- Pieces --------------------------------------------------------------------
function regionBanner(p, ch, total) {
  const [scene, name, keeper, greeting, pic] = model.regionOf(ch), sc = SCENES.find((s) => s.id === scene) || SCENES[0];
  const regions = Math.ceil(total / model.REGION_SIZE), r = Math.floor(ch / model.REGION_SIZE);
  const inRegion = (ch % model.REGION_SIZE) + 1;
  return h("div", { class: "jregion" }, h("img", { src: sceneUrl(scene), alt: "", style: { objectPosition: `${sc.x}% 55%` }, decoding: "async" }),
    h("div", { class: "fireflies", "aria-hidden": "true" }, Array.from({ length: 9 }, (_, k) => h("i", { style: { "--x": `${6 + ((k * 41) % 88)}%`, "--y": `${18 + ((k * 23) % 60)}%`, "--d": `${5 + (k % 4)}s`, "--delay": `${-k * 0.9}s` } }))),
    h("div", { class: "jregion-text" }, h("span", {}, `Region ${r + 1} of ${regions}`), h("strong", {}, name),
      h("p", { class: "keeper" }, inRegion === 1 ? greeting : `Keeper: ${keeper}`),
      h("span", { class: "jregion-steps", "aria-label": `Stop ${inRegion} of ${model.REGION_SIZE} in this region` }, Array.from({ length: model.REGION_SIZE }, (_, k) => h("i", { class: k < inRegion - 1 ? "on" : k === inRegion - 1 ? "here" : "" })))),
    h("img", { class: "keeperpic" + (pic ? "" : " standin"), src: keeperSrc(model.regionOf(ch)), alt: "", width: 112, height: 112 }));
}
function lantern(n, days) {
  const glow = Math.min(1, 0.25 + n / 240);
  const num = h("b", {}, "0");
  const el = h("div", { class: "lantern", style: { "--glow": String(glow) } },
    h("div", { class: "lamp", "aria-hidden": "true" }, h("i", { class: "halo" }), h("img", { src: keeperArt("lantern"), alt: "", width: 72, height: 72 })),
    h("div", { class: "ltext" }, h("span", { class: "big" }, num, n === 1 ? " light" : " lights"), h("span", { class: "muted small" }, n ? `in your lantern${days ? `, over ${plural(days, "day")}` : ""}` : "Each word you learn lights your lantern")));
  countUp(num, n, 1200);
  return el;
}
// The path for one stop: its steps along a curve, ending at the landmark
// The ground of a region, faded in behind its path
function ground(land) { return h("div", { class: "ground", "aria-hidden": "true", style: { "--ground": `url(${groundUrl(land.ground)})` } }); }
// One thing beside the path: a picture with a soft shadow, and its own small movement
function decorPiece(name, k, flip) {
  const move = decorMove(name);
  return h("i", { class: "dc" + (move ? " " + move : ""), style: { "--i": k, "--sz": decorSize(name) + "px" } }, h("img", { src: decorUrl(name), alt: "", width: decorSize(name), height: decorSize(name), loading: "lazy", decoding: "async", class: flip ? "flip" : null }));
}
function stepMap(p, st, info, trailKey) {
  const land = landFor(trailKey || model.regionOf(st.ch)[0], !!trailKey);
  const map = h("div", { class: "jmap land" }, ground(land));
  const decor = h("div", { class: "decor", "aria-hidden": "true" });
  const trail = svgEl("svg"); trail.setAttribute("class", "trail"); trail.setAttribute("aria-hidden", "true");
  map.append(decor, trail);
  const nodes = info.steps.map((step, k) => {
    const state = k < st.step ? "done" : k === st.step ? "current" : "locked";
    const b = h("button", { class: "jnode " + state, style: { "--i": k }, "aria-label": `${step.name}${state === "done" ? ", done, play again" : state === "locked" ? ", locked" : ", start"}`, onclick: () => {
      if (state === "locked") { toast("Finish the step before this one first"); b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge"); return; }
      play("tap"); runStep(p, st.ch, k, trailKey);
    } },
      state === "current" ? h("span", { class: "jstart" }, st.step === 0 && st.ch === 0 ? "Start here" : "Next") : null,
      h("span", { class: "disc" }, h("img", { src: step.key === "test" && !trailKey && !info.lookout ? keeperSrc(model.regionOf(st.ch)) : artIcon(step.icon), alt: "", width: 96, height: 96 })),
      state === "done" ? h("span", { class: "stamp" }, icon("check")) : null,
      h("span", { class: "nm" }, step.name), state === "current" ? h("span", { class: "nl" }, step.line) : null);
    map.append(b);
    return b;
  });
  const goalImg = trailKey ? trailArt(trailKey) : landmark(info.img);
  const goal = h("div", { class: "jland locked" }, h("img", { src: goalImg, alt: "", width: 220, height: 220 }),
    h("div", { class: "plaque" }, h("strong", {}, trailKey ? `Marker ${st.ch + 1} of ${info.count}` : info.lookout ? "The campfire" : info.name),
      h("span", { class: "muted" }, trailKey ? "Pass the marker to walk on. No waiting on trails." : info.lookout ? "Pass the lookout check to walk on" : `Answer the keeper's riddle to reach it. A keepsake waits there.`)));
  map.append(goal);
  // Things beside the path, chosen per stop so each stop looks a little different but stays the same on every visit
  const pieces = land.decor, start = (st.ch * 5) % pieces.length;
  const placed = [...nodes.map((_, k) => pieces[(start + k) % pieces.length]), pieces[(start + 2) % pieces.length], pieces[(start + 4) % pieces.length]]
    .map((name, k) => { const d = decorPiece(name, k, (st.ch + k) % 3 === 1); decor.append(d); return d; });
  const layout = () => {
    if (!document.body.contains(map)) { removeEventListener("resize", layout); return; }
    const amp = Math.min(110, map.clientWidth * 0.24), wave = [0, 0.75, 1, 0.35, -0.55, -0.95];
    nodes.forEach((n, k) => n.style.setProperty("--dx", Math.round(wave[k % wave.length] * amp) + "px"));
    const box = map.getBoundingClientRect();
    const pts = [...nodes.map((n) => n.querySelector(".disc")), goal.querySelector("img")].map((d) => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
    const d = (list) => list.map((pt, k) => k ? `Q ${list[k - 1][0]} ${(list[k - 1][1] + pt[1]) / 2} ${(list[k - 1][0] + pt[0]) / 2} ${(list[k - 1][1] + pt[1]) / 2} T ${pt[0]} ${pt[1]}` : `M ${pt[0]} ${pt[1]}`).join(" ");
    trail.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    trail.replaceChildren();
    // a soft road under the dotted trail, coming in from above the first step
    const road = [[box.width / 2, 34], ...pts];
    for (const cls of ["roadedge", "road"]) { const r = svgEl("path"); r.setAttribute("d", d(road)); r.setAttribute("class", cls); trail.append(r); }
    const all = svgEl("path"); all.setAttribute("d", d(pts)); trail.append(all);
    // decor sits on the side away from each step, inside the edges; two more flank the landmark
    const W = box.width, small = W < 420 ? 0.82 : 1, reach = Math.min(W * 0.36, 190);
    placed.forEach((el, k) => {
      const sz = parseFloat(el.style.getPropertyValue("--sz")) * small;
      let x, y;
      if (k < nodes.length) {
        const dx = pts[k][0] - W / 2, side = Math.abs(dx) < 20 ? (k % 2 ? 1 : -1) : -Math.sign(dx);
        x = W / 2 + side * reach; y = pts[k][1] + 6 + ((k * 13) % 22);
      } else {
        const g = goal.querySelector("img").getBoundingClientRect(), side = k === nodes.length ? -1 : 1;
        x = pts[pts.length - 1][0] + side * (g.width / 2 + sz * 0.15); y = pts[pts.length - 1][1] + g.height * 0.32;
      }
      x = Math.max(sz / 2 + 4, Math.min(W - sz / 2 - 4, x));
      el.style.setProperty("--w", sz + "px");
      el.style.left = Math.round(x - sz / 2) + "px"; el.style.top = Math.round(y - sz / 2) + "px";
    });
    if (st.step > 0) { const w = svgEl("path"); w.setAttribute("d", d(pts.slice(0, st.step + 1))); w.setAttribute("class", "walked"); trail.append(w); }
    // the traveler stands at the current step
    const here = pts[Math.min(st.step, pts.length - 1)];
    const t = svgEl("circle"); t.setAttribute("class", "traveler"); t.setAttribute("cx", here[0]); t.setAttribute("cy", here[1] - 58); t.setAttribute("r", "7"); trail.append(t);
  };
  requestAnimationFrame(layout);
  addEventListener("resize", layout);
  document.fonts && document.fonts.ready.then(layout);
  setTimeout(() => { const c = map.querySelector(".jnode.current"); if (c && c.getBoundingClientRect().top > innerHeight * 0.75) c.scrollIntoView({ block: "center", behavior: "smooth" }); }, 500);
  return map;
}
// A passport stamp for a finished stop
function stamp(p, e, trailKey, k = 0) {
  const ci = chapterInfo(p, e.ch, trailKey);
  const src = trailKey ? trailArt(trailKey) : landmark(ci.img || "summit");
  return h("button", { class: "pstamp", style: { "--rot": `${((e.ch * 37) % 13) - 6}deg`, "--i": k }, "aria-label": `${ci.lookout ? "Campfire" : ci.name}, ${dateFmt.format(new Date(e.at))}. Review or replay`, onclick: () => stopSheet(p, e.ch, trailKey) },
    h("span", { class: "ring" }, h("img", { src, alt: "", width: 72, height: 72, loading: "lazy" })),
    h("strong", {}, ci.lookout ? "Campfire" : ci.name), h("small", {}, dateFmt.format(new Date(e.at))),
    h("span", { class: "tstars", "aria-hidden": "true" }, [1, 2, 3].map((n) => { const s = icon("star", 12); if (n <= e.stars) s.classList.add("on"); return s; })));
}
// Look back at any stop: its words with save, favorite and list buttons, and ways to play it again
function stopSheet(p, ch, trailKey) {
  const ci = chapterInfo(p, ch, trailKey);
  if (!ci.words.length) return;
  const title = trailKey ? `${ci.trail.name}: marker ${ch + 1}` : ci.lookout ? `Stop ${ch + 1}: a campfire` : `Stop ${ch + 1}: ${ci.name}`;
  sheet(title, (b) => {
    b.append(
      !trailKey && !ci.lookout ? h("p", { class: "keepsake" }, icon("star", 18), `You found ${model.keepsakeOf(ch, p.level)} here.`) : null,
      h("div", { class: "actions" },
        h("button", { class: "btn primary", onclick: () => replay(p, ch, trailKey) }, icon("sync"), "Replay this stop"),
        h("button", { class: "btn", onclick: () => replay(p, ch, trailKey, "flash") }, "Flip through")),
      h("div", { class: "wlist" }, ci.words.map((w) => wordCard(w.w))));
  });
}
function passport(p, trailKey) {
  const st = model.journeyState(model.profile(p.id), trailKey);
  sheet(trailKey ? `${model.trail(trailKey).name}: your stamps` : "Your passport", (b) => {
    b.append(h("p", { class: "muted" }, trailKey ? `${plural(st.log.length, "marker")} passed.` : `${plural(st.log.length, "stop")} reached over ${plural(model.journeyDays(st), "day")}. Tap a stamp to look back or replay it.`),
      st.log.length ? h("div", { class: "passport" }, [...st.log].reverse().map((e, k) => stamp(p, e, trailKey, k))) : h("p", { class: "muted" }, "Your first stamp comes with your first landmark."));
  });
}
function celebrate(p, ch, trailKey) {
  const done = chapterInfo(p, ch, trailKey), st = model.journeyState(model.profile(p.id), trailKey);
  const newRegion = !trailKey && st.ch % model.REGION_SIZE === 0;
  play("unlock");
  import("./games.js").then((g) => g.confetti());
  const finished = trailKey && st.ch >= done.count;
  sheet(finished ? "Trail complete" : trailKey ? "Marker passed" : newRegion ? "A new region" : done.lookout ? "Campfire stories told" : "Landmark reached", (b) => {
    b.append(h("div", { class: "stack celebrate" },
      art(trailKey ? trailArt(trailKey) : newRegion ? keeperSrc(model.regionOf(st.ch)) : landmark(done.img), "", 200),
      h("p", { class: "lead" }, finished ? `You walked all of ${done.trail.name}. Its words are in your practice now.`
        : trailKey ? `On to marker ${st.ch + 1}. Trails never make you wait, so keep going if you like.`
        : newRegion ? `You crossed into ${model.regionOf(st.ch)[1]}. ${model.regionOf(st.ch)[3]}`
        : done.lookout ? "You told the road's stories by the fire and kept your words. The next stretch opens tomorrow."
        : `You reached ${done.name} and found ${model.keepsakeOf(ch, p.level)}. It's in your passport. The road opens again tomorrow.`),
      h("button", { class: "btn primary", onclick: () => closeSheet() }, trailKey ? "Onward" : "Make camp")));
  });
}
function trailCards(p) {
  const list = model.trailsFor(p);
  if (!list.length) return null;
  // Trails you've started come first; the rest wait behind "Show all"
  const started = (t) => model.journeyState(p, t.key).ch > 0 || model.journeyState(p, t.key).step > 0;
  const ordered = [...list.filter(started), ...list.filter((t) => !started(t))];
  const grid = h("div", { class: "cards" }, ordered.map((t, k) => {
      const st = model.journeyState(p, t.key), n = model.trailChapters(t.key, p).length, done = Math.min(st.ch, n);
      return h("a", { class: "gcard trail", href: `#/journey/trail/${t.key}` }, art(trailArt(t.key), "", 240), h("strong", {}, t.name),
        h("small", {}, done >= n ? "Complete" : done ? `Marker ${done + 1} of ${n}` : `${n} markers`),
        h("span", { class: "tprog", "aria-hidden": "true" }, h("i", { style: { "--p": `${(done / n) * 100}%` } })));
    }));
  const SHOW = 6;
  [...grid.children].forEach((c, k) => { if (k >= SHOW) c.hidden = true; });
  const more = ordered.length > SHOW ? h("button", { class: "btn start", onclick: () => { [...grid.children].forEach((c, k) => { c.hidden = false; if (k >= SHOW) { c.style.setProperty("--i", String(k - SHOW)); c.classList.add("rise"); } }); more.remove(); } }, `Show all ${ordered.length} trails`) : null;
  return h("section", { class: "sec trails" }, h("h2", {}, "Side trails"), h("p", {}, "Short themed walks. No waiting, any order, and they're separate from the main road."), grid, more);
}

// ---- The Lantern Road ------------------------------------------------------------------
route("journey", (main, args) => {
  if (args[0] === "trail" && args[1]) return trailPage(main, args[1]);
  const p = app.profile, st = model.journeyState(p), level = model.LEVELS[p.level];
  const info = chapterInfo(p, st.ch);
  const page = h("div", { class: "journey" });
  main.append(page);
  if (!info.words.length) {
    page.append(h("div", { class: "jtop" }, art(landmark("castle"), "", 200), h("h1", {}, "You walked the whole road"),
      h("p", { class: "lead" }, `All ${info.count} stops of ${level.name}, over ${plural(model.journeyDays(st), "day")}. Your lantern is full. Keep your words fresh in Practice, try a side trail, or start the next level's road from You.`),
      h("div", { class: "actions center-x" }, h("a", { class: "btn primary", href: "#/practice" }, "Practice"), h("button", { class: "btn", onclick: () => passport(p) }, "Your passport"))), trailCards(p));
    return;
  }
  const unlocked = justUnlocked("", st.ch);
  const open = model.journeyOpen(st);
  const days = model.journeyDays(st);

  page.append(regionBanner(p, st.ch, info.count), lantern(lights(p), days));
  const pct = Math.round((st.step / info.steps.length) * 100);
  const barFill = h("i", {});
  page.append(h("div", { class: "jtop" },
    h("span", { class: "eyebrow" }, `${level.name} road, stop ${st.ch + 1} of ${info.count}`),
    h("h1", {}, info.lookout ? "A Campfire" : info.name),
    h("p", { class: "jline" }, info.line),
    open ? h("div", { class: "jbar", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Stop progress" }, barFill) : null,
    h("div", { class: "jwords", "aria-label": info.lookout ? "Words to look back on" : "Words at this stop" }, info.words.map((w, k) => h("button", { style: { "--i": k }, onclick: () => details(w.w) }, w.w)))));
  requestAnimationFrame(() => requestAnimationFrame(() => barFill.style.setProperty("--p", pct + "%")));

  if (!open) {
    const prev = chapterInfo(p, st.ch - 1), due = model.due(p.id).length;
    const land = landFor(model.regionOf(st.ch)[0]), dl = land.decor;
    page.append(h("section", { class: "camp land" }, ground(land),
      h("div", { class: "decor", "aria-hidden": "true" }, decorPiece(dl[st.ch % dl.length], 0), decorPiece(dl[(st.ch + 3) % dl.length], 1, true)),
      h("div", { class: "campfire", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
      h("h2", {}, "Camp for tonight"),
      h("p", {}, `You reached ${prev.lookout ? "the campfire" : prev.name}. The road to ${info.lookout ? "the next campfire" : info.name} opens tomorrow.`),
      h("p", { class: "muted" }, due ? `Meanwhile, ${plural(due, "word")} from the road ${due === 1 ? "wants" : "want"} a review. Or try a side trail.` : "Meanwhile, side trails are open, and practice keeps your lights bright."),
      h("div", { class: "actions center-x" }, h("a", { class: "btn primary", href: "#/practice" }, due ? "Review now" : "Practice"), h("button", { class: "btn", onclick: () => stopSheet(p, st.ch - 1) }, "Look back at today"))));
  } else page.append(stepMap(p, st, info));

  if (st.log.length) {
    page.append(h("section", { class: "sec behind" }, h("div", { class: "split" }, h("h2", {}, "Behind you"), h("button", { class: "linkbtn", onclick: () => passport(p) }, "Open your passport")),
      h("div", { class: "pstrip" }, [...st.log].reverse().slice(0, 10).map((e, k) => stamp(p, e, null, k)))));
  }
  const tc = trailCards(p); if (tc) page.append(tc);
  if (unlocked && st.ch > 0) celebrate(p, st.ch - 1);
});

// ---- A side trail ------------------------------------------------------------------
function trailPage(main, key) {
  const p = app.profile, t = model.trail(key);
  if (!t || !model.trailsFor(p).some((x) => x.key === key)) { go("/journey"); return; }
  const st = model.journeyState(p, key), info = chapterInfo(p, st.ch, key);
  const page = h("div", { class: "journey" });
  main.append(page);
  page.append(h("a", { class: "back", href: "#/journey" }, icon("left"), "The road"),
    h("div", { class: "trailhead" }, art(trailArt(key), "", 120), h("div", {}, h("span", { class: "eyebrow" }, "Side trail"), h("h1", {}, t.name), h("p", { class: "jline" }, t.blurb),
      h("div", { class: "actions" }, h("button", { class: "btn small", onclick: () => { model.saveProfile({ ...model.profile(p.id), feedSet: key, feedTopic: null }); go("/words"); } }, icon("grid"), "Browse these words"),
        st.log.length ? h("button", { class: "linkbtn", onclick: () => passport(p, key) }, "Your stamps") : null))));
  const chapters = model.trailChapters(key, p);
  // markers along the top: done ones replay, the current one is highlighted
  page.append(h("div", { class: "markers", role: "list", "aria-label": "Markers" }, chapters.map((c, k) => h("button", { role: "listitem", class: "marker " + (k < st.ch ? "done" : k === st.ch ? "current" : "locked"), "aria-label": `Marker ${k + 1}${k < st.ch ? ", passed. Review or replay" : k === st.ch ? ", you are here" : ", ahead"}`,
    onclick: () => { if (k < st.ch) stopSheet(p, k, key); else if (k > st.ch) toast("Pass the markers before this one first"); } }, k < st.ch ? icon("check", 16) : String(k + 1)))));
  if (!info.words.length) {
    page.append(h("div", { class: "jtop" }, h("h2", {}, "Trail complete"), h("p", { class: "lead" }, "Every marker passed. Replay any of them from the markers above."),
      h("div", { class: "actions center-x" }, h("a", { class: "btn primary", href: "#/journey" }, "More trails"))));
    if (justUnlocked(key, st.ch)) celebrate(p, st.ch - 1, key);
    return;
  }
  page.append(h("div", { class: "jtop" }, h("div", { class: "jwords" }, info.words.map((w, k) => h("button", { style: { "--i": k }, onclick: () => details(w.w) }, w.w)))), stepMap(p, st, info, key));
  if (justUnlocked(key, st.ch) && st.ch > 0) celebrate(p, st.ch - 1, key);
}
