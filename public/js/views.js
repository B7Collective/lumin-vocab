// Lumin Vocab: screens.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
// Layout comes from the classes in app.css (stack, cluster, split, actions, panel, section).
// Avoid inline layout styles so spacing stays consistent across every screen.
import * as store from "./store.js";
import * as model from "./model.js";
import * as sync from "./sync.js";
import * as srs from "./srs.js";
import { LABELS } from "./device.js";
import { app, route, go, render, selectProfile, applyLook, VERSION } from "./app.js";
import { h, icon, avatar, toast, sheet, closeSheet, ask, confirmBox, speak, canSpeak, ACCENTS, tile, share, relTime, untilText, download, topicChip, topicIcon, tint, badge, haptic, reduced, meta, plural, fitWord } from "./ui.js";
import qrcode from "./vendor/qrcode.mjs";
import { tapDecor } from "./decorfx.js";
import { canScan, scanCode } from "./scan.js";
import { SCENES, SCENE_GROUPS, sceneUrl, sceneBig, sceneFx, wallpaperUrl, topicArt, keeperArt } from "./art.js";
import { play } from "./sound.js";
import "./words.js";
import "./journey.js";
import "./practice.js";
import "./games.js";
import "./library.js";
import "./you.js";

const SITE = "https://lumin.b7collective.com";
export const LOOKUP = "https://lookup.b7collective.com"; // Lumin Lookup, the sister dictionary and thesaurus
const SOURCE = "https://github.com/B7Collective/lumin-vocab";
const LEVEL = (l) => model.LEVELS[l] || model.LEVELS[4];
const LEVEL_ICON = ["sprout", "t-nature", "t-mind", "star"], LEVEL_TINT = [6, 1, 5, 3]; // used by the word check

function footer({ short = false } = {}) {
  return h("footer", { class: "footer" }, short ? null : h("p", {}, "100% free. No ads, no tracking, no accounts."),
    h("nav", { "aria-label": "About Lumin Vocab" },
      h("a", { href: "https://b7collective.com", rel: "noopener" }, "Made by B7 Collective"), h("a", { href: LOOKUP, rel: "noopener" }, "Lumin Lookup dictionary"), h("a", { href: "/privacy.html" }, "Privacy"),
      h("a", { href: "#/about" }, "Credits"), h("a", { href: SOURCE, rel: "noopener" }, "Source code")));
}
function qr(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const box = h("div", { class: "qr", role: "img", "aria-label": "QR code" });
  const n = q.getModuleCount();
  const svg = h("svg", { viewBox: `0 0 ${n} ${n}`, "shape-rendering": "crispEdges" });
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  svg.append(h("path", { d, fill: "#18212B" }));
  box.append(svg);
  return box;
}
async function guard(reason = "This needs a grown-up") {
  const p = app.profile, f = model.family();
  if (!f.pin || app.unlocked || (p && p.manager)) return true;
  return pinPrompt(reason, "Unlock", () => { app.unlocked = true; });
}
const waitText = (ms) => { const s = Math.ceil(ms / 1000); return s < 90 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`; };
async function pinPrompt(title, confirm, onOk) {
  const wait = model.pinWait();
  if (wait) { toast(`Too many tries. Try again in ${waitText(wait)}.`); return false; }
  const pin = await ask(title, { label: "Family PIN", type: "password", inputmode: "numeric", confirm, maxlength: 12 });
  if (pin == null) return false;
  const r = await model.tryPin(pin);
  if (r.ok) { onOk && onOk(); return true; }
  toast(r.wait ? `That PIN didn't match. Try again in ${waitText(r.wait)}.` : "That PIN didn't match"); return false;
}
const section = (title, ic, color, ...kids) => h("section", { class: "section" }, h("h2", { class: "sec-title" }, title), ...kids);
// Small paper illustration used in chips and choices
// Topic picking: one tidy grid of picture tiles, used in setup and (inside a sheet) in Settings
function topicPicker(selected, onchange, cls = "") {
  let cur = [...selected];
  return h("div", { class: "ttiles pick " + cls, role: "group", "aria-label": "Topics" }, model.TOPICS.filter((t) => t !== "My words").map((t) =>
    tile({ label: t, src: topicArt(t), on: cur.includes(t), onclick: (e) => { cur = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]; e.currentTarget.setAttribute("aria-pressed", String(cur.includes(t))); haptic(); onchange(cur); } })));
}
const topicSummary = (ts) => !ts.length ? "Pick a few to see more of them" : ts.length <= 3 ? ts.join(", ") : `${ts.slice(0, 2).join(", ")} and ${ts.length - 2} more`;

// ---- Settings building blocks -------------------------------------------------
// One row shape for the whole page: words on the left, the control on the right, a hairline between rows.
const setRow = (title, sub, control, cls = "") => h("div", { class: "srow " + cls }, h("span", { class: "srow-txt" }, h("strong", {}, title), sub ? h("small", {}, sub) : null), control);
// A row that opens a panel: a small picture, what it is, what it's set to, and a chevron
const navRow = (lead, title, value, onclick, label) => h("button", { class: "srow nav", type: "button", onclick, "aria-label": label || title },
  h("span", { class: "srow-txt" }, h("strong", {}, title), value), lead, h("span", { class: "chev", "aria-hidden": "true" }, icon("right", 20)));
// A compact segmented control (one choice at a time)
function segmented(label, opts, value, onpick) {
  const box = h("div", { class: "segctl", role: "radiogroup", "aria-label": label });
  opts.forEach(([v, l]) => box.append(h("button", { type: "button", role: "radio", "aria-checked": String(value === v), onclick: (e) => {
    box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b === e.currentTarget))); haptic(); onpick(v); } }, l)));
  return box;
}
function voiceRow(p, save) {
  return setRow("Voice", "Every word is recorded in both", segmented("Voice", ACCENTS, p.accent === "gb" ? "gb" : "us", (v) => { save({ accent: v }); speak("luminous", { ...p, accent: v }); }));
}
const ROLE_ART = { adult: "character", teen: "talk", kid: "animals" };
const ROLE_LEVEL = { kid: 0, teen: 2, adult: 4 };

