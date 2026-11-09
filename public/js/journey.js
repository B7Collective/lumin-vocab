// Lumin Vocab: Journey. A long walk through regions, one chapter a day, each step a short game.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import { app, route, go } from "./app.js";
import { h, icon, toast, sheet, closeSheet, untilText, plural } from "./ui.js";
import { art, landmark, icon as artIcon, sceneUrl, SCENES } from "./art.js";
import { play } from "./sound.js";
import { start } from "./games.js";
import { countUp } from "./motion.js";

const UNLOCK_KEY = "lumin-unlocked";
const STEP_KIND = { learn: "flash", meaning: "meaning", gap: "gap", spell: "unscramble", mix: "mixed", test: "mixed" };
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function chapterInfo(level, ch) {
  const chapters = model.chapterWords(level), c = chapters[ch];
  if (!c) return { words: [], count: chapters.length, steps: model.STEPS };
  const [img, name, line] = c.landmark;
  const lap = c.lookout ? 0 : Math.floor(chapters.slice(0, ch + 1).filter((x) => !x.lookout).length - 1) / model.LANDMARKS.length | 0;
  return { words: c.words, lookout: c.lookout, img, name: lap ? `${name}, part ${lap + 1}` : name, line, count: chapters.length, steps: model.stepsFor(c) };
}
// Words from the road behind you, mixed into each chapter check so earlier chapters keep mattering
function lookBack(level, ch, n) {
  const before = model.chapterWords(level).slice(Math.max(0, ch - 6), ch).flatMap((c) => c.words);
  return before.sort(() => Math.random() - 0.5).slice(0, n);
}

function runStep(p, ch, stepIdx) {
  const info = chapterInfo(p.level, ch), step = info.steps[stepIdx];
  let words = [...info.words].sort(() => Math.random() - 0.5);
  if (step.key === "mix") words = words.concat([...info.words].sort(() => Math.random() - 0.5));
  if (step.key === "test" && !info.lookout) words = words.concat(lookBack(p.level, ch, 4)).sort(() => Math.random() - 0.5);
  const need = step.key === "test" ? Math.ceil(words.length * 0.8) : 0;
  start({
    title: step.name, words, kind: STEP_KIND[step.key], art: step.icon, back: "/journey", doneLabel: "Back to the map", again: false,
    endNote: (r) => step.key === "test" && r.right < need ? `Get ${need} of ${words.length} right to finish. Try again whenever you're ready.` : step.key === "learn" ? "These words will come back in Practice, just before you'd forget them." : null,
    onFinish: (r) => {
      if (r.stopped) return;
      if (step.key === "learn") info.words.forEach((w) => { const c = model.card(p.id, w.w); if (!c || c.st !== "learning") model.learn(p.id, w.w); });
      if (step.key === "test" && r.right < need) return;
      const stars = r.acc === 100 ? 3 : r.acc >= 80 ? 2 : 1;
      const before = model.journeyState(model.profile(p.id));
      const after = model.advanceJourney(p.id, ch, stepIdx, stars);
      if (after.ch > before.ch) { try { sessionStorage.setItem(UNLOCK_KEY, String(after.ch)); } catch {} }
    },
  });
}

function regionBanner(ch, total) {
  const [scene, name] = model.regionOf(ch), sc = SCENES.find((s) => s.id === scene) || SCENES[0];
  const regions = Math.ceil(total / model.REGION_SIZE), r = Math.floor(ch / model.REGION_SIZE);
  const inRegion = (ch % model.REGION_SIZE) + 1;
  return h("div", { class: "jregion" }, h("img", { src: sceneUrl(scene), alt: "", style: { objectPosition: `${sc.x}% 55%` }, decoding: "async" }),
    h("div", { class: "jregion-text" }, h("span", {}, `Region ${r + 1} of ${regions}`), h("strong", {}, name),
      h("span", { class: "jregion-steps", "aria-label": `Stop ${inRegion} of ${model.REGION_SIZE} in this region` }, Array.from({ length: model.REGION_SIZE }, (_, k) => h("i", { class: k < inRegion - 1 ? "on" : k === inRegion - 1 ? "here" : "" })))));
}

