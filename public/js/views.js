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
import { h, icon, avatar, toast, sheet, closeSheet, ask, confirmBox, speak, canSpeak, voices, share, relTime, untilText, download, topicChip, topicIcon, tint, badge, haptic, reduced, meta, plural, fitWord } from "./ui.js";
import qrcode from "./vendor/qrcode.mjs";

const SITE = "https://lumin.b7collective.com";
const SOURCE = "https://github.com/B7Collective/lumin-vocab";
const LEVEL = (l) => model.LEVELS[l] || model.LEVELS[3];
const LEVEL_ICON = ["sprout", "t-nature", "t-mind", "star"], LEVEL_TINT = [6, 1, 5, 3];

function footer() {
  return h("footer", { class: "footer" }, h("p", {}, "100% free. No ads, no tracking, no accounts."),
    h("nav", { "aria-label": "About Lumin Vocab" },
      h("a", { href: "https://b7collective.com", rel: "noopener" }, "Made by B7 Collective"), h("a", { href: "/privacy.html" }, "Privacy"),
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
const section = (title, ic, color, ...kids) => h("section", { class: "section" }, h("h2", { class: "sec-title" }, badge(ic, color), title), ...kids);
const backup = () => download(`lumin-vocab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll()));
const swatches = (selected, onpick) => h("div", { class: "chips", role: "group", "aria-label": "Color" }, model.COLORS.map((c, i) =>
  h("button", { class: "swatch", "aria-label": `Color ${i + 1}`, "aria-pressed": String(selected === i), style: { background: c.bg, color: c.fg }, onclick: () => onpick(i) }, selected === i ? icon("check", 20) : null)));

// ---- Welcome -------------------------------------------------------------
route("welcome", (main) => {
  const preview = h("div", { class: "preview", "aria-hidden": "true" },
    h("div", { class: "card-meta" }, topicChip("Describing"), h("span", { class: "pos" }, "adjective")),
    h("span", { class: "word" }, "luminous"), h("span", { class: "muted" }, "LOO-muh-nuhs"),
    h("p", { class: "def" }, "giving off light, or glowing in the dark"),
    h("p", { class: "ex" }, "The luminous stars on my ceiling glow at night."));
  main.append(h("section", { class: "hero" },
    h("div", { class: "hero-copy" },
      h("h1", {}, "A new word every day, for the whole family."),
      h("p", { class: "lead" }, "One calm word at a time, review that makes words stick, and levels from early readers to grown-ups."),
      h("ul", { class: "promises", "aria-label": "Our promises" }, [["check", "100% free"], ["shield", "No ads or tracking"], ["lock", "No accounts"], ["phone", "Works offline"]].map(([ic, t]) => h("li", {}, icon(ic, 18), t))),
      h("div", { class: "actions" }, h("a", { class: "btn primary", href: "#/setup" }, "Get started"), h("a", { class: "textlink", href: "#/join" }, "Join your family on this device")),
      h("div", { class: "features" },
        [["sprout", "Levels for every age", "Kid-written words for young readers, up to grown-up vocabulary."], ["review", "Review that sticks", "Words come back right before you'd forget them."],
         ["family", "The whole family", "A profile for everyone, synced privately across devices."]].map(([ic, t, d]) => h("div", { class: "feature" }, h("span", { class: "fi" }, icon(ic)), h("div", {}, h("strong", {}, t), h("span", { class: "muted" }, d)))))),
    preview), footer());
  requestAnimationFrame(() => fitWord(preview.querySelector(".word")));
});

// ---- Join a family ---------------------------------------------------------
route("join", (main) => {
  const pre = sessionStorage.getItem("lumin-join") || "";
  const input = h("input", { type: "text", id: "join-code", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "six words", value: pre.replace(/-/g, " ") });
  const msg = h("p", { class: "muted", role: "status" });
  const btn = h("button", { class: "btn primary", type: "submit" }, "Join");
  main.append(h("div", { class: "page narrow" },
    h("div", { class: "page-head" }, h("h1", {}, "Join your family"),
      h("p", { class: "lead" }, "On a device that already has Lumin Vocab, open Family and choose Add a device. Scan the QR code with this device's camera, or type the six words here.")),
    h("form", { class: "panel", onsubmit: async (e) => {
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
  const s = { step: 1, role: first ? "adult" : "kid", name: "", color: model.profiles().length % model.COLORS.length, level: first ? 3 : 0, topics: [], goal: 5, readAloud: true };
  const page = h("div", { class: "page narrow" });
  main.append(page);
  const head = (n, title, lead) => h("div", { class: "page-head" },
    h("div", { class: "steps-head" }, h("span", { class: "stepdots", "aria-hidden": "true" }, [1, 2, 3].map(i => h("i", { class: i <= n ? "on" : "" }))), `Step ${n} of 3`),
    h("h1", {}, title), lead ? h("p", { class: "lead" }, lead) : null);
  function draw() {
    page.replaceChildren();
    if (s.step === 1) {
      const name = h("input", { type: "text", id: "pname", maxlength: 24, autocomplete: "off", value: s.name, placeholder: "First name or nickname", oninput: (e) => { s.name = e.target.value; } });
      const roles = [["adult", "An adult", "Grown-up words and spelling practice", "t-mind", 5], ["teen", "A teen", "Challenging words for school", "target", 4], ["kid", "A kid", "Simple definitions, bigger buttons, read aloud", "sprout", 6]];
      page.append(head(1, first ? "Let's set up your profile" : "Add someone to your family", first ? "Start with yourself. You can add your family next, and everyone gets their own words and progress." : null),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "Who is this profile for?"),
          h("div", { class: "choices" }, roles.map(([k, t, sub, ic, c]) => h("button", { class: "choice", "aria-pressed": String(s.role === k), onclick: () => { s.role = k; s.level = k === "adult" ? 3 : k === "teen" ? 2 : 0; draw(); } },
            badge(ic, `var(--c${c})`), h("span", { class: "ttl" }, t), h("span", { class: "sub" }, sub))))),
        h("div", { class: "field" }, h("label", { for: "pname" }, "Name"), name, h("small", {}, "Only your family sees this. It's encrypted before it ever syncs.")),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "Color"), swatches(s.color, (i) => { s.color = i; draw(); })),
        h("div", { class: "actions between" },
          first ? h("span") : h("a", { class: "btn quiet", href: "#/who" }, "Cancel"),
          h("button", { class: "btn primary", onclick: () => { if (!s.name.trim()) { name.focus(); toast("Add a name first"); return; } s.step = 2; draw(); } }, "Continue")));
      setTimeout(() => name.focus(), 50);
    } else if (s.step === 2) {
      const suggested = s.role === "kid" ? [0, 1] : s.role === "teen" ? [2] : [3];
      page.append(head(2, `Pick a level for ${s.name.trim()}`, "Any level works for anyone. The suggestion is just a starting point."),
        h("div", { class: "choices" }, [0, 1, 2, 3].map((l) => h("button", { class: "choice", "aria-pressed": String(s.level === l), onclick: () => { s.level = l; draw(); } },
          badge(LEVEL_ICON[l], `var(--c${LEVEL_TINT[l]})`),
          h("span", { class: "ttl" }, model.LEVELS[l].name, suggested.includes(l) ? h("span", { class: "suggest" }, "Suggested") : null),
          h("span", { class: "sub" }, model.LEVELS[l].ages), h("span", { class: "s" }, model.LEVELS[l].sample)))),
        h("div", { class: "stack tight" },
          h("button", { class: "linkbtn start", onclick: () => wordCheck(s.role, (l) => { s.level = l; draw(); toast(`${model.LEVELS[l].name} looks like a good fit`); }) }, "Not sure? Take the word check"),
          h("p", { class: "muted" }, "You can change this any time in settings.")),
        h("div", { class: "actions between" }, h("button", { class: "btn quiet", onclick: () => { s.step = 1; draw(); } }, "Back"), h("button", { class: "btn primary", onclick: () => { s.step = 3; draw(); } }, "Continue")));
    } else {
      const kid = s.role === "kid";
      page.append(head(3, kid ? `What does ${s.name.trim()} like?` : "What are you into?", "Pick any topics to see more of them. Or skip, and you'll get a mix."),
        h("div", { class: "chips" }, model.TOPICS.filter(t => t !== "My words").map((t) => h("button", { class: "chip", "aria-pressed": String(s.topics.includes(t)), onclick: (e) => { s.topics = s.topics.includes(t) ? s.topics.filter(x => x !== t) : [...s.topics, t]; e.currentTarget.setAttribute("aria-pressed", String(s.topics.includes(t))); } }, topicIcon(t), t))),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "New words a day"),
          h("div", { class: "chips" }, [3, 5, 10, 15].map((g) => h("button", { class: "chip", "aria-pressed": String(s.goal === g), onclick: () => { s.goal = g; draw(); } }, String(g))))),
        kid && canSpeak() ? h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Read new words aloud"), h("small", {}, "Great for early readers")), h("input", { type: "checkbox", checked: s.readAloud, onchange: (e) => { s.readAloud = e.target.checked; } })) : null,
        h("div", { class: "actions between" }, h("button", { class: "btn quiet", onclick: () => { s.step = 2; draw(); } }, "Back"),
          h("button", { class: "btn primary", onclick: () => {
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
  const allowed = role === "kid" ? [0, 1, 2] : [0, 1, 2, 3];
  const items = [];
  for (const l of allowed) { const pool = model.WORDS.filter(w => w.l === l); for (let i = 0; i < 5; i++) items.push({ w: pool[Math.floor(Math.random() * pool.length)].w, l }); }
  fake.sort(() => Math.random() - .5).slice(0, 3).forEach(w => items.push({ w, l: -1 }));
  items.sort(() => Math.random() - .5);
  const yes = {}; let fakesYes = 0, i = 0;
  sheet("Word check", (b) => {
    const area = h("div", { class: "stack loose", style: { alignItems: "center", textAlign: "center" } });
    b.append(h("p", { class: "lead" }, "Do you know what each word means? Be honest. A few made-up words are mixed in."), area);
    const next = () => {
      if (i >= items.length) {
        let level = allowed[0];
        for (const l of allowed) if ((yes[l] || 0) >= 4) level = l;
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

// ---- Feed -----------------------------------------------------------------
route("feed", (main) => {
  const p = app.profile;
  const q = model.queue(p);
  let idx = 0, dir = "up";
  const back = [];
  const top = h("div", { class: "feed-top" });
  const stage = h("div", { class: "card-stage" });
  const feed = h("section", { class: "feed", "aria-label": "Word of the moment" }, stage);
  const actions = h("div", { class: "feed-actions" });
  main.append(top, feed, actions);

  const installGuide = app.device.install;
  // Suggest installing only where there's room for it; Family and Settings always offer it too
  if (installGuide.kind !== "installed" && installGuide.kind !== "unsupported" && innerHeight >= 700 && !localStorage.getItem("lumin-install-dismissed") && model.cards(p.id).length >= 3) {
    const bar = h("div", { class: "installbar" }, h("div", {},
      h("span", { class: "txt" }, h("strong", {}, "Install the app"), h("span", { class: "muted extra" }, " · full screen, works offline")),
      h("a", { class: "btn small primary", href: "#/install" }, "Show me"),
      h("button", { class: "iconbtn", "aria-label": "Dismiss", onclick: () => { localStorage.setItem("lumin-install-dismissed", "1"); bar.remove(); fit(); } }, icon("x"))));
    main.prepend(bar);
  }

  function header() {
    const n = model.todayCount(p.id), dueN = model.due(p.id).length;
    const cat = p.feedTopic, wide = app.device.layout === "wide";
    top.replaceChildren(
      h("a", { class: "topic catbtn", href: "#/categories", "aria-label": cat ? `Category: ${cat}. Change category` : "Choose a category" }, cat ? topicIcon(cat) : icon("grid", 18), cat || "All categories"),
      h("div", { class: "cluster", style: { "--gap": "var(--s3)" } },
        h("span", { class: "goal", "aria-label": `${Math.min(n, p.goal)} of ${p.goal} new words today` }, h("span", { class: "long" }, `${Math.min(n, p.goal)} of ${p.goal} today`), h("span", { class: "short", "aria-hidden": "true" }, `${Math.min(n, p.goal)}/${p.goal}`)),
        h("span", { class: "progress", "aria-hidden": "true" }, h("span", { style: { width: Math.min(100, n / p.goal * 100) + "%" } })),
        dueN && wide ? h("a", { href: "#/review", class: "goal" }, `${dueN} to review`) : null));
  }
  const word = () => q[idx];
  // Keep the whole card on screen: shrink type a little on short screens, and shrink long words to fit the width
  function fit() {
    const card = stage.querySelector(".wordcard"); if (!card) return;
    const wordEl = card.querySelector(".word:not(.msg)");
    if (wordEl) wordEl.style.fontSize = "";
    let k = 1; card.style.setProperty("--k", "1");
    card.querySelectorAll("[data-optional]").forEach((el) => { el.hidden = false; });
    const room = () => stage.clientHeight - 32;
    const shrink = (min) => { while (card.offsetHeight > room() && k > min) { k = Math.round((k - 0.04) * 100) / 100; card.style.setProperty("--k", String(k)); } };
    // Gentle shrink first; then drop the example (it's in More about this word); never go below readable sizes
    shrink(0.84);
    if (card.offsetHeight > room()) { card.querySelectorAll("[data-optional]").forEach((el) => { el.hidden = true; }); k = 1; card.style.setProperty("--k", "1"); shrink(0.8); }
    if (wordEl) fitWord(wordEl);
  }
  function show() {
    header();
    const w = word();
    if (!w) {
      const msg = p.feedTopic ? `That's every ${p.feedTopic.toLowerCase()} word for now.` : "That's every word at this level.";
      stage.replaceChildren(h("div", { class: "wordcard" }, h("p", { class: "word msg" }, msg),
        p.feedTopic ? null : h("p", { class: "def" }, "Amazing work. Try the next level up, or review the words you're learning."),
        h("div", { class: "actions", style: { marginTop: "var(--s5)" } },
          p.feedTopic ? [h("a", { class: "btn primary", href: "#/categories" }, "Pick another category"), h("button", { class: "btn", onclick: () => { model.saveProfile({ ...model.profile(p.id), feedTopic: null }); render(); } }, "Back to all words")]
            : [h("a", { class: "btn primary", href: "#/settings" }, "Change level"), h("a", { class: "btn", href: "#/review" }, "Review")])));
      actions.replaceChildren(); return;
    }
    const c = model.card(p.id, w.w);
    const fav = h("button", { class: "iconbtn", "aria-label": "Favorite", "aria-pressed": String(!!(c && c.fav)), onclick: (e) => { const on = model.toggleFav(p.id, w.w); e.currentTarget.setAttribute("aria-pressed", String(on)); toast(on ? "Saved to favorites" : "Removed from favorites"); } }, icon("heart"));
    const compact = app.device.layout !== "wide";
    const shareBtn = h("button", { class: "iconbtn", "aria-label": "Share this word", onclick: () => share(w) }, icon("share"));
    const card = h("article", { class: "wordcard enter-" + dir, "aria-live": "polite" },
      h("div", { class: "card-meta" }, topicChip(w.t), h("span", { class: "pos" }, w.p)),
      h("h1", { class: "word", lang: "en" }, w.w),
      h("div", { class: "say" }, w.s ? h("span", { class: "resp", "aria-label": "Sounds like " + w.s.replace(/-/g, " ") }, w.s) : null,
        canSpeak() ? h("button", { class: "iconbtn", "aria-label": `Hear ${w.w}`, onclick: () => speak(w.w, p) }, icon("speak")) : null,
        compact ? fav : null, compact ? shareBtn : null),
      h("p", { class: "def" }, w.d),
      w.e ? exampleWithMark(w) : null,
      h("button", { class: "linkbtn more", onclick: () => details(w.w) }, "More about this word"));
    stage.replaceChildren(card);
    const acted = c && (c.st === "learning" || c.st === "known");
    actions.replaceChildren(
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => act("know") }, icon("check"), acted && c.st === "known" ? "Known" : "I know it"),
        h("button", { class: "btn primary", onclick: () => act("learn") }, icon(acted && c.st === "learning" ? "review" : "plus"), acted && c.st === "learning" ? "Learning" : "Learn this"),
        compact ? null : fav, compact ? null : shareBtn),
      h("span", { class: "hint" }, app.device.keyboard && app.device.layout === "wide"
        ? ["Next word: ", h("span", { class: "kbd" }, "↓"), " or scroll · Learn: ", h("span", { class: "kbd" }, "L"), " · Know it: ", h("span", { class: "kbd" }, "K")]
        : app.device.touch ? "Swipe up for the next word" : "Scroll for the next word"));
    fit();
    if (p.readAloud) setTimeout(() => speak(w.w, p), 350);
  }
  function exampleWithMark(w) {
    const p1 = h("p", { class: "ex", "data-optional": "" });
    const re = new RegExp(`(\\b${model.escapeRe(w.w)}\\w*)`, "i");
    for (const part of w.e.split(re)) p1.append(re.test(part) && part.toLowerCase().startsWith(w.w.toLowerCase()) ? h("mark", {}, part) : part);
    return p1;
  }
  function act(kind) {
    const w = word(); if (!w) return;
    const prev = model.card(p.id, w.w);
    const before = model.todayCount(p.id);
    if (kind === "learn") model.learn(p.id, w.w); else model.know(p.id, w.w);
    haptic(); pulseReview();
    const after = model.todayCount(p.id);
    if (before < p.goal && after >= p.goal) setTimeout(() => toast(model.isKid(p) ? "You did it! Daily goal reached." : "Daily goal reached. Keep going, or come back tomorrow."), 500);
    else toast(kind === "learn" ? `Added "${w.w}" to your reviews` : `Marked "${w.w}" as known`, { label: "Undo", fn: () => { model.restoreCard(p.id, w.w, prev); idx = Math.max(0, idx - 1); dir = "down"; show(); } });
    next(true);
  }
  let moving = false;
  function leave(d, then) {
    const card = stage.querySelector(".wordcard");
    if (!card || reduced()) { then(); return; }
    moving = true; card.classList.remove("settle"); card.classList.add("leave-" + d);
    setTimeout(() => { moving = false; then(); }, 200);
  }
  function next(already) {
    const w = word(); if (!w || moving) return;
    if (!already) model.seen(p.id, w.w);
    leave("up", () => { back.push(idx); idx++; dir = "up"; show(); });
  }
  function prev() { if (!back.length || moving) return; leave("down", () => { idx = back.pop(); dir = "down"; show(); }); }

  function pulseReview() {
    const n = model.due(p.id).length + model.cards(p.id).filter(c => c.st === "learning" && c.srs && c.srs.reps === 0).length;
    document.querySelectorAll('.topnav a[href="#/review"], .bottomnav a[href="#/review"]').forEach((a) => {
      let b = a.querySelector(".count, .dot");
      if (!b) { b = h("span", { class: a.closest(".topnav") ? "count" : "dot" }); a.append(b); }
      b.textContent = String(n || ""); if (!n) { b.remove(); return; }
      b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
    });
  }
  // Swipe (the card follows your finger), wheel and keys
  let y0 = null, t0 = 0;
  const cardEl = () => stage.querySelector(".wordcard");
  feed.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" || e.target.closest("button, a")) return; y0 = e.clientY; t0 = Date.now(); const c = cardEl(); c && c.classList.remove("settle"); });
  feed.addEventListener("pointermove", (e) => {
    if (y0 == null || reduced()) return; const c = cardEl(); if (!c) return;
    const dy = e.clientY - y0, eased = dy * 0.55;
    c.style.transform = `translateY(${eased}px)`; c.style.opacity = String(Math.max(0.35, 1 - Math.abs(dy) / 500));
  });
  const release = (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; const v = Math.abs(dy) / Math.max(1, Date.now() - t0); y0 = null;
    const c = cardEl();
    const settle = () => { if (c) { c.classList.add("settle"); c.style.transform = ""; c.style.opacity = ""; } };
    if (dy < -60 || (dy < -24 && v > .5)) next();
    else if (dy > 60 || (dy > 24 && v > .5)) { if (back.length) prev(); else settle(); }
    else settle();
  };
  feed.addEventListener("pointerup", release);
  feed.addEventListener("pointercancel", release);
  feed.addEventListener("touchmove", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  let wheelAt = 0;
  feed.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) < 25 || Date.now() - wheelAt < 550) return; wheelAt = Date.now(); e.deltaY > 0 ? next() : prev(); }, { passive: true });
  const keys = (e) => {
    if (!document.body.contains(feed) || document.querySelector(".sheet") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "j" || (k === " " && document.activeElement === document.getElementById("main"))) { e.preventDefault(); next(); }
    else if (k === "arrowup" || (k === "k" && e.shiftKey)) { e.preventDefault(); prev(); }
    else if (k === "l") act("learn"); else if (k === "k") act("know");
    else if (k === "f") { const w = word(); if (w) { const on = model.toggleFav(p.id, w.w); toast(on ? "Saved to favorites" : "Removed from favorites"); show(); } }
    else if (k === "s") { const w = word(); w && speak(w.w, p); }
    else if (k === "enter" && document.activeElement === document.getElementById("main")) { const w = word(); w && details(w.w); }
  };
  let resizeT = 0;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(fit, 120); };
  addEventListener("keydown", keys);
  addEventListener("resize", onResize);
  addEventListener("hashchange", () => { removeEventListener("keydown", keys); removeEventListener("resize", onResize); }, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (document.body.contains(stage)) fit(); });
  show();
});