// ---- The difficulty slider ---------------------------------------------------
// Three bands (Kids, Teens, Adults), two stops in each. Drag, tap a stop or a band, or use the arrow keys.
export function levelSlider(value, onchange, { suggested = [] } = {}) {
  const G = model.GROUPS, L = model.LEVELS, max = L.length - 1;
  let v = Math.max(0, Math.min(max, value | 0));
  const stops = L.map((x, i) => h("button", { class: "lstop", type: "button", tabindex: "-1", "aria-hidden": "true", onclick: () => set(i) }, h("i"), h("span", {}, x.name)));
  const bands = G.map((g, gi) => h("button", { class: `lband b${gi}`, type: "button", tabindex: "-1", "aria-hidden": "true",
    onclick: () => set(g.levels.includes(v) ? g.levels[(g.levels.indexOf(v) + 1) % g.levels.length] : g.levels[0]) }, h("strong", {}, g.name), h("small", {}, g.ages)));
  const thumb = h("span", { class: "lthumb" }, h("i"));
  const track = h("div", { class: "ltrack" }, h("span", { class: "lrail" }, G.map((g, gi) => h("i", { class: `b${gi}` }))), h("span", { class: "lfill" }), ...stops, thumb);
  const name = h("strong", { class: "lname" }), sug = h("span", { class: "suggest" }, "Suggested"), about = h("span", { class: "labout" }), sample = h("span", { class: "lsample" });
  const readout = h("div", { class: "lread", "aria-hidden": "true" }, h("div", { class: "lnamerow" }, name, sug), about, sample);
  const el = h("div", { class: "lslider", role: "slider", tabindex: "0", "aria-label": "Difficulty", "aria-valuemin": "0", "aria-valuemax": String(max) },
    h("div", { class: "lbands" }, bands), track, readout);
  const paint = (animate) => {
    const x = L[v];
    el.style.setProperty("--v", String(v)); el.dataset.group = String(x.group);
    el.setAttribute("aria-valuenow", String(v)); el.setAttribute("aria-valuetext", `${x.name}, for ${G[x.group].name.toLowerCase()}. ${x.about}`);
    bands.forEach((b, gi) => b.classList.toggle("on", x.group === gi));
    stops.forEach((st, i) => { st.classList.toggle("on", i <= v); st.classList.toggle("cur", i === v); });
    name.textContent = x.name; about.textContent = x.about; sug.hidden = !suggested.includes(v);
    sample.replaceChildren(...[...x.sample].map((c, i) => h("span", { class: "ch", style: { "--i": i } }, c)));
    if (animate && !reduced()) { readout.animate([{ opacity: 0.2, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" });
      thumb.animate([{ scale: "1" }, { scale: "1.25 0.85" }, { scale: "1" }], { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)" }); }
  };
  function set(i) { i = Math.max(0, Math.min(max, i)); if (i === v) return; v = i; paint(true); play("tap"); haptic(8); onchange(v); }
  const at = (e) => { const r = track.getBoundingClientRect(); return Math.round(((e.clientX - r.left) / r.width) * L.length - 0.5); };
  let dragging = false;
  track.addEventListener("pointerdown", (e) => { dragging = true; track.setPointerCapture(e.pointerId); el.classList.add("drag"); set(at(e)); });
  track.addEventListener("pointermove", (e) => { if (dragging) set(at(e)); });
  const end = () => { dragging = false; el.classList.remove("drag"); };
  track.addEventListener("pointerup", end); track.addEventListener("pointercancel", end);
  el.addEventListener("keydown", (e) => {
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (k) { e.preventDefault(); set(v + k); } else if (e.key === "Home") { e.preventDefault(); set(0); } else if (e.key === "End") { e.preventDefault(); set(max); }
  });
  paint(false);
  return el;
}
const backup = () => download(`lumin-vocab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll()));
const swatches = (selected, onpick) => h("div", { class: "chips", role: "group", "aria-label": "Color" }, model.COLORS.map((c, i) =>
  h("button", { class: "swatch", "aria-label": `Color ${i + 1}`, "aria-pressed": String(selected === i), style: { background: c.bg, color: c.fg }, onclick: () => onpick(i) }, selected === i ? icon("check", 20) : null)));

// ---- Welcome -------------------------------------------------------------
// A window onto a scene, with a word from each level arriving the way it does in the app.
// Draws before the word list loads, so these samples are copied from it.
const SAMPLES = [
  { w: "gentle", p: "adj.", i: "JEHN-tuhl", d: "Soft and careful, not rough", scene: "lavender", x: 54 },
  { w: "majestic", p: "adj.", i: "muh-JEH-stihk", d: "Grand and beautiful in a powerful way", scene: "aurora", x: 50 },
  { w: "ambiguous", p: "adj.", i: "/æmˈbɪɡjuəs/", d: "Having more than one possible meaning; unclear", scene: "forest", x: 50 },
  { w: "meticulous", p: "adj.", i: "/məˈtɪkjələs/", d: "Showing great attention to detail; very careful", scene: "moonpagoda", x: 49 },
  { w: "fortuitous", p: "adj.", i: "/fɔrˈtuɪtəs/", d: "Happening by lucky chance", scene: "greatwave", x: 50 },
  { w: "ineffable", p: "adj.", i: "/ɪˈnɛfəbəl/", d: "Too great or extreme to be expressed in words", scene: "library", x: 56 },
];
route("welcome", (main) => {
  let cur = 0, timer = null;
  const bgs = SAMPLES.map((x, k) => h("img", { class: "wbg", src: k ? null : sceneBig(x.scene), "data-src": sceneBig(x.scene), alt: "", style: { "--fx": sceneFx(x) + "%", opacity: k ? "0" : "1", transition: "opacity 1.2s var(--ease)" }, decoding: "async", fetchpriority: k ? "low" : "high" }));
  // The other scenes load once the first is on screen, so the page appears quickly
  addEventListener("load", () => setTimeout(() => bgs.forEach((b) => { if (!b.src) b.src = b.dataset.src; }), 600), { once: true });
  if (document.readyState === "complete") setTimeout(() => bgs.forEach((b) => { if (!b.src) b.src = b.dataset.src; }), 600);
  const sample = h("div", { class: "wsample", "aria-live": "polite" });
  const show = (k) => {
    const x = SAMPLES[k]; cur = k;
    bgs.forEach((b, j) => { b.style.opacity = j === k ? "1" : "0"; });
    const word = h("div", { class: "wword", lang: "en" }, [...x.w].map((ch, i) => h("span", { class: "ch", style: { "--i": i } }, ch)));
    const L = model.LEVELS[k];
    sample.replaceChildren(h("span", { class: "wpos" }, `${L.name}, for ${model.GROUPS[L.group].name.toLowerCase()}`), word, h("span", { class: "wipa glass" }, x.i), h("p", { class: "wdef" }, `(${x.p}) ${x.d}`));
    sample.classList.remove("out");
    requestAnimationFrame(() => fitWord(word));
  };
  const tick = () => { if (!document.body.contains(sample)) { clearInterval(timer); return; } sample.classList.add("out"); setTimeout(() => show((cur + 1) % SAMPLES.length), 360); };
  const feat = (src, title, text) => h("article", {}, h("img", { class: "art", src, alt: "", width: 150, height: 150, loading: "lazy" }), h("h3", {}, title), h("p", {}, text));
  main.append(h("div", { class: "welcome" },
    h("section", { class: "whero" }, ...bgs, h("div", { class: "wshade" }),
      h("div", { class: "inner" },
        h("h1", {}, "A bigger vocabulary, one beautiful word at a time."),
        sample,
        h("div", { class: "wcta" }, h("a", { class: "btn primary", href: "#/setup" }, "Get your first word"), h("a", { class: "textlink", href: "#/join" }, "I have a family code")),
        h("p", { class: "wfree" }, icon("check", 18), "100% free. No ads, no tracking, no accounts."))),
    h("section", { class: "wsec", "aria-labelledby": "w-how" }, h("h2", { id: "w-how" }, "Made for the whole family"),
      h("div", { class: "wfeat" },
        feat("/art/icons/flashcards.webp", "One word at a time", "Swipe through words in a calm, beautiful space. Every word is spoken by a recorded voice, American or British."),
        feat("/art/icons/review.webp", "Practice that sticks", "Words come back just before you'd forget them, as quick games. Miss one, and it gets a second chance."),
        feat("/art/icons/society.webp", "A profile for everyone", "Six levels from first words to philosophy. Everyone keeps their own progress, synced privately between your devices."),
        feat("/art/icons/mywords.webp", "Your own words too", "Met a word in a book or in class? Add it, change it any time, and it joins your practice."))),
    welcomeGames(),
    welcomeRoad(),
    welcomeTrails(),
    welcomeScenes(),
    h("section", { class: "wsec wclose" },
      h("h2", {}, "Free for everyone at home"),
      h("ul", { class: "wpromises" }, [["shield", "No ads or tracking"], ["lock", "No accounts"], ["phone", "Works offline"], ["code", "Open source"]].map(([ic, t]) => h("li", {}, icon(ic, 20), t))),
      h("div", { class: "wcta" }, h("a", { class: "btn primary", href: "#/setup" }, "Get your first word"),
        canInstall() ? h("button", { class: "btn", onclick: () => installFlow() }, icon("down"), "Install the app") : null)),
    footer({ short: true })));
  show(0);
  if (!reduced()) timer = setInterval(tick, 4200);
  addEventListener("hashchange", () => clearInterval(timer), { once: true });
});

// The Lantern Road in miniature: three regions' ground, the road winding through, and the keepers waiting at each stop
const ROAD_STOPS = [["fox", "The Lavender Fields", 28, 17], ["owl", "The Misty Forest", 70, 49], ["gull", "The Quiet Harbor", 32, 81]];
const ROAD_DECOR = [["roses", 80, 9, 70], ["beehive", 86, 27, 70], ["mossrock", 14, 42, 72], ["mushrooms", 28, 57, 56], ["stumplantern", 88, 64, 70], ["rowboat", 76, 86, 96], ["shells", 10, 95, 52]];
function welcomeRoad() {
  const svg = h("svg", { class: "wroadline", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" });
  const pts = [[50, -6], ...ROAD_STOPS.map((s) => [s[2], s[3]]), [56, 106]];
  const d = pts.map((pt, k) => k ? `Q ${pts[k - 1][0]} ${(pts[k - 1][1] + pt[1]) / 2} ${(pts[k - 1][0] + pt[0]) / 2} ${(pts[k - 1][1] + pt[1]) / 2} T ${pt[0]} ${pt[1]}` : `M ${pt[0]} ${pt[1]}`).join(" ");
  for (const cls of ["roadedge", "road", "dots"]) svg.append(h("path", { class: cls, d, "vector-effect": "non-scaling-stroke" }));
  const pos = (x, y) => ({ left: x + "%", top: y + "%" });
  const map = h("div", { class: "wmap land", "aria-hidden": "true" },
    ["heather", "ferns", "sand"].map((g, k) => h("div", { class: `ground g${k}`, style: { "--ground": `url(/art/ground/${g}.webp)` } })),
    svg,
    ROAD_DECOR.map(([n, x, y, sz], k) => h("button", { type: "button", tabindex: "-1", onclick: (e) => tapDecor(e.currentTarget, n), class: "dc wdc" + (n === "roses" ? " sway" : n === "stumplantern" ? " glow" : n === "rowboat" ? " bob" : ""), style: { ...pos(x, y), "--sz": sz + "px", "--i": k } }, h("img", { src: `/art/decor/${n}.webp`, alt: "", width: sz, height: sz, loading: "lazy", decoding: "async" }))),
    ROAD_STOPS.map(([k, name, x, y], i) => h("div", { class: "wstop", style: { ...pos(x, y), "--i": i } }, h("img", { src: `/art/keepers/${k}.webp`, alt: "", width: 88, height: 88, loading: "lazy", decoding: "async" }), h("span", {}, name))));
  return h("section", { class: "wsec wroad", "aria-labelledby": "w-road" },
    h("div", { class: "wroadtext" }, h("h2", { id: "w-road" }, "The Lantern Road"),
      h("p", { class: "lead" }, "A journey through twelve regions, from lavender fields to lighthouse cliffs. Each has its own ground, its own weather and its own keeper."),
      h("p", {}, "One stop a day: meet six words, play with them, then answer the keeper's riddle to reach the next landmark. Every word you learn adds a light to your lantern, and every stop you pass leaves a stamp in your passport."),
      h("p", { class: "muted" }, "Tap the things along the road. Lanterns glow, bees buzz, flowers drop their petals. Try it on the map."),
      h("div", { class: "wkeepers" }, ["hare", "mouse", "tortoise", "bear", "moth"].map((k) => h("img", { src: `/art/keepers/${k}.webp`, alt: "", width: 52, height: 52, loading: "lazy" })), h("span", { class: "muted" }, "and more keepers along the way"))),
    map);
}
const WELCOME_TRAILS = [["spelling", "Often Misspelled", "/art/icons/spelling.webp"], ["decades", "Slang Through the Decades"], ["myths", "Words from Myths"], ["kitchen", "In the Kitchen"], ["space", "Space and Stars"], ["sounds", "Sounds Like It Means"]];
function welcomeTrails() {
  return h("section", { class: "wsec wtrails", "aria-labelledby": "w-trails" }, h("h2", { id: "w-trails" }, "Side trails"),
    h("p", { class: "lead wlead" }, "Nineteen themed walks you can take any time, alongside the main road. No waiting, any order."),
    h("ul", { class: "wtrailgrid" }, WELCOME_TRAILS.map(([k, name, src], i) => h("li", { style: { "--i": i } }, h("img", { src: src || `/art/trails/${k}.webp`, alt: "", width: 120, height: 120, loading: "lazy" }), h("span", {}, name)))));
}
// Every game, named, so a family can see what practice looks like before they start
const WELCOME_GAMES = ["Flash cards", "What it means", "Fill the gap", "Spelling", "Unscramble", "True or false", "Find its twin", "Spot the right use", "Listen closely",
  "Match the pairs", "Word hunt", "Light the letters", "Build the sentence", "Make it yours", "Read the clues", "Odd one out", "Opposites", "Hear and spell", "Game shuffle"];
function welcomeGames() {
  return h("section", { class: "wsec wgames", "aria-labelledby": "w-games" },
    h("h2", { id: "w-games" }, "Nineteen ways to play"),
    h("p", { class: "lead wlead" }, "Practice is a set of short games, and every Journey stop mixes them differently. Kids get the gentler ones."),
    h("ul", { class: "wgamelist" }, WELCOME_GAMES.map((g, i) => h("li", { style: { "--i": i } }, g))));
}
function welcomeScenes() {
  const cards = [["village", 50, -9], ["greatwave", 50, 0], ["lavender", 54, 8]];
  return h("section", { class: "wsec wscenes", "aria-labelledby": "w-scenes" },
    h("div", { class: "wpostcards", "aria-hidden": "true" }, cards.map(([sc, x, r], i) => h("div", { class: "wpost", style: { "--r": r + "deg", "--i": i } }, h("img", { src: sceneUrl(sc), alt: "", width: 320, height: 180, loading: "lazy", decoding: "async", style: { objectPosition: `${x}% 50%` } })))),
    h("div", { class: "wscenetext" }, h("h2", { id: "w-scenes" }, "Scenes worth keeping"),
      h("p", { class: "lead" }, "Twenty-four scenes sit behind your words: harbors, libraries, snowy villages, northern lights and layered paper landscapes, sharp on any screen. Pick a favorite, or let them shuffle."),
      h("p", { class: "muted" }, "Like one? Save it to your phone as a wallpaper, straight from Settings.")));
}

// ---- Join a family ---------------------------------------------------------
route("join", (main) => {
  const pre = sessionStorage.getItem("lumin-join") || "";
  const input = h("input", { type: "text", id: "join-code", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "six words", value: pre.replace(/-/g, " ") });
  const msg = h("p", { class: "muted", role: "status" });
  const btn = h("button", { class: "btn primary", type: "submit" }, "Join");
  let form;
  main.append(h("div", { class: "page narrow" },
    h("img", { class: "art hero-art", src: "/art/icons/society.webp", alt: "", width: 120, height: 120 }),
    h("div", { class: "page-head" }, h("h1", {}, "Join your family"),
      h("p", { class: "lead" }, app.device.form === "desktop"
        ? "On a device that already has Lumin Vocab, open Family and choose Add a device. Then type its six words here, or scan its code with this computer's camera."
        : "On a device that already has Lumin Vocab, open Family and tap Add a device. Then scan the code it shows, or type its six words.")),
    canScan() ? h("div", { class: "actions" }, h("button", { class: "btn", type: "button", onclick: async () => {
      // The QR code holds a join link; a code typed into a QR maker by hand works too
      const code = await scanCode((t) => { const i = t.indexOf("#join="); const c = i >= 0 ? t.slice(i + 6) : t; return sync.validCode(c) ? sync.normalizeCode(c).replace(/-/g, " ") : null; });
      if (!code) return;
      input.value = code; form.requestSubmit();
    } }, icon("scan"), "Scan the code")) : null,
    form = h("form", { class: "panel", onsubmit: async (e) => {
      e.preventDefault();
      if (!sync.validCode(input.value)) { msg.textContent = "A family code is six words. Check for typos and try again."; return; }
      btn.disabled = true; msg.textContent = "Connecting and unlocking your family's words…";
      await sync.enable(input.value);
      const st = sync.status();
      sessionStorage.removeItem("lumin-join");
      if (st.error) { msg.textContent = st.error; btn.disabled = false; return; }
      if (!model.profiles().length) { msg.textContent = "Connected, but no profiles came through yet. Check that the code is right, or wait a moment and try Sync now on the other device."; btn.disabled = false; return; }
      await new Promise((r) => setTimeout(r, 700)); // let incoming data settle before showing profiles
      toast("This device is now part of your family"); go("/who");
    } }, h("div", { class: "field" }, h("label", { for: "join-code" }, "Family code"), input), h("div", { class: "actions" }, btn), msg),
    h("p", { class: "muted" }, "Your code unlocks your family's data on this device. It is never sent to our server, and everything is encrypted before it leaves your device."),
    h("a", { class: "textlink start", href: model.profiles().length ? "#/family" : "#/welcome" }, "Back")));
  setTimeout(() => input.focus(), 50);
});

// ---- Who's learning --------------------------------------------------------
route("who", (main) => {
  const f = model.family();
  const people = h("div", { class: "people" });
  for (const p of model.profiles()) {
    people.append(h("button", { class: "person", onclick: async () => {
      if (p.manager && f.pin && f.lockParents && app.pid !== p.id && !(await pinPrompt(`Open ${p.name}'s profile`, "Open"))) return;
      selectProfile(p.id);
    } }, avatar(p, "lg"), h("span", { class: "n" }, p.name), h("span", { class: "lv" }, LEVEL(p.level).name)));
  }
  people.append(h("button", { class: "person", onclick: async () => { if (await guard("Adding a profile needs a grown-up")) go("/setup"); } },
    h("span", { class: "add" }, icon("plus", 32)), h("span", { class: "n" }, "Add profile"), h("span", { class: "lv" })));
  const st = sync.status();
  main.append(h("div", { class: "center" },
    h("h1", {}, "Who's learning today?"),
    people,
    h("div", { class: "cluster center-x" }, st.enabled ? h("span", { class: "status" }, icon("check"), "Synced " + relTime(st.last)) : null,
      h("a", { class: "textlink", href: "#/family" }, "Manage family and devices"))), footer());
});