route("journey", (main) => {
  const p = app.profile, st = model.journeyState(p), level = model.LEVELS[p.level];
  const info = chapterInfo(p.level, st.ch);
  const page = h("div", { class: "journey" });
  main.append(page);
  if (!info.words.length) {
    page.append(h("div", { class: "jtop" }, art(landmark("castle"), "", 200), h("h1", {}, "You walked the whole road"),
      h("p", { class: "lead" }, `All ${info.count} stops of ${level.name}, over ${plural(model.journeyDays(st), "day")}. Keep your words fresh in Practice, or start the next level's journey from You.`),
      h("div", { class: "actions center-x" }, h("a", { class: "btn primary", href: "#/practice" }, "Practice"), h("button", { class: "btn", onclick: () => travelLog(p) }, "Travel log"))));
    return;
  }
  let justUnlocked = false; try { justUnlocked = sessionStorage.getItem(UNLOCK_KEY) === String(st.ch); sessionStorage.removeItem(UNLOCK_KEY); } catch {}
  const open = model.journeyOpen(st);
  const days = model.journeyDays(st);

  page.append(regionBanner(st.ch, info.count));
  const pct = Math.round((st.step / info.steps.length) * 100);
  const barFill = h("i", {});
  const dayNum = h("b", {}, "0");
  page.append(h("div", { class: "jtop" },
    h("span", { class: "eyebrow" }, days ? h("span", {}, "Day ", dayNum, " of your journey") : `${level.name}: your journey starts here`),
    h("h1", {}, info.lookout ? "A Lookout" : info.name),
    h("p", { class: "jline" }, info.line),
    open ? h("div", { class: "jbar", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Chapter progress" }, barFill) : null,
    h("div", { class: "jwords", "aria-label": info.lookout ? "Words to look back on" : "Words in this chapter" }, info.words.map((w, k) => h("span", { style: { "--i": k } }, w.w))),
    h("div", { class: "actions center-x" }, h("span", { class: "muted small" }, `Stop ${st.ch + 1} of ${info.count}`), st.log.length ? h("button", { class: "linkbtn", onclick: () => travelLog(p) }, "Travel log") : null)));
  if (days) countUp(dayNum, days);
  requestAnimationFrame(() => requestAnimationFrame(() => barFill.style.setProperty("--p", pct + "%")));

  if (!open) {
    // Camp: today's walking is done
    const prev = chapterInfo(p.level, st.ch - 1), due = model.due(p.id).length;
    page.append(h("section", { class: "camp" },
      art(artIcon("streak"), "", 120),
      h("h2", {}, "Camp for tonight"),
      h("p", {}, `You reached ${prev.lookout ? "a lookout" : prev.name}. The road to ${info.lookout ? "the next lookout" : info.name} opens tomorrow.`),
      h("p", { class: "muted" }, due ? `Meanwhile, ${plural(due, "word")} from the road ${due === 1 ? "wants" : "want"} a review.` : "Meanwhile, practice keeps the words you've gathered fresh."),
      h("div", { class: "actions center-x" }, h("a", { class: "btn primary", href: "#/practice" }, due ? "Review now" : "Practice"), h("button", { class: "btn", onclick: () => revisit(p, st.ch - 1) }, "Revisit today's words"))));
    if (justUnlocked && st.ch > 0) celebrate(p, st.ch - 1);
    return;
  }

  // The path: today's steps, then the landmark you're walking toward
  const map = h("div", { class: "jmap" });
  const trail = document.createElementNS("http://www.w3.org/2000/svg", "svg"); trail.setAttribute("class", "trail"); trail.setAttribute("aria-hidden", "true");
  map.append(trail);
  const nodes = info.steps.map((step, k) => {
    const state = k < st.step ? "done" : k === st.step ? "current" : "locked";
    const stars = (st.stars || {})[`${st.ch}.${k}`];
    const b = h("button", { class: "jnode " + state, style: { "--i": k }, "aria-label": `${step.name}${state === "done" ? ", done" : state === "locked" ? ", locked" : ", start"}`, onclick: () => {
      if (state === "locked") { toast("Finish the step before this one first"); b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge"); return; }
      play("tap"); runStep(p, st.ch, k);
    } },
      state === "current" ? h("span", { class: "jstart" }, st.step === 0 && st.ch === 0 ? "Start here" : "Next") : null,
      h("span", { class: "disc" }, h("img", { src: artIcon(step.icon), alt: "", width: 96, height: 96 })),
      state === "done" ? h("span", { class: "stamp", title: stars ? `${stars} of 3 stars` : "" }, icon("check")) : null,
      h("span", { class: "nm" }, step.name));
    map.append(b);
    return b;
  });
  const goal = h("div", { class: "jland locked" }, h("img", { src: landmark(info.img), alt: "", width: 220, height: 220 }),
    h("strong", {}, info.lookout ? "The lookout" : info.name), h("span", { class: "muted" }, info.lookout ? "Pass the lookout check to walk on" : "Pass the chapter check to reach it. Tomorrow, the road goes on."));
  map.append(goal);
  page.append(map);

  // Lay the steps along a gentle curve and draw the trail between them
  const layout = () => {
    if (!document.body.contains(map)) { removeEventListener("resize", layout); return; }
    const amp = Math.min(110, map.clientWidth * 0.24), wave = [0, 0.75, 1, 0.35, -0.55, -0.95];
    nodes.forEach((n, k) => n.style.setProperty("--dx", Math.round(wave[k % wave.length] * amp) + "px"));
    const box = map.getBoundingClientRect();
    const pts = [...nodes.map((n) => n.querySelector(".disc")), goal.querySelector("img")].map((d) => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
    const d = (list) => list.map((pt, k) => k ? `Q ${list[k - 1][0]} ${(list[k - 1][1] + pt[1]) / 2} ${(list[k - 1][0] + pt[0]) / 2} ${(list[k - 1][1] + pt[1]) / 2} T ${pt[0]} ${pt[1]}` : `M ${pt[0]} ${pt[1]}`).join(" ");
    trail.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    trail.innerHTML = "";
    const all = document.createElementNS("http://www.w3.org/2000/svg", "path"); all.setAttribute("d", d(pts)); trail.append(all);
    if (st.step > 0) { const w = document.createElementNS("http://www.w3.org/2000/svg", "path"); w.setAttribute("d", d(pts.slice(0, st.step + 1))); w.setAttribute("class", "walked"); trail.append(w); }
  };
  requestAnimationFrame(layout);
  addEventListener("resize", layout);
  document.fonts && document.fonts.ready.then(layout);
  setTimeout(() => { const c = map.querySelector(".jnode.current"); if (c && c.getBoundingClientRect().top > innerHeight * 0.75) c.scrollIntoView({ block: "center", behavior: "smooth" }); }, 500);
  if (justUnlocked && st.ch > 0) celebrate(p, st.ch - 1);
});

function celebrate(p, ch) {
  const done = chapterInfo(p.level, ch), st = model.journeyState(model.profile(p.id));
  const newRegion = st.ch % model.REGION_SIZE === 0;
  play("unlock");
  import("./games.js").then((g) => g.confetti());
  sheet(newRegion ? "A new region" : done.lookout ? "Lookout reached" : "Chapter complete", (b) => {
    b.append(h("div", { class: "stack", style: { alignItems: "center", textAlign: "center" } },
      art(newRegion ? sceneUrl(model.regionOf(st.ch)[0]) : landmark(done.img), "", 200),
      h("p", { class: "lead" }, newRegion ? `You crossed into ${model.regionOf(st.ch)[1]}. It's in your travel log, and the road opens again tomorrow.`
        : done.lookout ? "You looked back over the road and kept your words. The next stretch opens tomorrow."
        : `You reached ${done.name}. Its words are in your practice now, and the road opens again tomorrow.`),
      h("button", { class: "btn primary", onclick: () => closeSheet() }, "Make camp")));
  });
}

function revisit(p, ch) {
  const ci = chapterInfo(p.level, ch);
  if (!ci.words.length) return;
  sheet(ci.lookout ? `Stop ${ch + 1}: a lookout` : `Stop ${ch + 1}: ${ci.name}`, (b) => {
    b.append(h("div", { class: "jwords", style: { justifyContent: "flex-start" } }, ci.words.map((w) => h("span", {}, w.w))),
      h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: () => { closeSheet(); start({ title: "Revisit", words: ci.words, kind: "mixed", art: "review", back: "/journey" }); } }, "Practice these words")));
  });
}

function travelLog(p) {
  const st = model.journeyState(model.profile(p.id));
  sheet("Travel log", (b) => {
    b.append(h("p", { class: "muted" }, `${plural(st.log.length, "stop")} reached over ${plural(model.journeyDays(st), "day")}.`),
      h("ol", { class: "tlog" }, [...st.log].reverse().map((e) => {
        const ci = chapterInfo(p.level, e.ch);
        return h("li", {}, h("img", { src: landmark(ci.img || "summit"), alt: "", width: 56, height: 56, loading: "lazy" }),
          h("div", { class: "grow" }, h("strong", {}, ci.lookout ? "A lookout" : ci.name), h("span", { class: "muted small" }, `${model.regionOf(e.ch)[1]}, ${dateFmt.format(new Date(e.at))}`)),
          h("span", { class: "tstars", "aria-label": `${e.stars} of 3 stars` }, [1, 2, 3].map((k) => { const s = icon("star", 16); if (k <= e.stars) s.classList.add("on"); return s; })),
          h("button", { class: "iconbtn", "aria-label": "Practice these words", onclick: () => { closeSheet(); revisit(p, e.ch); } }, icon("right")));
      })));
  });
}