// ---- Categories ------------------------------------------------------------
route("categories", (main) => {
  const p = app.profile, counts = model.topicCounts(p);
  const pick = (t) => { model.saveProfile({ ...model.profile(p.id), feedTopic: t }); go("/feed"); toast(t ? `Showing ${t.toLowerCase()} words` : "Showing all categories"); };
  const topics = Object.keys(counts).filter(t => counts[t] >= 5).sort((a, b) => counts[b] - counts[a]);
  const allowed = model.levelsFor(p);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sample = (t) => model.WORDS.filter(w => (!t || w.t === t) && allowed.includes(w.l)).slice(0, 3).map(w => w.w).join(", ");
  const card = (t, label, n, ic, col) => {
    const on = (p.feedTopic || null) === t;
    return h("button", { class: "catcard", "aria-pressed": String(on), onclick: () => pick(t) },
      h("span", { class: "badge", style: { color: col } }, ic), h("span", { class: "cat-name" }, label),
      h("span", { class: "n" }, on ? [icon("check"), "Showing"] : plural(n, "word")), h("span", { class: "eg" }, sample(t)));
  };
  main.append(h("div", { class: "page" },
    h("div", { class: "page-head" }, h("h1", {}, "Categories"), h("p", { class: "lead" }, `Pick what you're in the mood for. Words stay at ${model.isKid(p) ? "kid-friendly levels" : "your level"}.`)),
    h("div", { class: "catgrid" },
      card(null, "All categories", total, icon("grid"), "var(--ink)"),
      topics.map(t => card(t, t, counts[t], topicIcon(t, 24), tint(t)))),
    footer()));
});