// ---- Setup (new profile) ---------------------------------------------------
route("setup", (main) => {
  const first = model.profiles().length === 0;
  const s = { step: 1, role: first ? "adult" : "kid", name: "", color: model.profiles().length % model.COLORS.length, level: first ? 4 : 0, topics: [], goal: 5, readAloud: true };
  const page = h("div", { class: "page narrow" });
  main.append(page);
  const head = (n, title, lead) => h("div", { class: "page-head" },
    h("div", { class: "steps-head" }, h("span", { class: "stepdots", "aria-hidden": "true" }, [1, 2, 3].map(i => h("i", { class: i <= n ? "on" : "" }))), `Step ${n} of 3`),
    h("h1", {}, title), lead ? h("p", { class: "lead" }, lead) : null);
  function draw() {
    page.replaceChildren();
    if (s.step === 1) {
      const name = h("input", { type: "text", id: "pname", maxlength: 24, autocomplete: "off", value: s.name, placeholder: "First name or nickname", oninput: (e) => { s.name = e.target.value; } });
      const roles = [["adult", "An adult", "Rich, rare words like perspicacious", "t-mind", 5], ["teen", "A teen", "Words that matter at school", "target", 4], ["kid", "A kid", "Friendly words, simple sounds, read aloud", "sprout", 6]];
      page.append(head(1, first ? "Let's set up your profile" : "Add someone to your family", first ? "Start with yourself. You can add your family next, and everyone gets their own words and progress." : null),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "Who is this profile for?"),
          h("div", { class: "choices" }, roles.map(([k, t, sub, ic, c]) => h("button", { class: "choice", "aria-pressed": String(s.role === k), onclick: () => { s.role = k; s.level = ROLE_LEVEL[k]; draw(); } },
            h("img", { class: "art-badge", src: `/art/icons/${ROLE_ART[k]}.webp`, alt: "", width: 64, height: 64 }), h("span", { class: "ttl" }, t), h("span", { class: "sub" }, sub))))),
        h("div", { class: "field" }, h("label", { for: "pname" }, "Name"), name, h("small", {}, "Only your family sees this. It's encrypted before it ever syncs.")),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "Color"), swatches(s.color, (i) => { s.color = i; draw(); })),
        h("div", { class: "actions between" },
          first ? h("span") : h("a", { class: "btn quiet", href: "#/who" }, "Cancel"),
          h("button", { class: "btn primary", onclick: () => { if (!s.name.trim()) { name.focus(); toast("Add a name first"); return; } s.step = 2; draw(); } }, "Continue")));
      setTimeout(() => name.focus(), 50);
    } else if (s.step === 2) {
      const suggested = s.role === "kid" ? [0, 1] : s.role === "teen" ? [2, 3] : [4, 5];
      page.append(head(2, `How challenging for ${s.name.trim()}?`, "Slide to choose. Any level works for anyone; the suggestion is just a starting point."),
        levelSlider(s.level, (l) => { s.level = l; }, { suggested }),
        h("div", { class: "stack tight" },
          h("button", { class: "linkbtn start", onclick: () => wordCheck(s.role, (l) => { s.level = l; draw(); toast(`${model.LEVELS[l].name} looks like a good fit`); }) }, "Not sure? Take the word check"),
          h("p", { class: "muted" }, "You can change this any time in settings.")),
        h("div", { class: "actions between" }, h("button", { class: "btn quiet", onclick: () => { s.step = 1; draw(); } }, "Back"), h("button", { class: "btn primary", onclick: () => { s.step = 3; draw(); } }, "Continue")));
    } else {
      const kid = s.role === "kid";
      page.append(head(3, kid ? `What does ${s.name.trim()} like?` : "What are you into?", "Pick any topics to see more of them. Or skip, and you'll get a mix."),
        topicPicker(s.topics, (next) => { s.topics = next; }),
        kid && canSpeak() ? h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Read new words aloud"), h("small", {}, "Great for early readers")), h("input", { type: "checkbox", checked: s.readAloud, onchange: (e) => { s.readAloud = e.target.checked; } })) : null,
        h("div", { class: "actions between" }, h("button", { class: "btn quiet", onclick: () => { s.step = 2; draw(); } }, "Back"),
          h("button", { class: "btn primary", onclick: (ev) => {
            if (ev.currentTarget.disabled) return;
            ev.currentTarget.disabled = true; // a double tap makes one profile, not two
            const p = model.newProfile({ name: s.name.trim().slice(0, 24), role: s.role, level: s.level, topics: s.topics, goal: s.goal, color: s.color,
              theme: kid ? "sunny" : "morning", readAloud: kid && s.readAloud, spelling: !kid, reviewSize: kid ? 10 : 20 });
            selectProfile(p.id);
            toast(first ? "All set. Here's your first word." : `${p.name} is ready`);
          } }, "Start learning")));
    }
  }
  draw();
});

function wordCheck(role, done) {
  const fake = ["plorpish", "vantrous", "glimber", "brindlest", "quorbish", "snevilate"];
  const allowed = role === "kid" ? [0, 1, 2] : [0, 1, 2, 3, 4, 5];
  const items = [];
  for (const l of allowed) { const pool = model.MAIN.filter(w => w.l === l); for (let i = 0; i < 4; i++) items.push({ w: pool[Math.floor(Math.random() * pool.length)].w, l }); }
  fake.sort(() => Math.random() - .5).slice(0, 3).forEach(w => items.push({ w, l: -1 }));
  items.sort(() => Math.random() - .5);
  const yes = {}; let fakesYes = 0, i = 0;
  sheet("Word check", (b) => {
    const area = h("div", { class: "stack loose", style: { alignItems: "center", textAlign: "center" } });
    b.append(h("p", { class: "lead" }, "Do you know what each word means? Be honest. A few made-up words are mixed in."), area);
    const next = () => {
      if (i >= items.length) {
        let level = allowed[0];
        for (const l of allowed) if ((yes[l] || 0) >= 3) level = l;
        if (fakesYes >= 2 && level > allowed[0]) level = allowed[allowed.indexOf(level) - 1];
        closeSheet(); done(level); return;
      }
      const it = items[i];
      const w = h("p", { class: "word", style: { "--wf": "clamp(40px, 9vw, 60px)" } }, it.w);
      area.replaceChildren(h("span", { class: "muted" }, `${i + 1} of ${items.length}`), w,
        h("div", { class: "actions center-x" },
          h("button", { class: "btn", onclick: () => { i++; next(); } }, "Not sure"),
          h("button", { class: "btn primary", onclick: () => { if (it.l < 0) fakesYes++; else yes[it.l] = (yes[it.l] || 0) + 1; i++; next(); } }, "I know it")));
      requestAnimationFrame(() => fitWord(w));
    };
    next();
  });
}