// ---- Word details --------------------------------------------------------
export function details(wordText) {
  const p = app.profile, w = model.lookup(wordText);
  if (!w) return;
  const part = (ic, title, ...kids) => h("div", { class: "stack tight" }, h("h3", { class: "sec-title" }, icon(ic, 18), title), ...kids);
  sheet(w.w, (b) => {
    const c = model.card(p.id, w.w);
    b.append(
      h("div", { class: "say" }, h("span", { class: "pos" }, w.p), w.s ? h("span", { class: "resp" }, w.s) : null,
        canSpeak() ? h("button", { class: "iconbtn", "aria-label": `Hear ${w.w}`, onclick: () => speak(w.w, p) }, icon("speak")) : null),
      part("book", "Meaning", h("p", { style: { fontSize: "var(--t-l)" } }, w.d)),
      w.e ? part("quote", "Examples", h("p", { class: "ex", style: { margin: 0 } }, w.e), w.e2 ? h("p", { class: "ex", style: { margin: 0 } }, w.e2) : null) : null,
      w.f && w.f.length ? part("branch", "Word family", h("div", { class: "chips" }, w.f.map(f => model.BY.get(f) ? h("button", { class: "chip", onclick: () => details(f) }, f) : h("span", { class: "chip" }, f)))) : null,
      w.m && w.m.length ? part("equal", "Similar words", h("p", {}, w.m.join(", "))) : null,
      part("sprout", "Level and topic", h("div", { class: "cluster", style: { "--gap": "var(--s2)" } }, w.custom ? topicChip("My words") : [h("span", { class: "topic" }, icon("sprout", 18), LEVEL(w.l).name), topicChip(w.t)])),
      h("div", { class: "actions" },
        h("button", { class: "btn small" + (c && c.st === "learning" ? "" : " primary"), onclick: () => { model.learn(p.id, w.w); toast(`Added "${w.w}" to your reviews`); closeSheet(); } }, c && c.st === "learning" ? "In your reviews" : "Learn this"),
        h("button", { class: "btn quiet", onclick: () => { const on = model.toggleFav(p.id, w.w); toast(on ? "Saved to favorites" : "Removed from favorites"); } }, icon("heart"), "Favorite"),
        h("button", { class: "btn quiet", onclick: () => share(w) }, icon("share"), "Share"),
        h("button", { class: "btn quiet", onclick: () => listPicker(w.w) }, icon("folder"), "Add to a list")),
      h("p", { class: "muted small" }, w.custom ? "Added by you. " : w.l >= 2 ? "Definition and examples adapted from Open English WordNet (CC BY 4.0). " : "Written for Lumin Vocab. ", h("a", { href: "#/about", onclick: () => closeSheet() }, "Credits")));
  });
}
function listPicker(word) {
  const p = app.profile;
  sheet("Add to a list", (b) => {
    const list = h("div", { class: "panel list", style: { background: "var(--bg)" } });
    const draw = () => {
      list.replaceChildren();
      const cols = model.collections(p.id);
      if (!cols.length) list.append(h("p", { class: "muted", style: { padding: "var(--s4) 0" } }, "No lists yet. Make one for a book, a trip or a test."));
      for (const col of cols) list.append(h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, col.name), h("small", {}, plural(col.words.length, "word") + (col.shared ? ", shared with family" : ""))),
        h("input", { type: "checkbox", checked: col.words.includes(word), onchange: () => model.toggleInCollection(model.collections(p.id).find(x => x.id === col.id), word) })));
    };
    draw();
    b.append(list, h("button", { class: "btn quiet start", onclick: async () => { const name = await ask("New list", { label: "Name", confirm: "Create", maxlength: 40 }); if (name && name.trim()) { const col = model.newCollection(p.id, name.trim()); model.toggleInCollection(col, word); toast(`Added to ${col.name}`); } } }, icon("plus"), "New list"));
  });
}