// ---- Family --------------------------------------------------------------
route("family", (main) => {
  const page = h("div", { class: "page" });
  main.append(page);
  const draw = async () => {
    const f = model.family(), st = sync.status(), code = await sync.familyCode();
    const canManage = (app.profile && app.profile.manager) || app.unlocked || !f.pin;
    page.replaceChildren(h("div", { class: "page-head" }, h("h1", {}, "Family"), h("p", { class: "lead" }, "Everyone's profiles, the devices you use, and a backup of it all.")));
    const list = h("div", { class: "panel list" });
    for (const p of model.profiles()) list.append(h("div", { class: "row-item" }, avatar(p),
      h("span", { class: "grow" }, h("strong", {}, p.name), meta(LEVEL(p.level).name, model.ROLES[p.role] || "Adult", p.manager ? "Parent" : null)),
      h("button", { class: "btn small quiet", onclick: async () => { if (p.id === app.pid || await guard("Editing a profile needs a grown-up")) editProfile(p.id); } }, "Edit")));
    list.append(h("div", { class: "row-item split" }, h("button", { class: "btn quiet", onclick: async () => { if (await guard("Adding a profile needs a grown-up")) go("/setup"); } }, icon("plus"), "Add profile"),
      h("a", { class: "textlink", href: "#/who" }, "Switch profile")));
    page.append(section("Profiles", "t-people", "var(--c2)", list));

    // Sync
    const syncPanel = h("div", { class: "panel" });
    page.append(section("Your devices", "sync", "var(--c5)", syncPanel));
    if (!st.enabled) {
      syncPanel.append(h("p", {}, "Right now everything lives on this device only. Turn on family sync to use Lumin Vocab on phones, tablets and computers, with everyone's progress kept in step."),
        h("p", { class: "muted" }, "Everything is encrypted on this device with your family code before it's sent. Our server can't read names, words or progress."),
        h("div", { class: "actions" },
          h("button", { class: "btn primary", onclick: async () => {
            if (!canManage && !(await guard("Turning on sync needs a grown-up"))) return;
            const pool = model.WORDS.filter(w => w.l <= 2).map(w => w.w);
            const c = sync.makeCode(pool);
            syncPanel.replaceChildren(h("p", {}, "Creating your family space…"));
            await sync.enable(c);
            toast(sync.status().error || "Family sync is on"); draw();
          } }, icon("sync"), "Turn on sync"),
          h("a", { class: "btn quiet", href: "#/join" }, "Join a family")));
    } else {
      const showCode = h("div", { class: "cluster", style: { "--gap": "var(--s5)", alignItems: "center" } });
      syncPanel.append(
        h("div", { class: "split" },
          st.error ? h("span", { style: { color: "var(--bad)", fontWeight: 700 } }, st.error) : h("span", { class: "status" }, icon("check"), st.busy ? "Syncing…" : "Synced " + relTime(st.last)),
          h("button", { class: "btn small quiet", onclick: async () => { await sync.syncNow(); draw(); } }, icon("sync"), "Sync now")),
        meta("This device", LABELS.os[app.device.os], LABELS.browser[app.device.browser], app.device.installed ? "installed" : null),
        showCode,
        h("button", { class: "linkbtn start", onclick: async () => { if (await confirmBox("Stop syncing on this device?", "Your words stay on this device, but changes won't reach your other devices until you join again with the family code.", "Stop syncing", true)) { await sync.disable(); draw(); } } }, "Stop syncing on this device"));
      const reveal = h("button", { class: "btn quiet", onclick: async () => {
        if (!canManage && !(await guard("Showing the family code needs a grown-up"))) return;
        showCode.replaceChildren(qr(sync.joinLink(code)), h("div", { class: "stack tight grow", style: { minWidth: "220px" } },
          h("strong", {}, "Add a device"), h("p", { class: "muted" }, "On the other device, open Lumin Vocab, tap I have a family code, and scan this. Or type the six words there."),
          h("span", { class: "code" }, code.replace(/-/g, " ")),
          h("p", { class: "muted small" }, "Keep this code private. Anyone with it can join your family.")));
      } }, icon("plusbox"), "Add a device");
      showCode.append(reveal);
    }

    // Backup
    page.append(section("Backup", "down", "var(--c3)", h("div", { class: "panel" },
      h("p", {}, "Save a file with every profile, word and setting. Keep it somewhere safe, or use it to move to a new device."),
      h("div", { class: "actions" },
        h("button", { class: "btn quiet", onclick: backup }, icon("down"), "Download backup"),
        h("label", { class: "btn quiet" }, icon("up"), "Restore from file", h("input", { type: "file", accept: "application/json,.json", class: "sr", onchange: async (e) => {
          const file = e.target.files[0]; e.target.value = ""; if (!file) return;
          if (!(await guard("Restoring a backup needs a grown-up"))) return;
          if (file.size > 20 * 1024 * 1024) { toast("That file is too large to be a Lumin Vocab backup"); return; }
          try { const n = store.importAll(JSON.parse(await file.text())); toast(`Restored ${n} items`); render(); } catch (err) { toast(err.message || "That file couldn't be read"); }
        } }))))));

    page.append(footer());
  };
  draw();
  const off = sync.onStatus(() => { if (document.body.contains(page)) { if (!page.querySelector("form, input:focus")) draw(); } else off(); });
});
function editProfile(id) {
  const p = model.profile(id); if (!p) return;
  sheet(`Edit ${p.name}`, (b) => {
    const name = h("input", { type: "text", id: "ep-name", value: p.name, maxlength: 24 });
    let role = p.role, level = p.level, color = p.color;
    const rolesBox = h("div", { class: "chips" }), levelBox = h("div"), colorBox = h("div");
    const draw = () => {
      rolesBox.replaceChildren(...Object.entries(model.ROLES).map(([k, l]) => h("button", { class: "chip", "aria-pressed": String(role === k), onclick: () => { role = k; draw(); } }, l)));
      if (!levelBox.firstChild) levelBox.append(levelSlider(level, (i) => { level = i; }));
      colorBox.replaceChildren(swatches(color, (i) => { color = i; draw(); }));
    };
    draw();
    const others = model.profiles().filter(x => x.id !== id);
    b.append(h("div", { class: "field" }, h("label", { for: "ep-name" }, "Name"), name),
      h("div", { class: "field" }, h("span", { class: "flabel" }, "Role"), rolesBox),
      h("div", { class: "field" }, h("span", { class: "flabel" }, "Level"), levelBox),
      h("div", { class: "field" }, h("span", { class: "flabel" }, "Color"), colorBox),
      h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Parent"), h("small", {}, "Parents can manage the family, devices and the PIN")),
        h("input", { type: "checkbox", id: "ep-mgr", checked: !!p.manager, disabled: p.manager && !others.some(o => o.manager) })),
      h("div", { class: "actions" },
        h("button", { class: "btn primary", onclick: () => {
          if (!name.value.trim()) { toast("Add a name"); return; }
          model.saveProfile({ ...model.profile(id), name: name.value.trim().slice(0, 24), role, level, color, manager: document.getElementById("ep-mgr").checked });
          closeSheet(); render();
        } }, "Save"),
        others.length ? h("button", { class: "btn danger", onclick: async () => {
          // Someone has to manage the family. A grown-up takes over first; a kid only if no grown-up is left, and you're told.
          const heir = p.manager && !others.some(o => o.manager) ? (others.find((o) => !model.isKid(o)) || others[0]) : null;
          const note = heir && model.isKid(heir) ? ` ${heir.name} will become the family's parent, with the family settings and PIN.` : "";
          if (!(await confirmBox(`Remove ${p.name}?`, "Their words and progress will be deleted on every synced device. This can't be undone, except from a backup file." + note, "Remove", true))) return;
          if (heir) model.saveProfile({ ...model.profile(heir.id), manager: true });
          model.removeProfile(id);
          if (app.pid === id) { app.pid = null; go("/who"); } else render();
        } }, "Remove profile") : null));
  });
}

// ---- Settings (adapts to who is using it and to the device) ----------------
route("settings", (main, args = []) => {
  const p = app.profile, f = model.family();
  const kid = p.role === "kid";
  const lockedKid = kid && !!f.pin && !app.unlocked;
  const save = (patch) => { model.saveProfile({ ...model.profile(p.id), ...patch }); Object.assign(p, patch); applyLook(); };
  const page = h("div", { class: "page narrow" });
  main.append(page);
  // Settings live in six tabs, so each screen is short and you always know where something is
  const TABS = [["learning", "Learning"], ["look", "Look"], ["sound", "Sound"], ["profile", "Profile"], ["app", "App"]];
  const TAB_OF = { Learning: "learning", Look: "look", "My look": "look", Sound: "sound", "Reading help": "sound", Profile: "profile", "Family controls": "profile", "This device": "app", "Keyboard shortcuts": "app", "Your data": "app", About: "app" };
  // Each section wears a small paper illustration
  const SEC_ART = { "My look": "arts", Look: "arts", "Reading help": "senses", Sound: "senses", Learning: "leveltest", Profile: "character", "Family controls": "society", "This device": "things", "Keyboard shortcuts": "spelling", "Your data": "lists", About: "mywords" };
  const sec = (title, ...kids) => h("section", { class: "section sset", "data-tab": TAB_OF[title] || "learning" }, h("h2", { class: "sec-title" }, h("img", { class: "secart", src: `/art/icons/${SEC_ART[title] || "mywords"}.webp`, alt: "", width: 44, height: 44, loading: "lazy" }), title), h("div", { class: "panel" }, ...kids));
  const sw = (title, sub, checked, onchange, id) => h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, title), sub ? h("small", {}, sub) : null), h("input", { type: "checkbox", id, checked, onchange: (e) => onchange(e.target.checked) }));
  const pressOne = (e, sel) => { e.currentTarget.parentNode.querySelectorAll(sel).forEach(c => c.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); };
  const seg = (label, opts, value, onpick) => h("div", { class: "field" }, h("span", { class: "flabel" }, label), h("div", { class: "chips", role: "group", "aria-label": label },
    opts.map(([v, l]) => h("button", { class: "chip", "aria-pressed": String(value === v), onclick: (e) => { onpick(v); pressOne(e, ".chip"); } }, l))));

  page.append(h("a", { class: "back", href: "#/you" }, icon("left"), "You"));

  // Hero: a live window onto your Words screen that answers every change below
  const L = model.LEVELS[p.level] || model.LEVELS[4];
  const pvA = h("img", { class: "pv-bg on", alt: "", decoding: "async" }), pvB = h("img", { class: "pv-bg", alt: "", decoding: "async" });
  const pvWord = h("div", { class: "pv-word" }, [...L.sample].map((ch, i) => h("span", { class: "ch", style: { "--i": i } }, ch)));
  const preview = h("div", { class: "pv", "aria-hidden": "true" }, pvA, pvB, h("div", { class: "pv-shade" }),
    h("div", { class: "pv-body" }, pvWord, h("span", { class: "pv-pill" }, "Tap to hear"), h("p", { class: "pv-def" }, "Your words, over the scene you choose.")),
    h("div", { class: "pv-acts" }, h("i"), h("i"), h("i"), h("i")));
  let shown = null, cycle = null;
  const showScene = (id) => {
    if (id === shown) return; shown = id;
    const sc = SCENES.find((x) => x.id === id) || SCENES[0];
    const [cur, next] = pvA.classList.contains("on") ? [pvA, pvB] : [pvB, pvA];
    next.src = sceneBig(sc.id); next.style.setProperty("--fx", sceneFx(sc) + "%");
    const swap = () => { next.classList.add("on"); cur.classList.remove("on"); preview.classList.toggle("light", !!sc.light); };
    next.complete ? swap() : (next.onload = swap);
  };
  const paintPreview = () => {
    const cur = model.profile(p.id) || p;
    clearInterval(cycle);
    if (!cur.scene || cur.scene === "auto") { let k = 0; showScene(SCENES[0].id); if (!reduced()) cycle = setInterval(() => { if (!document.body.contains(preview)) { clearInterval(cycle); return; } showScene(SCENES[++k % SCENES.length].id); }, 2600); }
    else showScene(cur.scene);
    preview.style.setProperty("--pvscale", String(cur.scale || 1));
  };
  page.append(h("section", { class: "shero" },
    h("div", { class: "shero-text" }, avatar(p, "lg"), h("h1", {}, "Settings"), h("p", {}, `For ${p.name}. Every change saves as you go.`),
      h("div", { class: "shero-tags" }, h("span", {}, L.name), h("span", {}, (p.scene && p.scene !== "auto" && (SCENES.find((x) => x.id === p.scene) || {}).name) || "Shuffled scenes"))),
    preview));
  paintPreview();

  // Scene: a gallery of wallpapers, each one yours to keep
  const picker = h("div", { class: "wallpicker" });
  const drawPicker = () => {
    const cur = model.profile(p.id).scene || "auto";
    const pick = (id) => { save({ scene: id }); haptic(8); play("tap"); paintPreview(); drawPicker(); const tag = page.querySelector(".shero-tags span:last-child"); if (tag) tag.textContent = id === "auto" ? "Shuffled scenes" : SCENES.find((x) => x.id === id).name; };
    const tile = (sc) => h("div", { class: "wall" + (sc.light ? " light" : ""), "aria-pressed": String(cur === sc.id) },
      h("button", { class: "wpick", "aria-label": `Use ${sc.name}`, "aria-pressed": String(cur === sc.id), onclick: () => pick(sc.id) },
        h("img", { src: sceneUrl(sc.id), alt: "", loading: "lazy", width: 320, height: 180, style: { objectPosition: `${sc.x}% 50%` } }),
        h("span", { class: "wname" }, sc.name), h("span", { class: "wcheck" }, icon("check", 16))),
      h("button", { class: "wdl", "aria-label": `Save ${sc.name} as a wallpaper`, title: "Save as a wallpaper", onclick: (e) => saveWallpaper(sc, e.currentTarget) }, icon("down", 18)));
    picker.replaceChildren(
      h("button", { class: "wall auto", "aria-pressed": String(cur === "auto"), onclick: () => pick("auto") },
        h("span", { class: "mosaic" }, SCENES.filter((_, k) => k % 4 === 0).slice(0, 4).map((sc) => h("img", { src: sceneUrl(sc.id), alt: "", loading: "lazy" }))),
        h("span", { class: "wname" }, icon("sync", 16), "Shuffle: a new scene with every word"), h("span", { class: "wcheck" }, icon("check", 16))),
      ...SCENE_GROUPS.map(([g, label]) => h("div", { class: "wgroup" }, h("h3", {}, label), h("div", { class: "wrow" }, SCENES.filter((sc) => sc.group === g).map(tile)))));
  };
  drawPicker();
  const sceneThumb = h("span", { class: "scthumb", "aria-hidden": "true" });
  const sceneValue = h("small", {});
  const paintSceneRow = () => {
    const cur = model.profile(p.id).scene || "auto";
    const shots = cur === "auto" ? SCENES.filter((_, k) => k % 4 === 0).slice(0, 4) : [SCENES.find((x) => x.id === cur) || SCENES[0]];
    sceneThumb.classList.toggle("mosaic", cur === "auto");
    sceneThumb.replaceChildren(...shots.map((sc) => h("img", { src: sceneUrl(sc.id), alt: "", loading: "lazy", decoding: "async", style: { objectPosition: `${sc.x}% 50%` } })));
    sceneValue.textContent = cur === "auto" ? "Shuffle: a new scene with every word" : (SCENES.find((x) => x.id === cur) || {}).name || "";
  };
  paintSceneRow();
  const openScenes = () => sheet("Scene behind your words", (b) => {
    b.classList.add("wide");
    b.append(picker, h("p", { class: "muted small" }, "Like one? Tap the arrow on any scene to save it as a wallpaper."));
  }, { onClose: paintSceneRow });
  const sceneSec = sec(kid ? "My look" : "Look", navRow(sceneThumb, "Scene", sceneValue, openScenes, "Scene behind your words"));

  // Appearance, as three little windows of light
  const looks = [["device", "Auto", "contrast"], ["light", "Light", "sun"], ["dark", "Dark", "moon"]];
  const curLook = ["light", "dark"].includes(p.dark) ? p.dark : "device";
  const lookRow = h("div", { class: "looks", role: "group", "aria-label": "Appearance" }, looks.map(([v, label, ic]) => h("button", { class: `look ${v}`, "aria-pressed": String(curLook === v), onclick: (e) => { save({ dark: v }); pressOne(e, ".look"); play("tap"); } },
    h("span", { class: "lk-win" }, h("i"), h("i"), h("i")), h("span", { class: "lk-name" }, icon(ic, 18), label))));
  const scale = h("input", { type: "range", id: "set-scale", min: "0.9", max: "1.3", step: "0.05", value: String(p.scale || (model.isKid(p) ? 1.08 : 1)), oninput: (e) => { save({ scale: parseFloat(e.target.value) }); paintPreview(); } });
  const avatarPick = swatches(p.color, (i) => { save({ color: i }); render(); });
  sceneSec.querySelector(".panel").append(
    h("div", { class: "srow stack" }, h("label", { class: "srow-txt", for: "set-scale" }, h("strong", {}, "Text size")), h("div", { class: "range-row" }, h("span", { "aria-hidden": "true", class: "small muted" }, "A"), scale, h("span", { "aria-hidden": "true", class: "muted big-a" }, "A"))),
    kid ? h("div", { class: "srow stack" }, h("span", { class: "srow-txt" }, h("strong", {}, "My color")), avatarPick) : null,
    lockedKid ? null : h("div", { class: "srow stack" }, h("span", { class: "srow-txt" }, h("strong", {}, "Appearance")), lookRow),
    lockedKid ? null : (() => { const sys = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const el = sw("Calmer motion", sys ? "On, because this device asks for less motion" : "Fewer animations when moving between words", sys || !!p.calm, (v) => save({ calm: v }));
      if (sys) el.querySelector("input").disabled = true; return el; })());
  page.append(sceneSec);

  // Sound
  const soundSec = sec(kid ? "Reading help" : "Sound", sw("Sound effects", "Soft chimes when you answer and finish", p.sound !== false, (v) => { save({ sound: v }); if (v) play("right"); }));
  page.append(soundSec);
  if (canSpeak()) {
    soundSec.querySelector(".panel").append(
      sw("Read words aloud", kid ? "Hear each new word and review question" : "Hear each new word as it appears", !!p.readAloud, (v) => save({ readAloud: v })),
      lockedKid ? null : voiceRow(p, save));
  }

  if (lockedKid) {
    page.append(h("button", { class: "btn quiet start", onclick: async () => { if (await guard("Grown-up settings")) render(); } }, icon("lock"), "Grown-up settings"), footer());
    return;
  }

  // Learning (first for teens and adults, after the fun stuff for kids)
  const learnSec = sec("Learning",
    h("div", { class: "srow stack first" }, h("span", { class: "srow-txt" }, h("strong", {}, "Difficulty"), h("small", {}, "Each level keeps its own Journey progress, so you can switch and come back.")), levelSlider(p.level, (i) => save({ level: i })),
      h("a", { class: "linkbtn start", href: "#/practice" }, "Not sure? Take the level check in Practice")),
    h("div", { class: "srow stack" }, h("span", { class: "srow-txt" }, h("strong", {}, "Favorite topics"), h("small", {}, "Tap the ones you love to see more of them. Leave them all off for a mix.")),
      topicPicker(p.topics || [], (next) => save({ topics: next }), "compact")),
    setRow("Words per review", "How many words each review session holds", segmented("Words per review", [[10, "10"], [20, "20"], [30, "30"]], p.reviewSize || 20, (v) => save({ reviewSize: v }))));
  if (kid) page.append(learnSec); else page.insertBefore(learnSec, page.children[2]);

  // Profile
  if (!kid) page.append(sec("Profile",
    h("div", { class: "field" }, h("label", { for: "set-name" }, "Name"), h("input", { type: "text", id: "set-name", value: p.name, maxlength: 24, onchange: (e) => { if (e.target.value.trim()) { save({ name: e.target.value.trim() }); render(); } } })),
    h("div", { class: "field" }, h("span", { class: "flabel" }, "Color"), avatarPick)));

  // Family controls for parents
  if (p.manager || app.unlocked) {
    const pinBtn = h("button", { class: "btn small quiet", onclick: async () => {
      const pin = await ask(f.pin ? "Change family PIN" : "Set a family PIN", { label: "4 to 8 digits", type: "password", inputmode: "numeric", confirm: "Next", maxlength: 8 });
      if (pin == null) return;
      if (!/^\d{4,8}$/.test(pin)) { toast("Use 4 to 8 digits"); return; }
      const again = await ask("Type it again", { label: "Family PIN", type: "password", inputmode: "numeric", confirm: "Save", maxlength: 8 });
      if (again !== pin) { toast("Those didn't match"); return; }
      await model.setPin(pin); toast("Family PIN saved"); render();
    } }, f.pin ? "Change PIN" : "Set PIN");
    page.append(sec("Family controls",
      h("div", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Family PIN"), h("small", {}, f.pin ? "On. Kids need it for grown-up settings and family changes." : "Off. Anyone can change settings and profiles.")), pinBtn),
      f.pin ? sw("Ask for the PIN to open parent profiles", "So kids can't switch into a parent's profile", f.lockParents !== false, (v) => store.put("family", "family", { ...model.family(), lockParents: v })) : null,
      h("div", { class: "actions" },
        h("a", { class: "btn small quiet", href: "#/family" }, icon("family"), "Manage family"),
        f.pin ? h("button", { class: "linkbtn", onclick: async () => { if (await confirmBox("Turn off the family PIN?", "Anyone using this app will be able to change settings and profiles.", "Turn off", true)) { await model.setPin(null); render(); } } }, "Turn off PIN") : null)));
  }

  // This device
  const d = app.device;
  const synced = sync.status();
  page.append(sec("This device",
    h("div", { class: "row-item" }, h("span", { class: "badge" }, icon(d.form === "desktop" ? "desktop" : "phone")), h("span", { class: "grow" }, h("strong", {}, `${LABELS.os[d.os]} · ${LABELS.browser[d.browser]}`),
      meta(d.form === "desktop" ? "Computer" : d.form === "tablet" ? "Tablet" : "Phone", `${d.width}×${d.height}`, d.installed ? "Installed as an app" : "In the browser")),
      d.installed ? null : h("a", { class: "btn small primary", href: "#/install" }, "Install")),
    h("div", { class: "row-item" }, h("span", { class: "badge" }, icon("sync")), h("span", { class: "grow" }, h("strong", {}, synced.enabled ? "Family sync is on" : "Family sync is off"), h("span", { class: "muted small" }, synced.enabled ? `Last synced ${relTime(synced.last)}` : "Everything stays on this device")),
      h("a", { class: "btn small quiet", href: "#/family" }, synced.enabled ? "Manage" : "Turn on")),
    store.persistent() ? null : h("p", { class: "muted" }, "This browser isn't letting Lumin Vocab save data. Private browsing can cause this.")));
  if (d.keyboard && d.layout === "wide") {
    const k = (...keys) => h("dt", {}, keys.flatMap((x, i) => [i ? h("span", { class: "muted small" }, "to") : null, h("span", { class: "kbd" }, x)]));
    page.append(sec("Keyboard shortcuts", h("dl", { class: "shortcuts" },
      [[["↓"], "Next word"], [["↑"], "Previous word"], [["F"], "Favorite"], [["S"], "Save to practice"], [["P"], "Hear it"], [["I"], "Word details"], [["Esc"], "Close a panel"]]
        .map(([keys, label]) => h("div", {}, k(...keys), h("dd", {}, label))))));
  }

  // Data
  page.append(sec("Your data",
    h("p", {}, h("strong", {}, "100% free, with no ads, no tracking and no accounts. "), "Everything is stored on your devices. With family sync on, it's encrypted before it leaves this device."),
    h("div", { class: "actions" },
      h("button", { class: "btn small quiet", onclick: backup }, icon("down"), "Download backup"),
      h("a", { class: "btn small quiet", href: "/privacy.html" }, "Privacy")),
    p.manager || app.unlocked ? h("button", { class: "linkbtn start", style: { color: "var(--bad)" }, onclick: async () => {
      if (!(await confirmBox("Erase everything on this device?", "All profiles and progress on this device will be deleted. Other synced devices keep their copy. Download a backup first if you're not syncing.", "Erase", true))) return;
      await sync.disable(); await store.wipe(); localStorage.clear(); location.hash = ""; location.reload();
    } }, "Erase this device") : null));

  page.append(sec("About",
    h("p", {}, `Lumin Vocab ${VERSION}. Free and open source under the AGPL-3.0 license. Made by `, h("a", { href: "https://b7collective.com", rel: "noopener" }, "B7 Collective"), "."),
    h("div", { class: "actions" }, h("a", { class: "btn small quiet", href: "#/about" }, "Credits and licenses"), h("a", { class: "btn small quiet", href: SOURCE, rel: "noopener" }, "Source code")),
    h("p", {}, h("strong", {}, "Lumin Lookup"), ": our free dictionary and thesaurus, with the same look and the same family code. Every word, its synonyms and where it came from."),
    h("div", { class: "actions" }, h("a", { class: "btn small quiet", href: LOOKUP, rel: "noopener" }, "Open Lumin Lookup"))));
  settingsTabs(page, TABS, args[0]);
  page.append(footer());
});