// ---- Review -----------------------------------------------------------------
route("review", (main, args) => {
  const p = app.profile, kid = model.isKid(p);
  let items = [];
  let title = "Review";
  if (args[0] === "col") {
    const col = model.collections(p.id).find(c => c.id === args[1]);
    if (col) { title = col.name; items = col.words.map(w => model.card(p.id, w) || { pid: p.id, w, srs: null }); }
  } else if (args[0] === "practice") {
    items = model.cards(p.id).filter(c => c.st === "learning" && c.srs).sort((a, b) => a.srs.s - b.srs.s).slice(0, 10);
    title = "Practice";
  } else items = model.due(p.id).slice(0, p.reviewSize || 20);
  items = items.filter(c => model.lookup(c.w));
  const wrap = h("section", { class: "review" + (kid ? " kidmode" : ""), "aria-label": title });
  main.append(wrap);
  if (!items.length) {
    const nd = model.nextDue(p.id), any = model.cards(p.id).some(c => c.st === "learning");
    wrap.append(h("div", { class: "q" }, h("div", { class: "prompt" },
      h("p", { class: "big" }, any ? "All caught up." : "Nothing to review yet."),
      h("p", { class: "note" }, any ? (nd ? `Your next review is ${untilText(nd)}. Reviewing at the right time is what makes words stick.` : "") : "Tap Learn this on a few words, and they'll show up here at just the right times.")),
      h("div", { class: "actions center-x" },
        any ? h("a", { class: "btn", href: "#/review/practice" }, "Practice anyway") : null, h("a", { class: "btn primary", href: "#/feed" }, "Learn new words"))));
    return;
  }
  const queue = items.map(c => ({ c, retry: false }));
  const total = queue.length;
  let done = 0, right = 0, stronger = 0, mastered = 0;
  const results = [];
  const graded = new Set();
  function step() {
    const it = queue.shift();
    if (!it) return summary();
    const c = model.card(p.id, it.c.w) || it.c;
    const ex = model.exercise(p, c, it.retry ? "meaning" : null);
    if (!ex) return step();
    const start = Date.now(); let hinted = false, answered = false;
    const fb = h("div", { class: "feedback", role: "status" });
    const nextBtn = h("button", { class: "btn primary", hidden: true, onclick: () => step() }, queue.length ? "Next" : "Finish");
    const kickers = { meaning: "What does this word mean?", word: "Which word means", blank: "Which word fits?", spell: "Type the word that means" };
    const big = h("p", { class: "big" });
    if (ex.type === "blank") { const [a, b] = ex.prompt.split("_____"); big.append(a, h("span", { class: "blank", "aria-label": "blank" }), b); }
    else big.append(ex.type === "meaning" ? h("span", { lang: "en" }, ex.prompt) : ex.prompt);
    const readOut = () => speak(ex.type === "meaning" ? ex.word.w : `${kickers[ex.type]}: ${ex.prompt.replace("_____", "blank")}`, p);
    const kIcon = { meaning: "book", word: "search", blank: "quote", spell: "t-mine" }[ex.type];
    const promptEl = h("div", { class: "prompt" }, h("span", { class: "kicker" }, icon(kIcon), kickers[ex.type]), big,
      canSpeak() ? h("button", { class: "iconbtn", "aria-label": "Read it aloud", onclick: readOut }, icon("speak")) : null);
    function finish(correct) {
      if (answered) return; answered = true;
      const ms = Date.now() - start;
      if (correct) right++;
      if (!it.retry) results.push({ w: ex.word.w, ok: correct });
      haptic(correct ? 8 : [12, 60, 12]);
      if (!graded.has(ex.word.w)) {
        graded.add(ex.word.w);
        const before = c.srs ? c.srs.s : 0;
        const after = model.grade(p.id, ex.word.w, srs.gradeFor(correct, ms, hinted));
        if (after.srs.s > before) stronger++;
        if (srs.isMastered(after.srs) && !srs.isMastered(c.srs)) mastered++;
      }
      if (!correct && !it.retry) queue.push({ c, retry: true });
      done = total - queue.filter(x => !x.retry).length;
      bar.style.width = Math.round(done / total * 100) + "%";
      count.textContent = `${Math.min(done, total)} of ${total}`;
      const praise = kid ? ["Yes!", "You got it!", "Great job!", "Nice!"] : ["Right.", "That's it.", "Correct.", "Nice."];
      fb.className = "feedback " + (correct ? "ok" : "no");
      if (correct) fb.replaceChildren(h("strong", {}, praise[Math.floor(Math.random() * praise.length)]), kid && ex.word.e ? h("span", {}, ex.word.e) : null);
      else fb.replaceChildren(h("strong", {}, `The answer is “${ex.word.w}”`), ex.type === "meaning" ? null : h("span", {}, ex.word.d));
      nextBtn.hidden = false; nextBtn.textContent = queue.length ? "Next" : "Finish";
      setTimeout(() => nextBtn.focus(), 30);
    }
    let body;
    if (ex.type === "spell") {
      const input = h("input", { type: "text", "aria-label": "Your answer", autocomplete: "off", autocapitalize: "none", spellcheck: "false" });
      const hint = h("button", { class: "linkbtn", type: "button", onclick: () => { hinted = true; input.placeholder = ex.word.w[0] + "…" + ` (${ex.word.w.length} letters)`; input.focus(); } }, "Hint");
      body = h("div", { class: "stack tight", style: { alignItems: "center" } },
        h("form", { class: "typed", onsubmit: (e) => { e.preventDefault(); if (answered) return step(); const ok = input.value.trim().toLowerCase() === ex.word.w.toLowerCase(); input.disabled = true; finish(ok); } }, input, h("button", { class: "btn primary", type: "submit" }, "Check")),
        hint);
      setTimeout(() => input.focus(), 50);
    } else {
      body = h("div", { class: "options" + (ex.type === "meaning" ? " defs" : ""), role: "group", "aria-label": "Answers" });
      ex.options.forEach((o, i) => body.append(h("button", { class: "opt" + (ex.type === "meaning" ? " def-opt" : ""), "data-right": o.right ? "1" : "0", onclick: (e) => {
        if (answered) return;
        e.currentTarget.classList.add(o.right ? "right" : "wrong");
        e.currentTarget.prepend(h("span", { class: "mark" }, icon(o.right ? "check" : "x", 22)));
        if (!o.right) { const r = body.querySelector('[data-right="1"]'); r.classList.add("right"); r.prepend(h("span", { class: "mark" }, icon("check", 22))); }
        [...body.children].forEach(b => { b.setAttribute("aria-disabled", "true"); const k = b.querySelector(".kbd"); k && k.remove(); });
        finish(o.right);
      } }, app.device.keyboard && app.device.layout === "wide" ? h("span", { class: "kbd", "aria-hidden": "true" }, String(i + 1)) : null, h("span", {}, o.text))));
    }
    q.replaceChildren(promptEl, body, fb, h("div", { class: "actions center-x" }, nextBtn));
    if (p.readAloud) setTimeout(readOut, 300);
  }
  function summary() {
    removeEventListener("keydown", keys);
    bar.style.width = "100%";
    q.replaceChildren(h("div", { class: "prompt" },
      h("p", { class: "big" }, kid ? "You did it!" : "Nice work."),
      h("p", { class: "note" }, `${right} correct out of ${total + queue.length}. ${plural(stronger, "word")} got stronger${mastered ? `, and ${mastered} ${mastered === 1 ? "is" : "are"} now mastered` : ""}.`)),
      h("div", { class: "results", "aria-label": "Your answers" }, results.map(r => h("button", { class: "chip " + (r.ok ? "ok" : "no"), onclick: () => details(r.w) }, icon(r.ok ? "check" : "review", 18), r.w))),
      h("div", { class: "actions center-x" }, h("a", { class: "btn primary", href: "#/feed" }, "Back to words"), h("a", { class: "btn", href: "#/saved" }, "See my words")));
  }
  const bar = h("span", { style: { width: "0%" } });
  const count = h("span", { class: "count-label" }, `0 of ${total}`);
  const q = h("div", { class: "q" });
  wrap.append(h("div", { class: "review-top" }, h("a", { class: "iconbtn", href: "#/feed", "aria-label": "End review" }, icon("x")),
    h("div", { class: "bar", role: "progressbar", "aria-label": "Review progress" }, bar), count), q);
  const keys = (e) => {
    if (!document.body.contains(wrap) || document.querySelector(".sheet") || /INPUT/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = parseInt(e.key, 10);
    const opts = q.querySelectorAll(".opt");
    if (n >= 1 && n <= opts.length) opts[n - 1].click();
  };
  addEventListener("keydown", keys);
  addEventListener("hashchange", () => removeEventListener("keydown", keys), { once: true });
  step();
});

// ---- Saved ------------------------------------------------------------------
route("saved", (main, args) => {
  const p = app.profile;
  let tab = args[0] === "collections" ? "lists" : args[0] || "favorites", limit = 60;
  const st = model.stats(p.id);
  const search = h("input", { type: "search", id: "saved-search", placeholder: "Search every word", "aria-label": "Search every word in Lumin Vocab", enterkeyhint: "search" });
  const out = h("div", { class: "stack" });
  const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Saved words" });
  const tile = (w, meta) => { const word = model.lookup(w); const t = word ? (word.custom ? "My words" : word.t) : "Describing";
    return h("button", { class: "tile", onclick: () => details(w) }, h("span", { class: "top" }, h("span", { class: "w" }, w), topicIcon(t)), h("span", { class: "m" }, meta)); };
  const empty = (ic, text) => h("div", { class: "empty" }, icon(ic, 22), h("p", {}, text));
  const stateLabel = (c) => c.st === "learning" ? (srs.isMastered(c.srs) ? "Mastered" : "Learning") : c.st === "known" ? "Known" : "Seen";
  function drawTab() {
    const add = (...k) => out.append(...k.flat().filter(Boolean));
    tabs.replaceChildren(...[["favorites", "Favorites", "heart"], ["lists", "Lists", "folder"], ["history", "History", "history"], ["mine", "My words", "t-mine"]].map(([k, l, ic]) =>
      h("button", { role: "tab", "aria-selected": String(tab === k), onclick: () => { tab = k; limit = 60; drawTab(); } }, icon(ic, 18), l)));
    out.replaceChildren();
    const q = search.value.trim().toLowerCase();
    if (q) {
      const hits = model.WORDS.filter(w => w.w.startsWith(q)).concat(model.WORDS.filter(w => !w.w.startsWith(q) && w.w.includes(q))).slice(0, 48);
      const mine = model.customWords(p.id).filter(c => c.w.toLowerCase().includes(q));
      add(h("p", { class: "muted" }, hits.length + mine.length ? plural(hits.length + mine.length, "word") + " found" : "No words found. You can add it as your own word."),
        h("div", { class: "grid" }, mine.map(c => tile(c.w, "Your word")), hits.map(w => tile(w.w, `${LEVEL(w.l).name} · ${w.p}`))),
        !hits.find(w => w.w === q) ? h("button", { class: "btn quiet start", onclick: () => addWord(q) }, icon("plus"), `Add "${q}" as your own word`) : null);
      return;
    }
    if (tab === "favorites") {
      const favs = model.cards(p.id).filter(c => c.fav).sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
      add(favs.length ? h("div", { class: "grid" }, favs.map(c => tile(c.w, stateLabel(c)))) : empty("heart", "Tap the heart on any word to keep it here."));
    } else if (tab === "lists") {
      const cols = model.collections(p.id);
      add(cols.length ? h("div", { class: "stack", style: { "--gap": "var(--s2)" } }, cols.map(col => h("div", { class: "colrow" },
        h("button", { onclick: () => openList(col.id) }, h("strong", {}, col.name), h("span", { class: "muted small" }, plural(col.words.length, "word") + (col.shared ? ", shared with family" : ""))),
        col.words.length ? h("a", { class: "btn small quiet", href: `#/review/col/${col.id}` }, "Quiz me") : null))) : empty("folder", "Make a list for a book you're reading, a trip, or a spelling test."),
        h("button", { class: "btn quiet start", onclick: async () => { const name = await ask("New list", { label: "Name", confirm: "Create", maxlength: 40 }); if (name && name.trim()) { model.newCollection(p.id, name.trim()); drawTab(); } } }, icon("plus"), "New list"));
    } else if (tab === "history") {
      const hist = model.cards(p.id).sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
      add(hist.length ? h("div", { class: "grid" }, hist.slice(0, limit).map(c => tile(c.w, `${stateLabel(c)} · ${relTime(c.seenAt)}`))) : empty("history", "Words you see will be listed here, with no limit."),
        hist.length > limit ? h("button", { class: "btn quiet start", onclick: () => { limit += 120; drawTab(); } }, `Show more (${hist.length - limit})`) : null);
    } else {
      const mine = model.customWords(p.id);
      add(mine.length ? h("div", { class: "grid" }, mine.map(c => tile(c.w, c.d.length > 60 ? c.d.slice(0, 58).trim() + "…" : c.d))) : empty("t-mine", "Found a great word while reading? Add it, and it joins your reviews."),
        h("button", { class: "btn primary start", onclick: () => addWord("") }, icon("plus"), "Add your own word"));
    }
  }
  search.addEventListener("input", drawTab);
  const tot = Math.max(1, st.learning + st.mastered + st.known), parts = [[st.mastered, "mastered", "var(--c6)"], [st.learning, "learning", "var(--accent)"], [st.known, "already known", "var(--c5)"]];
  main.append(h("div", { class: "page" },
    h("div", { class: "page-head" }, h("h1", {}, "Saved"),
      h("div", { class: "summary" }, h("div", { class: "summary-line" }, parts.map(([n, l, col]) => h("span", {}, h("span", { class: "dotkey", style: { background: col } }), h("b", {}, String(n)), l))),
        h("div", { class: "segbar", role: "img", "aria-label": `${st.mastered} mastered, ${st.learning} learning, ${st.known} already known` }, parts.map(([n, , col]) => h("span", { style: { width: (n / tot * 100) + "%", background: col } }))))),
    h("div", { class: "stack" }, search, tabs, out), footer()));
  drawTab();
});
function openList(id) {
  const p = app.profile;
  const col = model.collections(p.id).find(c => c.id === id); if (!col) return;
  sheet(col.name, (b) => {
    b.append(col.words.length ? h("div", { class: "chips" }, col.words.map(w => h("button", { class: "chip", onclick: () => details(w) }, w))) : h("p", { class: "muted" }, "Add words from any word's details."),
      h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Share with family"), h("small", {}, "Everyone in your family can see and quiz this list")),
        h("input", { type: "checkbox", checked: !!col.shared, onchange: (e) => model.saveCollection({ ...col, shared: e.target.checked }) })),
      h("div", { class: "actions" },
        col.words.length ? h("a", { class: "btn small primary", href: `#/review/col/${col.id}`, onclick: () => closeSheet() }, "Quiz me") : null,
        h("button", { class: "btn quiet", onclick: async () => { const n = await ask("Rename list", { label: "Name", confirm: "Save", maxlength: 40 }); if (n && n.trim()) { model.saveCollection({ ...col, name: n.trim() }); render(); } } }, "Rename"),
        h("button", { class: "btn quiet", onclick: async () => { if (await confirmBox("Delete this list?", `"${col.name}" will be removed. The words stay in your history.`, "Delete", true)) { store.remove("col:" + col.id); render(); } } }, "Delete")));
  });
}
function addWord(prefill) {
  const p = app.profile;
  sheet("Add your own word", (b) => {
    const w = h("input", { type: "text", id: "cw-w", maxlength: 40, autocomplete: "off", autocapitalize: "none", value: prefill });
    const pos = h("select", { id: "cw-p" }, ["noun", "verb", "adjective", "adverb", "phrase"].map(x => h("option", { value: x }, x)));
    const d = h("textarea", { id: "cw-d", maxlength: 240, rows: 3 });
    const e = h("textarea", { id: "cw-e", maxlength: 240, rows: 2 });
    const note = h("small", {});
    const fill = () => { const hit = model.BY.get(w.value.trim().toLowerCase()); if (hit) { if (!d.value) d.value = hit.d; if (!e.value) e.value = hit.e || ""; pos.value = ["noun", "verb", "adjective", "adverb"].includes(hit.p) ? hit.p : "phrase"; note.textContent = "Filled in from Lumin Vocab. Edit anything you like."; } };
    w.addEventListener("change", fill); w.addEventListener("blur", fill);
    b.append(h("form", { class: "stack loose", onsubmit: (ev) => {
      ev.preventDefault();
      const word = w.value.trim();
      if (!word || !d.value.trim()) { toast("Add the word and what it means"); return; }
      if (model.BY.get(word.toLowerCase())) { model.learn(p.id, word.toLowerCase()); toast(`"${word}" is already in Lumin Vocab. Added to your reviews.`); closeSheet(); render(); return; }
      model.addCustom(p.id, { w: word, p: pos.value, d: d.value.trim(), e: e.value.trim() });
      toast(`Added "${word}"`); closeSheet(); render();
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
          h("strong", {}, "Add a device"), h("p", { class: "muted" }, app.device.form === "desktop" ? "Scan this with the phone or tablet's camera. Or open the site there, choose Join your family, and type the code." : "Scan this from another device's camera, or type the code there."),
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

    if (app.device.install.kind !== "installed") page.append(h("div", { class: "panel" }, h("div", { class: "split" },
      h("span", { class: "cluster", style: { "--gap": "var(--s3)", flexWrap: "nowrap" } }, icon(app.device.form === "desktop" ? "desktop" : "phone"), h("span", { class: "stack", style: { "--gap": "2px" } }, h("strong", {}, "Install on this device"), h("span", { class: "muted small" }, "Opens full screen and works offline."))),
      h("a", { class: "btn small primary", href: "#/install" }, "Show me how"))));
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
    const rolesBox = h("div", { class: "chips" }), levelBox = h("div", { class: "choices compact" }), colorBox = h("div");
    const draw = () => {
      rolesBox.replaceChildren(...Object.entries(model.ROLES).map(([k, l]) => h("button", { class: "chip", "aria-pressed": String(role === k), onclick: () => { role = k; draw(); } }, l)));
      levelBox.replaceChildren(...model.LEVELS.map((L, i) => h("button", { class: "choice", "aria-pressed": String(level === i), onclick: () => { level = i; draw(); } }, h("span", { class: "ttl" }, L.name), h("span", { class: "sub" }, L.ages))));
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
          if (!(await confirmBox(`Remove ${p.name}?`, "Their words and progress will be deleted on every synced device. This can't be undone, except from a backup file.", "Remove", true))) return;
          if (p.manager && !others.some(o => o.manager)) model.saveProfile({ ...others[0], manager: true });
          model.removeProfile(id); if (app.pid === id) app.pid = null; render();
        } }, "Remove profile") : null));
  });
}

// ---- Settings (adapts to who is using it and to the device) ----------------
route("settings", (main) => {
  const p = app.profile, f = model.family();
  const kid = p.role === "kid";
  const lockedKid = kid && !!f.pin && !app.unlocked;
  const save = (patch) => { model.saveProfile({ ...model.profile(p.id), ...patch }); Object.assign(p, patch); applyLook(); };
  const page = h("div", { class: "page narrow" });
  main.append(page);
  const SEC = { "My look": ["palette", 2], Look: ["palette", 2], "Reading help": ["speak", 5], Sound: ["speak", 5], Learning: ["target", 6], Profile: ["t-people", 1], "Family controls": ["shield", 4], "This device": [app.device.form === "desktop" ? "desktop" : "phone", 5], "Keyboard shortcuts": ["keyboard", 1], "Your data": ["lock", 3], About: ["info", 1] };
  const sec = (title, ...kids) => { const [ic, c] = SEC[title] || ["info", 1]; return section(title, ic, `var(--c${c})`, h("div", { class: "panel" }, ...kids)); };
  const sw = (title, sub, checked, onchange, id) => h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, title), sub ? h("small", {}, sub) : null), h("input", { type: "checkbox", id, checked, onchange: (e) => onchange(e.target.checked) }));
  const pressOne = (e, sel) => { e.currentTarget.parentNode.querySelectorAll(sel).forEach(c => c.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); };
  const seg = (label, opts, value, onpick) => h("div", { class: "field" }, h("span", { class: "flabel" }, label), h("div", { class: "chips", role: "group", "aria-label": label },
    opts.map(([v, l]) => h("button", { class: "chip", "aria-pressed": String(value === v), onclick: (e) => { onpick(v); pressOne(e, ".chip"); } }, l))));

  // Header card
  const st = model.stats(p.id);
  page.append(h("div", { class: "panel who-card" }, avatar(p, "md"),
    h("div", { class: "grow" }, h("h1", { class: "page-title" }, p.name), meta(LEVEL(p.level).name, model.ROLES[p.role] || "Adult", p.manager ? "Parent" : null, `${st.learning + st.mastered} learning`)),
    h("a", { class: "btn small quiet", href: "#/who" }, "Switch profile")));

  // Look (everyone, kids first)
  const themes = h("div", { class: "theme-grid", role: "group", "aria-label": "Theme" }, model.THEMES.map(([k, name, bg, ink]) => h("button", { class: "theme", "aria-pressed": String(p.theme === k), onclick: (e) => { save({ theme: k }); pressOne(e, ".theme"); } },
    h("span", { class: "sw", style: { backgroundColor: bg, backgroundImage: `url(/scenes/${k}.svg)`, color: ink } }, "luminous"), h("span", { class: "nm" }, name))));
  const scale = h("input", { type: "range", id: "set-scale", min: "0.9", max: "1.3", step: "0.05", value: String(p.scale || (model.isKid(p) ? 1.08 : 1)), oninput: (e) => save({ scale: parseFloat(e.target.value) }) });
  const avatarPick = swatches(p.color, (i) => { save({ color: i }); render(); });
  page.append(sec(kid ? "My look" : "Look",
    h("div", { class: "field" }, h("span", { class: "flabel" }, "Theme"), themes),
    h("div", { class: "field" }, h("label", { for: "set-scale" }, "Text size"), h("div", { class: "range-row" }, h("span", { "aria-hidden": "true", class: "small muted" }, "A"), scale, h("span", { "aria-hidden": "true", style: { fontSize: "22px" }, class: "muted" }, "A"))),
    kid ? h("div", { class: "field" }, h("span", { class: "flabel" }, "My color"), avatarPick) : null,
    lockedKid ? null : seg("Dark mode", [["device", "Match device"], ["sunset", "After sunset"], ["off", "Never"]], p.dark || "device", (v) => save({ dark: v })),
    lockedKid ? null : (() => { const sys = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const el = sw("Calmer motion", sys ? "On, because this device asks for less motion" : "Fewer animations when moving between words", sys || !!p.calm, (v) => save({ calm: v }));
      if (sys) el.querySelector("input").disabled = true; return el; })()));

  // Sound
  if (canSpeak()) {
    const vs = voices();
    page.append(sec(kid ? "Reading help" : "Sound",
      sw("Read words aloud", kid ? "Hear each new word and review question" : "Hear each new word as it appears", !!p.readAloud, (v) => save({ readAloud: v })),
      lockedKid || !vs.length ? null : h("div", { class: "field" }, h("label", { for: "set-voice" }, "Voice"),
        h("select", { id: "set-voice", onchange: (e) => { save({ voice: e.target.value }); speak("luminous", p); } }, h("option", { value: "" }, "Automatic"), vs.map(v => h("option", { value: v.name, selected: p.voice === v.name }, `${v.name} (${v.lang})`))),
        h("small", {}, `Voices come from this ${LABELS.os[app.device.os]}, so they can differ between devices.`)),
      lockedKid ? null : h("div", { class: "field" }, h("label", { for: "set-rate" }, "Speaking speed"), h("input", { type: "range", id: "set-rate", min: "0.6", max: "1.2", step: "0.05", value: String(p.rate || 0.9), onchange: (e) => { save({ rate: parseFloat(e.target.value) }); speak("luminous", p); } })),
      h("button", { class: "btn small quiet start", onclick: () => speak("Lumin Vocab. Luminous.", p) }, icon("speak"), "Test")));
  }

  if (lockedKid) {
    page.append(h("button", { class: "btn quiet start", onclick: async () => { if (await guard("Grown-up settings")) render(); } }, icon("lock"), "Grown-up settings"), footer());
    return;
  }

  // Learning (first for teens and adults, after the fun stuff for kids)
  const learnSec = sec("Learning",
    h("div", { class: "field" }, h("span", { class: "flabel" }, "Level"), h("div", { class: "choices compact", role: "group", "aria-label": "Level" }, model.LEVELS.map((L, i) =>
      h("button", { class: "choice", "aria-pressed": String(p.level === i), onclick: (e) => { save({ level: i }); pressOne(e, ".choice"); } }, h("span", { class: "ttl" }, L.name), h("span", { class: "sub" }, L.ages))))),
    h("div", { class: "field" }, h("span", { class: "flabel" }, "Favorite topics"), h("div", { class: "chips" }, model.TOPICS.map(t => h("button", { class: "chip", "aria-pressed": String((p.topics || []).includes(t)), onclick: (e) => { const cur = model.profile(p.id).topics || []; const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]; save({ topics: next }); e.currentTarget.setAttribute("aria-pressed", String(next.includes(t))); } }, topicIcon(t), t)))),
    seg("New words a day", [[3, "3"], [5, "5"], [10, "10"], [15, "15"]], p.goal, (v) => save({ goal: v })),
    seg("Words per review", [[10, "10"], [20, "20"], [30, "30"]], p.reviewSize || 20, (v) => save({ reviewSize: v })),
    kid ? null : sw("Spelling practice", "Some reviews ask you to type the word", p.spelling !== false, (v) => save({ spelling: v })),
    h("button", { class: "linkbtn start", onclick: () => wordCheck(p.role, (l) => { save({ level: l }); toast(`Level set to ${model.LEVELS[l].name}`); render(); }) }, "Take the word check again"));
  if (kid) page.append(learnSec); else page.insertBefore(learnSec, page.children[1]);

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
      [[["↓"], "Next word"], [["↑"], "Previous word"], [["L"], "Learn this"], [["K"], "I know it"], [["F"], "Favorite"], [["S"], "Say it"], [["1", "4"], "Answer in review"], [["Esc"], "Close a panel"]]
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
    h("div", { class: "actions" }, h("a", { class: "btn small quiet", href: "#/about" }, "Credits and licenses"), h("a", { class: "btn small quiet", href: SOURCE, rel: "noopener" }, "Source code"))), footer());
});