// Tabs for Settings: one group of settings on screen at a time. Remembers the last tab; #/settings/look opens one directly.
function settingsTabs(page, tabs, want) {
  const secs = [...page.querySelectorAll("section.sset")];
  const present = tabs.filter(([k]) => secs.some((x) => x.dataset.tab === k));
  if (present.length < 2) return;
  secs.forEach((x) => x.classList.toggle("solo", secs.filter((y) => y.dataset.tab === x.dataset.tab).length === 1));
  let last = null; try { last = sessionStorage.getItem("lumin-settings-tab"); } catch {}
  let cur = [want, last, present[0][0]].find((k) => present.some(([t]) => t === k));
  const bar = h("nav", { class: "settabs", "aria-label": "Settings sections" });
  const show = (k, user) => {
    cur = k;
    secs.forEach((x) => { x.hidden = x.dataset.tab !== k; });
    page.dataset.stab = k;
    bar.querySelectorAll("button").forEach((b) => { const on = b.dataset.tab === k; b.setAttribute("aria-current", on ? "page" : "false"); if (on && user) b.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced() ? "auto" : "smooth" }); });
    try { sessionStorage.setItem("lumin-settings-tab", k); } catch {}
    if (user) { history.replaceState(null, "", "#/settings/" + k); const top = bar.getBoundingClientRect().top + scrollY - 12; if (scrollY > top) scrollTo({ top, behavior: reduced() ? "auto" : "smooth" }); }
  };
  present.forEach(([k, label]) => bar.append(h("button", { type: "button", "data-tab": k, onclick: () => { haptic(); show(k, true); } }, label)));
  const hero = page.querySelector(".shero");
  (hero ? hero.after(bar) : page.prepend(bar));
  show(cur, false);
}

// Save a scene as a wallpaper: the share sheet on phones (so it can go straight to Photos), a download elsewhere
async function saveWallpaper(sc, btn) {
  const name = `Lumin Vocab - ${sc.name}.jpg`;
  btn && btn.classList.add("busy");
  try {
    const blob = await (await fetch(wallpaperUrl(sc.id))).blob();
    const file = new File([blob], name, { type: "image/jpeg" });
    if (app.device.form !== "desktop" && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: sc.name }); }
    else {
      const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast(`Saved ${sc.name}`);
    }
  } catch (e) { if (!e || e.name !== "AbortError") toast("That picture couldn't be saved. Try again in a moment."); }
  finally { btn && btn.classList.remove("busy"); }
}