// ---- Install (tailored to the device) ----------------------------------------
route("install", (main) => {
  const d = app.device, g = d.install;
  const place = d.form === "desktop" ? "this computer" : `your ${LABELS.os[d.os] === "this device" ? "device" : LABELS.os[d.os]}`;
  const page = h("div", { class: "page narrow" });
  main.append(page);
  const ic = { share: "share", plus: "plusbox", menu: "menu", check: "check" };
  const stepsList = (steps) => h("ol", { class: "steps" }, steps.map(s => h("li", {}, h("span", { class: "ic" }, icon(ic[s.icon] || "check")), h("span", {}, s.text))));
  const draw = () => {
    const head = h("div", { class: "page-head" }, h("img", { src: "/icons/logo.svg", alt: "", width: 56, height: 56, style: { borderRadius: "14px", marginBottom: "var(--s3)" } }));
    page.replaceChildren(head);
    if (g.kind === "installed") {
      head.append(h("h1", {}, "You're using the app"), h("p", { class: "lead" }, "Lumin Vocab is installed on this device. It opens full screen and works offline."));
      page.append(h("a", { class: "btn primary start", href: "#/feed" }, "Back to words"));
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
        h("li", {}, "Sprout and Explorer definitions and examples: written for Lumin Vocab by B7 Collective."),
        h("li", {}, "Scholar and Wordsmith definitions and examples: adapted from ", h("a", { href: "https://en-word.net", rel: "noopener" }, "Open English WordNet"), " by the Open English WordNet Community, CC BY 4.0. WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved. THIS SOFTWARE AND DATABASE IS PROVIDED \"AS IS\" AND PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED."),
        h("li", {}, "Pronunciation respellings: generated from the CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University, BSD 2-Clause License."),
        h("li", {}, "Word difficulty: ranked using word frequencies from wordfreq by Robyn Speer (data CC BY-SA 4.0), which includes data from Google Books Ngram, OpenSubtitles, SUBTLEX by Marc Brysbaert et al., and other sources."),
        h("li", {}, "Family-safe filtering: helped by the List of Dirty, Naughty, Obscene, and Otherwise Bad Words, CC BY 4.0."))),
    h("div", { class: "panel" }, h("h2", {}, "Other parts"),
      h("ul", { class: "credits" },
        h("li", {}, "Review scheduling: based on the FSRS algorithm by the open-spaced-repetition project (MIT)."),
        h("li", {}, "Fonts: Literata (SIL Open Font License 1.1) and Atkinson Hyperlegible by the Braille Institute (SIL Open Font License 1.1)."),
        h("li", {}, "QR codes: qrcode-generator by Kazuhiko Arase (MIT). QR Code is a registered trademark of DENSO WAVE INCORPORATED."))),
    h("a", { class: "textlink start", href: app.profile ? "#/settings" : "#/welcome" }, "Back"), footer()));
});