// ---- Install (tailored to the device) ----------------------------------------
const STEP_IC = { share: "share", plus: "plusbox", menu: "menu", check: "check" };
const stepsList = (steps) => h("ol", { class: "steps" }, steps.map(s => h("li", {}, h("span", { class: "ic" }, icon(STEP_IC[s.icon] || "check")), h("span", {}, s.text))));
// Can this device install the app at all? (Already installed, or a browser with no install support: no.)
export const canInstall = () => !["installed", "unsupported"].includes(app.device.install.kind);
// One tap from anywhere: the browser's own install dialog where it exists (Chrome, Edge, Brave, Android),
// otherwise a short sheet with the exact steps for this device (iPhone and iPad, Safari on Mac, Firefox on Android).
export async function installFlow() {
  const g = app.device.install;
  if (app.installPrompt) {
    const ev = app.installPrompt; app.installPrompt = null;
    ev.prompt();
    const r = await ev.userChoice.catch(() => null);
    if (r && r.outcome === "accepted") toast("Installing Lumin Vocab");
    return;
  }
  const apple = app.device.apple;
  sheet("Install Lumin Vocab", (b) => {
    b.append(h("p", { class: "lead" }, apple ? "On iPhone and iPad, apps from the web are added from the Share menu. It takes three taps." : "It installs like an app: its own icon, full screen, and it works offline."));
    if (g.kind === "steps") b.append(stepsList(g.steps));
    else if (g.kind === "prompt") b.append(stepsList(g.fallback));
    else if (g.kind === "openInBrowser") b.append(h("p", {}, `You're inside another app's browser, which can't install web apps. Open this page in ${g.target}: tap the menu (often ••• or a compass icon) and choose Open in browser.`),
      h("div", { class: "actions" }, h("button", { class: "btn small quiet", onclick: async () => { try { await navigator.clipboard.writeText(SITE); toast("Link copied"); } catch { toast(SITE); } } }, "Copy the link")));
    if (app.device.form === "desktop") b.append(h("div", { class: "cluster", style: { "--gap": "var(--s4)" } }, qr(SITE + "/#/install"),
      h("p", { class: "grow muted", style: { minWidth: "180px" } }, "To put it on a phone, point the phone's camera at this code.")));
  });
}
app.installFlow = installFlow;
app.canInstall = canInstall;

route("install", (main) => {
  const d = app.device, g = d.install;
  const place = d.form === "desktop" ? "this computer" : `your ${LABELS.os[d.os] === "this device" ? "device" : LABELS.os[d.os]}`;
  const page = h("div", { class: "page narrow" });
  main.append(page);
  const draw = () => {
    const head = h("div", { class: "page-head" }, h("img", { src: "/icons/logo.svg", alt: "", width: 56, height: 56, style: { borderRadius: "14px", marginBottom: "var(--s3)" } }));
    page.replaceChildren(head);
    if (g.kind === "installed") {
      head.append(h("h1", {}, "You're using the app"), h("p", { class: "lead" }, "Lumin Vocab is installed on this device. It opens full screen and works offline."));
      page.append(h("a", { class: "btn primary start", href: "#/words" }, "Back to words"));
    } else {
      head.append(h("h1", {}, `Install Lumin Vocab on ${place}`), h("p", { class: "lead" }, "It installs like an app: its own icon, full screen, and it works offline. No app store, no account."));
      if (g.kind === "prompt") {
        const box = h("div", { class: "stack" });
        if (app.installPrompt) box.append(h("button", { class: "btn primary start", onclick: async () => {
          const ev = app.installPrompt; app.installPrompt = null; ev.prompt(); const r = await ev.userChoice; if (r.outcome === "accepted") toast("Installing…"); draw();
        } }, icon("down"), "Install"), h("p", { class: "muted" }, "Or do it yourself:"));
        box.append(stepsList(g.fallback));
        page.append(box);
      } else if (g.kind === "steps") page.append(stepsList(g.steps));
      else if (g.kind === "openInBrowser") page.append(h("div", { class: "panel" }, h("p", {}, `You're inside another app's browser, which can't install web apps. Open this page in ${g.target}: tap the menu (often ••• or a compass icon) and choose Open in browser.`),
        h("button", { class: "btn small quiet start", onclick: async () => { try { await navigator.clipboard.writeText(SITE); toast("Link copied"); } catch { toast(SITE); } } }, "Copy the link")));
      else page.append(h("div", { class: "panel" }, h("p", {}, g.note)));
    }
    if (d.form === "desktop") page.append(section("Get it on your phone", "phone", "var(--c1)", h("div", { class: "panel" }, h("div", { class: "cluster", style: { "--gap": "var(--s5)" } }, qr(SITE + "/#/install"),
      h("p", { class: "grow", style: { minWidth: "200px" } }, "Point your phone's camera at this code. It opens Lumin Vocab with the right steps for that phone.")))));
    page.append(footer());
  };
  draw();
  const ready = () => { if (document.body.contains(page)) draw(); else document.removeEventListener("lumin-install-ready", ready); };
  document.addEventListener("lumin-install-ready", ready);
});

// ---- About / credits ---------------------------------------------------------
route("about", (main) => {
  main.append(h("div", { class: "page narrow" },
    h("div", { class: "page-head" }, h("h1", {}, "Credits and licenses"), h("p", { class: "lead" }, "Lumin Vocab is free and open source. Here's what it's built from.")),
    h("div", { class: "panel" }, h("h2", {}, "The app"),
      h("p", {}, `Lumin Vocab ${VERSION}, made by `, h("a", { href: "https://b7collective.com", rel: "noopener" }, "B7 Collective LLC"), ". Code licensed under the GNU Affero General Public License v3.0. ", h("a", { href: SOURCE, rel: "noopener" }, "Get the source code"), ".")),
    h("div", { class: "panel" }, h("h2", {}, "Words"),
      h("p", {}, "The word list is released under CC BY-SA 4.0 and built from:"),
      h("ul", { class: "credits" },
        h("li", {}, "Words, definitions and examples at every level: chosen and written for Lumin Vocab by B7 Collective."),
        h("li", {}, "Word audio: recorded with the Kokoro-82M voice model by hexgrad (Apache-2.0), American voice Heart and British voice Emma, with pronunciations from the misaki dictionaries (Apache-2.0)."),
        h("li", {}, "Which words to add: picked with help from the CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, Tokyo University of Foreign Studies (Tono Laboratory, TUFS), and the Octanove Vocabulary Profile for C1/C2 levels by Octanove Labs, CC BY-SA 4.0, both via ", h("a", { href: "https://github.com/openlanguageprofiles/olp-en-cefrj", rel: "noopener" }, "Open Language Profiles"), "."),
        h("li", {}, "Similar words and word families: from ", h("a", { href: "https://en-word.net", rel: "noopener" }, "Open English WordNet"), " by the Open English WordNet Community, CC BY 4.0. WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved. THIS SOFTWARE AND DATABASE IS PROVIDED \"AS IS\" AND PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED."),
        h("li", {}, "Pronunciations (IPA and simple respellings): generated from the CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University, BSD 2-Clause License."),
        h("li", {}, "Journey order, from common to rare: ranked using word frequencies from wordfreq by Robyn Speer (data CC BY-SA 4.0), which includes data from Google Books Ngram, OpenSubtitles, SUBTLEX by Marc Brysbaert et al., and other sources."),
        h("li", {}, "Family-safe filtering: helped by the List of Dirty, Naughty, Obscene, and Otherwise Bad Words, CC BY 4.0."))),
    h("div", { class: "panel" }, h("h2", {}, "Pictures and sound"),
      h("ul", { class: "credits" },
        h("li", {}, "Scenes, paper illustrations, the ground along the road and everything beside it: made for Lumin Vocab by B7 Collective with Google Gemini image generation. They are AI-generated, not photographs, and are dedicated to the public domain (CC0 1.0)."),
        h("li", {}, "Sounds: synthesized in your browser by the app's own code; there are no audio files."))),
    h("div", { class: "panel" }, h("h2", {}, "Other parts"),
      h("ul", { class: "credits" },
        h("li", {}, "Review scheduling: based on the FSRS algorithm by the open-spaced-repetition project (MIT)."),
        h("li", {}, "Fonts: Literata (SIL Open Font License 1.1) and Atkinson Hyperlegible by the Braille Institute (SIL Open Font License 1.1)."),
        h("li", {}, "QR codes: qrcode-generator by Kazuhiko Arase (MIT) draws them, and jsQR by Cosmo Wolfe (Apache License 2.0) reads them. QR Code is a registered trademark of DENSO WAVE INCORPORATED."))),
    h("a", { class: "textlink start", href: app.profile ? "#/settings" : "#/welcome" }, "Back"), footer()));
});
