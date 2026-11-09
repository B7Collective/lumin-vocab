// Lumin Vocab: screens.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as store from "./store.js";
import * as model from "./model.js";
import * as sync from "./sync.js";
import * as srs from "./srs.js";
import { LABELS } from "./device.js";
import { app, route, go, render, selectProfile, applyLook, VERSION } from "./app.js";
import { h, icon, avatar, toast, sheet, closeSheet, ask, confirmBox, speak, canSpeak, voices, share, relTime, untilText, download, topicChip, topicIcon, tint, badge } from "./ui.js";
import qrcode from "./vendor/qrcode.mjs";

const SITE = "https://lumin.b7collective.com";
const SOURCE = "https://github.com/B7Collective/lumin-vocab";
const LEVEL = (l) => model.LEVELS[l] || model.LEVELS[3];

function footer() {
  return h("footer", { class: "footer" }, "Made by ", h("a", { href: "https://b7collective.com", rel: "noopener" }, "B7 Collective"), " · ",
    h("a", { href: "/privacy.html" }, "Privacy"), " · ", h("a", { href: "#/about" }, "Credits"), " · ", h("a", { href: SOURCE, rel: "noopener" }, "Source code"));
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
  const pin = await ask(reason, { label: "Family PIN", type: "password", inputmode: "numeric", confirm: "Unlock", maxlength: 12 });
  if (pin == null) return false;
  if (await model.checkPin(pin)) { app.unlocked = true; return true; }
  toast("That PIN didn't match"); return false;
}

// ---- Welcome -------------------------------------------------------------
route("welcome", (main) => {
  main.append(h("div", { class: "center" },
    h("img", { src: "/icons/logo.svg", alt: "", width: 88, height: 88, style: { borderRadius: "20px" } }),
    h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", maxWidth: "560px" } },
      h("h1", { class: "serif", style: { margin: 0, fontWeight: 400, fontSize: "clamp(34px,6vw,52px)", lineHeight: 1.1 } }, "A new word every day, for the whole family."),
      h("p", { class: "lead" }, "One calm word at a time, real review that makes words stick, and levels for every age. No ads, no accounts, nothing to buy.")),
    h("div", { class: "preview", "aria-hidden": "true" }, h("div", { class: "card-meta" }, topicChip("Describing"), h("span", { class: "pos" }, "adjective")),
      h("span", { class: "word", style: { fontSize: "clamp(44px,8vw,64px)", margin: 0 } }, "luminous"), h("span", { class: "muted" }, "LOO-muh-nuhs"),
      h("p", { style: { margin: "6px 0 0", fontSize: "19px" } }, "giving off light, or glowing in the dark")),
    h("div", { class: "features" },
      [["sprout", "Levels for every age", "Kid-friendly words and definitions up to grown-up vocabulary."], ["review", "Review that sticks", "Words come back right before you'd forget them."],
       ["family", "The whole family", "Everyone gets their own profile, synced privately across devices."]].map(([ic, t, d]) => h("div", { class: "feature" }, badge(ic), h("div", {}, h("strong", {}, t), h("span", { class: "muted" }, d))))),
    h("div", { style: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" } },
      h("a", { class: "btn primary", href: "#/setup", style: { minWidth: "240px" } }, "Get started"),
      h("a", { class: "linkbtn", href: "#/join" }, "Already use it on another device? Join your family"))),
    footer());
});

// ---- Join a family ---------------------------------------------------------
route("join", (main) => {
  const pre = sessionStorage.getItem("lumin-join") || "";
  const input = h("input", { type: "text", id: "join-code", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "six words from your family code", value: pre.replace(/-/g, " ") });
  const msg = h("p", { class: "muted", role: "status" });
  const btn = h("button", { class: "btn primary", type: "submit" }, "Join");
  main.append(h("div", { class: "page narrow" },
    h("h1", {}, "Join your family"),
    h("p", { class: "lead" }, "On a device that already has Lumin Vocab, open Family and show the code. Scan the QR code with this device's camera, or type the six words here."),
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
    } }, h("div", { class: "field" }, h("label", { for: "join-code" }, "Family code"), input), h("div", {}, btn), msg),
    h("p", { class: "muted" }, "Your code unlocks your family's data on this device. It is never sent to our server, and everything is encrypted before it leaves your device."),
    model.profiles().length ? h("a", { href: "#/family" }, "Back") : h("a", { href: "#/welcome" }, "Back")));
  setTimeout(() => input.focus(), 50);
});

// ---- Who's learning --------------------------------------------------------
route("who", (main) => {
  const f = model.family();
  const people = h("div", { class: "people" });
  for (const p of model.profiles()) {
    people.append(h("button", { class: "person", onclick: async () => {
      if (p.manager && f.pin && f.lockParents && app.pid !== p.id) {
        const pin = await ask(`Open ${p.name}'s profile`, { label: "Family PIN", type: "password", inputmode: "numeric", confirm: "Open", maxlength: 12 });
        if (pin == null) return;
        if (!(await model.checkPin(pin))) { toast("That PIN didn't match"); return; }
      }
      selectProfile(p.id);
    } }, avatar(p, "lg"), h("span", { class: "n" }, p.name), h("span", { class: "lv" }, LEVEL(p.level).name)));
  }
  people.append(h("button", { class: "person", onclick: async () => { if (await guard("Adding a profile needs a grown-up")) go("/setup"); } },
    h("span", { class: "add" }, icon("plus", 36)), h("span", { class: "n" }, "Add profile"), h("span", { class: "lv" }, " ")));
  const st = sync.status();
  main.append(h("div", { class: "center" },
    h("h1", { class: "serif", style: { margin: 0, fontWeight: 400, fontSize: "clamp(32px,5vw,48px)" } }, "Who's learning today?"),
    people,
    h("p", { class: "muted", style: { margin: 0 } }, st.enabled ? h("span", { class: "status" }, icon("check", 16), "Synced " + relTime(st.last)) : null, " ",
      h("a", { href: "#/family" }, "Manage family and devices"))), footer());
});

// ---- Setup (new profile) ---------------------------------------------------
route("setup", (main) => {
  const first = model.profiles().length === 0;
  const s = { step: 1, role: first ? "adult" : "kid", name: "", color: model.profiles().length % model.COLORS.length, level: first ? 3 : 0, topics: [], goal: 5, readAloud: true };
  const page = h("div", { class: "page" });
  main.append(page);
  const stepLabel = (n) => h("span", { class: "muted" }, `Step ${n} of 3`);
  function draw() {
    page.replaceChildren();
    if (s.step === 1) {
      const name = h("input", { type: "text", id: "pname", maxlength: 24, autocomplete: "off", value: s.name, placeholder: "First name or nickname", oninput: (e) => { s.name = e.target.value; } });
      const roles = [["adult", "An adult", "Grown-up words, spelling practice", "t-mind"], ["teen", "A teen", "Challenging words for school", "target"], ["kid", "A kid", "Simple definitions, bigger buttons, read aloud", "sprout"]];
      page.append(h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, h("span", { class: "brand" }, "Lumin Vocab"), stepLabel(1)),
        h("h1", {}, first ? "Let's set up your profile" : "Add someone to your family"),
        first ? h("p", { class: "lead" }, "Start with yourself. You can add your family next, and everyone gets their own words and progress.") : null,
        h("div", { class: "field" }, h("span", { class: "flabel" }, "Who is this profile for?"),
          h("div", { class: "choices" }, roles.map(([k, t, sub, ic], i) => h("button", { class: "choice", "aria-pressed": String(s.role === k), onclick: () => { s.role = k; s.level = k === "adult" ? 3 : k === "teen" ? 2 : 0; draw(); } }, badge(ic, `var(--c${[5, 4, 6][i]})`), h("strong", {}, t), h("span", { class: "muted" }, sub))))),
        h("div", { class: "field" }, h("label", { for: "pname" }, "Name"), name, h("small", {}, "Only your family sees this. It's encrypted before it ever syncs.")),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "Color"),
          h("div", { class: "chips" }, model.COLORS.map((c, i) => h("button", { class: "iconbtn", "aria-label": `Color ${i + 1}`, "aria-pressed": String(s.color === i), style: { background: c.bg, borderColor: s.color === i ? "var(--ink)" : c.bg, borderWidth: "3px", borderStyle: "solid" }, onclick: () => { s.color = i; draw(); } }, s.color === i ? h("span", { style: { color: c.fg, display: "flex" } }, icon("check", 20)) : null)))),
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" } },
          first ? h("span") : h("a", { class: "btn quiet", href: "#/who" }, "Cancel"),
          h("button", { class: "btn primary", onclick: () => { if (!s.name.trim()) { name.focus(); toast("Add a name first"); return; } s.step = 2; draw(); } }, "Continue")));
      setTimeout(() => name.focus(), 50);
    } else if (s.step === 2) {
      const allowed = s.role === "kid" ? [0, 1, 2] : s.role === "teen" ? [1, 2, 3] : [2, 3];
      page.append(h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("span", { class: "brand" }, "Lumin Vocab"), stepLabel(2)),
        h("h1", {}, `Pick a level for ${s.name.trim()}`),
        h("div", { class: "choices" }, allowed.map((l) => h("button", { class: "choice", "aria-pressed": String(s.level === l), onclick: () => { s.level = l; draw(); } },
          badge(["sprout", "t-nature", "t-mind", "star"][l], `var(--c${[6, 1, 5, 3][l]})`), h("strong", {}, model.LEVELS[l].name), h("span", { class: "muted" }, model.LEVELS[l].ages), h("span", { class: "s" }, model.LEVELS[l].sample)))),
        h("button", { class: "linkbtn", style: { alignSelf: "flex-start" }, onclick: () => wordCheck(s.role, (l) => { s.level = l; draw(); toast(`${model.LEVELS[l].name} looks like a good fit`); }) }, "Not sure? Take a 2-minute word check"),
        h("p", { class: "muted", style: { margin: 0 } }, "You can change this any time in settings."),
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px" } }, h("button", { class: "btn quiet", onclick: () => { s.step = 1; draw(); } }, "Back"), h("button", { class: "btn primary", onclick: () => { s.step = 3; draw(); } }, "Continue")));
    } else {
      const kid = s.role === "kid";
      page.append(h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("span", { class: "brand" }, "Lumin Vocab"), stepLabel(3)),
        h("h1", {}, kid ? "What does " + s.name.trim() + " like?" : "What are you into?"),
        h("p", { class: "lead" }, "Pick any topics to see more of them. Or skip, and you'll get a mix."),
        h("div", { class: "chips" }, model.TOPICS.filter(t => t !== "My words").map((t) => h("button", { class: "chip", style: { display: "inline-flex", alignItems: "center", gap: "8px" }, "aria-pressed": String(s.topics.includes(t)), onclick: (e) => { s.topics = s.topics.includes(t) ? s.topics.filter(x => x !== t) : [...s.topics, t]; e.currentTarget.setAttribute("aria-pressed", String(s.topics.includes(t))); } }, topicIcon(t), t))),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "New words a day"),
          h("div", { class: "chips" }, [3, 5, 10, 15].map((g) => h("button", { class: "chip", "aria-pressed": String(s.goal === g), onclick: () => { s.goal = g; draw(); } }, String(g))))),
        kid && canSpeak() ? h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Read new words aloud"), h("small", {}, "Great for early readers")), h("input", { type: "checkbox", checked: s.readAloud, onchange: (e) => { s.readAloud = e.target.checked; } })) : null,
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px" } }, h("button", { class: "btn quiet", onclick: () => { s.step = 2; draw(); } }, "Back"),
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
  const allowed = role === "kid" ? [0, 1, 2] : role === "teen" ? [1, 2, 3] : [1, 2, 3];
  const items = [];
  for (const l of allowed) { const pool = model.WORDS.filter(w => w.l === l); for (let i = 0; i < 5; i++) items.push({ w: pool[Math.floor(Math.random() * pool.length)].w, l }); }
  fake.sort(() => Math.random() - .5).slice(0, 3).forEach(w => items.push({ w, l: -1 }));
  items.sort(() => Math.random() - .5);
  const yes = {}; let fakesYes = 0, i = 0;
  sheet("Word check", (b) => {
    const area = h("div", { style: { display: "flex", flexDirection: "column", gap: "22px", alignItems: "center", textAlign: "center", padding: "12px 0" } });
    b.append(h("p", { class: "lead" }, "Do you know what each word means? Be honest. A few made-up words are mixed in."), area);
    const next = () => {
      if (i >= items.length) {
        let level = allowed[0];
        for (const l of allowed) if ((yes[l] || 0) >= 4) level = l;
        if (fakesYes >= 2 && level > allowed[0]) level = allowed[allowed.indexOf(level) - 1];
        closeSheet(); done(level); return;
      }
      const it = items[i];
      area.replaceChildren(h("span", { class: "muted" }, `${i + 1} of ${items.length}`), h("p", { class: "word", style: { fontSize: "clamp(40px,9vw,64px)" } }, it.w),
        h("div", { style: { display: "flex", gap: "12px" } },
          h("button", { class: "btn", onclick: () => { i++; next(); } }, "Not sure"),
          h("button", { class: "btn primary", onclick: () => { if (it.l < 0) fakesYes++; else yes[it.l] = (yes[it.l] || 0) + 1; i++; next(); } }, "I know it")));
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
  if (installGuide.kind !== "installed" && installGuide.kind !== "unsupported" && !localStorage.getItem("lumin-install-dismissed") && model.cards(p.id).length >= 3) {
    main.prepend(h("div", { class: "page", style: { paddingBottom: 0 } }, h("div", { class: "panel", style: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" } },
      icon(app.device.form === "desktop" ? "desktop" : "phone"), h("span", { style: { flex: 1, minWidth: "180px" } }, h("strong", {}, "Install Lumin Vocab"), h("br"), h("span", { class: "muted" }, "It opens full screen and works offline.")),
      h("a", { class: "btn small primary", href: "#/install" }, "Show me how"),
      h("button", { class: "iconbtn", "aria-label": "Dismiss", onclick: (e) => { localStorage.setItem("lumin-install-dismissed", "1"); e.currentTarget.closest(".page").remove(); } }, icon("x", 18)))));
  }

  function header() {
    const n = model.todayCount(p.id), dueN = model.due(p.id).length;
    top.replaceChildren(
      h("div", { style: { display: "flex", alignItems: "center", gap: "12px" } }, h("span", { class: "goal" }, `${Math.min(n, p.goal)} of ${p.goal} today`),
        h("span", { class: "progress", "aria-hidden": "true" }, h("span", { style: { width: Math.min(100, n / p.goal * 100) + "%" } }))),
      dueN ? h("a", { href: "#/review", class: "goal" }, `${dueN} to review`) : h("span"));
  }
  const word = () => q[idx];
  function show() {
    header();
    const w = word();
    if (!w) {
      stage.replaceChildren(h("div", { class: "wordcard" }, badge("medal", "var(--c3)", "lg"), h("p", { class: "word", style: { fontSize: "clamp(36px,6vw,56px)" } }, "That's every word at this level."),
        h("p", { class: "def" }, "Amazing work. Try the next level up, or review the words you're learning."),
        h("div", { style: { display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap", justifyContent: "center" } }, h("a", { class: "btn primary", href: "#/settings" }, "Change level"), h("a", { class: "btn", href: "#/review" }, "Review"))));
      actions.replaceChildren(); return;
    }
    const c = model.card(p.id, w.w);
    const fav = h("button", { class: "iconbtn", "aria-label": "Favorite", "aria-pressed": String(!!(c && c.fav)), onclick: (e) => { const on = model.toggleFav(p.id, w.w); e.currentTarget.setAttribute("aria-pressed", String(on)); toast(on ? "Saved to favorites" : "Removed from favorites"); } }, icon("heart", 22));
    const ex = w.e ? exampleWithMark(w) : null;
    const compact = app.device.layout !== "wide";
    const shareBtn = h("button", { class: "iconbtn", "aria-label": "Share this word", onclick: () => share(w) }, icon("share", 22));
    const card = h("article", { class: "wordcard enter-" + dir, "aria-live": "polite" },
      h("div", { class: "card-meta" }, topicChip(w.t), h("span", { class: "pos" }, w.p)),
      h("h1", { class: "word", lang: "en" }, w.w),
      h("div", { class: "say" }, w.s ? h("span", { "aria-label": "Sounds like " + w.s.replace(/-/g, " ") }, w.s) : null,
        canSpeak() ? h("button", { class: "iconbtn", "aria-label": `Hear ${w.w}`, onclick: () => speak(w.w, p) }, icon("speak", 20)) : null,
        compact ? fav : null, compact ? shareBtn : null),
      h("p", { class: "def" }, w.d),
      ex,
      h("button", { class: "linkbtn more", onclick: () => details(w.w) }, "More about this word"));
    stage.replaceChildren(card);
    const acted = c && (c.st === "learning" || c.st === "known");
    actions.replaceChildren(
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => act("know") }, icon("check", 20), acted && c.st === "known" ? "Known" : "I know it"),
        h("button", { class: "btn primary", onclick: () => act("learn") }, icon(acted && c.st === "learning" ? "review" : "plus", 20), acted && c.st === "learning" ? "Learning" : "Learn this"),
        compact ? null : fav, compact ? null : shareBtn),
      h("span", { class: "hint" }, app.device.keyboard && app.device.layout === "wide"
        ? ["Next word: ", h("span", { class: "kbd" }, "↓"), " or scroll · Learn: ", h("span", { class: "kbd" }, "L"), " · Know it: ", h("span", { class: "kbd" }, "K")]
        : app.device.touch ? "Swipe up for the next word" : "Scroll for the next word"));
    if (p.readAloud) setTimeout(() => speak(w.w, p), 350);
  }
  function exampleWithMark(w) {
    const p1 = h("p", { class: "ex" });
    const re = new RegExp(`(\\b${w.w}\\w*)`, "i");
    const parts = w.e.split(re);
    for (const part of parts) p1.append(re.test(part) && part.toLowerCase().startsWith(w.w.toLowerCase()) ? h("mark", {}, part) : part);
    return p1;
  }
  function act(kind) {
    const w = word(); if (!w) return;
    const prev = model.card(p.id, w.w);
    const before = model.todayCount(p.id);
    if (kind === "learn") model.learn(p.id, w.w); else model.know(p.id, w.w);
    const after = model.todayCount(p.id);
    if (before < p.goal && after >= p.goal) setTimeout(() => toast(model.isKid(p) ? "You did it! Daily goal reached." : "Daily goal reached. Keep going, or come back tomorrow."), 500);
    else toast(kind === "learn" ? `Added "${w.w}" to your reviews` : `Marked "${w.w}" as known`, { label: "Undo", fn: () => { model.restoreCard(p.id, w.w, prev); idx = Math.max(0, idx - 1); dir = "down"; show(); } });
    next(true);
  }
  function next(already) {
    const w = word(); if (!w) return;
    if (!already) model.seen(p.id, w.w);
    back.push(idx); idx++; dir = "up"; show();
  }
  function prev() { if (!back.length) return; idx = back.pop(); dir = "down"; show(); }

  // Swipe, wheel and keys
  let y0 = null, t0 = 0;
  feed.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; y0 = e.clientY; t0 = Date.now(); });
  feed.addEventListener("pointerup", (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; const v = Math.abs(dy) / Math.max(1, Date.now() - t0); y0 = null;
    if (dy < -60 || (dy < -24 && v > .5)) next(); else if (dy > 60 || (dy > 24 && v > .5)) prev();
  });
  feed.addEventListener("touchmove", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  let wheelAt = 0;
  feed.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) < 25 || Date.now() - wheelAt < 550) return; wheelAt = Date.now(); e.deltaY > 0 ? next() : prev(); }, { passive: true });
  const keys = (e) => {
    if (!document.body.contains(feed) || document.querySelector(".sheet") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "j" || (k === " " && document.activeElement === document.getElementById("main"))) { e.preventDefault(); next(); }
    else if (k === "arrowup" || k === "k" && e.shiftKey) { e.preventDefault(); prev(); }
    else if (k === "l") act("learn"); else if (k === "k") act("know");
    else if (k === "f") { const w = word(); if (w) { const on = model.toggleFav(p.id, w.w); toast(on ? "Saved to favorites" : "Removed from favorites"); show(); } }
    else if (k === "s") { const w = word(); w && speak(w.w, p); }
    else if (k === "enter" && document.activeElement === document.getElementById("main")) { const w = word(); w && details(w.w); }
  };
  addEventListener("keydown", keys);
  addEventListener("hashchange", () => removeEventListener("keydown", keys), { once: true });
  show();
});

// ---- Word details --------------------------------------------------------
export function details(wordText) {
  const p = app.profile, w = model.lookup(wordText);
  if (!w) return;
  sheet(w.w, (b) => {
    const c = model.card(p.id, w.w);
    b.append(
      h("div", { class: "say", style: { marginTop: 0 } }, h("span", { class: "pos" }, w.p), w.s ? h("span", {}, "· " + w.s) : null,
        canSpeak() ? h("button", { class: "iconbtn", "aria-label": `Hear ${w.w}`, onclick: () => speak(w.w, p) }, icon("speak", 20)) : null),
      h("div", {}, h("h3", { class: "sec-title" }, icon("book", 18), "Meaning"), h("p", { style: { margin: 0, fontSize: "19px" } }, w.d)),
      w.e ? h("div", {}, h("h3", { class: "sec-title" }, icon("quote", 18), "Examples"), h("p", { class: "ex", style: { margin: 0, textAlign: "left" } }, w.e), w.e2 ? h("p", { class: "ex", style: { margin: "10px 0 0", textAlign: "left" } }, w.e2) : null) : null,
      w.f && w.f.length ? h("div", {}, h("h3", { class: "sec-title" }, icon("branch", 18), "Word family"), h("div", { class: "chips" }, w.f.map(f => model.BY.get(f) ? h("button", { class: "chip", onclick: () => details(f) }, f) : h("span", { class: "chip", style: { display: "inline-flex", alignItems: "center" } }, f)))) : null,
      w.m && w.m.length ? h("div", {}, h("h3", { class: "sec-title" }, icon("equal", 18), "Similar words"), h("p", { style: { margin: 0 } }, w.m.join(", "))) : null,
      h("div", {}, h("h3", { class: "sec-title" }, icon("sprout", 18), "Level and topic"), h("div", { class: "chips", style: { alignItems: "center" } }, w.custom ? topicChip("My words") : [h("span", { class: "topic" }, icon("sprout", 18), LEVEL(w.l).name), topicChip(w.t)])),
      h("div", { class: "chips" },
        h("button", { class: "btn small" + (c && c.st === "learning" ? "" : " primary"), onclick: () => { model.learn(p.id, w.w); toast(`Added "${w.w}" to your reviews`); closeSheet(); } }, c && c.st === "learning" ? "In your reviews" : "Learn this"),
        h("button", { class: "btn quiet", onclick: () => { const on = model.toggleFav(p.id, w.w); toast(on ? "Saved to favorites" : "Removed from favorites"); } }, icon("heart", 20), "Favorite"),
        h("button", { class: "btn quiet", onclick: () => share(w) }, icon("share", 20), "Share"),
        h("button", { class: "btn quiet", onclick: () => collectionPicker(w.w) }, "Add to a collection")),
      h("p", { class: "muted", style: { fontSize: "14px", margin: 0 } }, w.custom ? "Added by you." : w.l >= 2 ? "Definition and examples adapted from Open English WordNet (CC BY 4.0). " : "Written for Lumin Vocab. ", h("a", { href: "#/about", onclick: () => closeSheet() }, "Credits")));
  });
}
function collectionPicker(word) {
  const p = app.profile;
  sheet("Add to a collection", (b) => {
    const list = h("div", { class: "panel", style: { padding: "6px 18px" } });
    const draw = () => {
      list.replaceChildren();
      const cols = model.collections(p.id);
      if (!cols.length) list.append(h("p", { class: "muted" }, "No collections yet."));
      for (const col of cols) list.append(h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, col.name), h("small", {}, `${col.words.length} words${col.shared ? ", shared with family" : ""}`)),
        h("input", { type: "checkbox", checked: col.words.includes(word), onchange: () => model.toggleInCollection(model.collections(p.id).find(x => x.id === col.id), word) })));
    };
    draw();
    b.append(list, h("button", { class: "btn quiet", onclick: async () => { const name = await ask("New collection", { label: "Name", confirm: "Create", maxlength: 40 }); if (name && name.trim()) { const col = model.newCollection(p.id, name.trim()); model.toggleInCollection(col, word); toast(`Added to ${col.name}`); } } }, icon("plus", 20), "New collection"));
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
    wrap.append(h("div", { class: "q" }, h("div", { class: "prompt" }, badge(any ? "check" : "sprout", "var(--c6)", "lg"),
      h("p", { class: "big" }, any ? "All caught up." : "Nothing to review yet."),
      h("p", { class: "kicker" }, any ? (nd ? `Your next review is ${untilText(nd)}. Reviewing at the right time is what makes words stick.` : "") : "Tap Learn this on a few words, and they'll show up here at just the right times.")),
      h("div", { style: { display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" } },
        any ? h("a", { class: "btn", href: "#/review/practice" }, "Practice anyway") : null, h("a", { class: "btn primary", href: "#/feed" }, "Learn new words"))));
    return;
  }
  const queue = items.map(c => ({ c, retry: false }));
  const total = queue.length;
  let done = 0, right = 0, stronger = 0, mastered = 0;
  const graded = new Set();
  function step() {
    const it = queue.shift();
    if (!it) return summary();
    const c = model.card(p.id, it.c.w) || it.c;
    const ex = model.exercise(p, c, it.retry ? "meaning" : null);
    if (!ex) return step();
    const start = Date.now(); let hinted = false, answered = false;
    const fb = h("p", { class: "feedback", role: "status" });
    const nextBtn = h("button", { class: "btn primary", hidden: true, onclick: () => step() }, queue.length ? "Next" : "Finish");
    const kickers = { meaning: "What does this word mean?", word: "Which word means", blank: "Which word fits?", spell: "Type the word that means" };
    const big = h("p", { class: "big" });
    if (ex.type === "blank") { const [a, b] = ex.prompt.split("_____"); big.append(a, h("span", { class: "blank", "aria-label": "blank" }), b); }
    else big.append(ex.type === "meaning" ? h("span", { lang: "en" }, ex.prompt) : ex.prompt);
    const readOut = () => speak(ex.type === "meaning" ? ex.word.w : `${kickers[ex.type]}: ${ex.prompt.replace("_____", "blank")}`, p);
    const kIcon = { meaning: "book", word: "search", blank: "quote", spell: "t-mine" }[ex.type];
    const promptEl = h("div", { class: "prompt" }, badge(kIcon, tint(ex.word.t)), h("span", { class: "kicker" }, kickers[ex.type]), big,
      canSpeak() ? h("button", { class: "iconbtn", "aria-label": "Read it aloud", onclick: readOut }, icon("speak", 20)) : null);
    function finish(correct) {
      if (answered) return; answered = true;
      const ms = Date.now() - start;
      if (correct) right++;
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
      fb.textContent = correct ? praise[Math.floor(Math.random() * praise.length)] + (ex.word.e && kid ? " " + ex.word.e : "") : `It's "${ex.word.w}": ${ex.word.d}`;
      nextBtn.hidden = false; nextBtn.textContent = queue.length ? "Next" : "Finish";
      setTimeout(() => nextBtn.focus(), 30);
    }
    let body;
    if (ex.type === "spell") {
      const input = h("input", { type: "text", "aria-label": "Your answer", autocomplete: "off", autocapitalize: "none", spellcheck: "false" });
      const hint = h("button", { class: "linkbtn", type: "button", onclick: () => { hinted = true; input.placeholder = ex.word.w[0] + "…" + ` (${ex.word.w.length} letters)`; input.focus(); } }, "Hint");
      body = h("form", { class: "typed", onsubmit: (e) => { e.preventDefault(); if (answered) return step(); const ok = input.value.trim().toLowerCase() === ex.word.w.toLowerCase(); input.disabled = true; finish(ok); } }, input, h("button", { class: "btn primary", type: "submit" }, "Check"));
      body = h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" } }, body, hint);
      setTimeout(() => input.focus(), 50);
    } else {
      body = h("div", { class: "options" + (kid ? " kid" : "") + (ex.type === "meaning" ? " defs" : ""), role: "group", "aria-label": "Answers" });
      ex.options.forEach((o, i) => body.append(h("button", { class: "opt" + (ex.type === "meaning" ? " def-opt" : ""), "data-right": o.right ? "1" : "0", onclick: (e) => {
        if (answered) return;
        e.currentTarget.classList.add(o.right ? "right" : "wrong");
        e.currentTarget.prepend(h("span", { class: "mark" }, icon(o.right ? "check" : "x", 22)));
        if (!o.right) { const r = body.querySelector('[data-right="1"]'); r.classList.add("right"); r.prepend(h("span", { class: "mark" }, icon("check", 22))); }
        [...body.children].forEach(b => b.setAttribute("aria-disabled", "true"));
        finish(o.right);
      } }, app.device.keyboard && app.device.layout === "wide" ? h("span", { class: "kbd", "aria-hidden": "true" }, String(i + 1)) : null, o.text)));
    }
    q.replaceChildren(promptEl, body, fb, h("div", { style: { display: "flex", justifyContent: "center" } }, nextBtn));
    if (p.readAloud) setTimeout(readOut, 300);
  }
  function summary() {
    removeEventListener("keydown", keys);
    bar.style.width = "100%";
    q.replaceChildren(h("div", { class: "prompt" }, badge("medal", "var(--c3)", "lg"),
      h("p", { class: "big" }, kid ? "You did it!" : "Nice work."),
      h("p", { class: "kicker" }, `${right} correct out of ${total + queue.length}. ${stronger} word${stronger === 1 ? "" : "s"} got stronger${mastered ? `, and ${mastered} ${mastered === 1 ? "is" : "are"} now mastered` : ""}.`)),
      h("div", { style: { display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" } }, h("a", { class: "btn primary", href: "#/feed" }, "Back to words"), h("a", { class: "btn", href: "#/saved" }, "See my words")));
  }
  const bar = h("span", { style: { width: "0%" } });
  const count = h("span", { style: { fontWeight: 700 } }, `0 of ${total}`);
  const q = h("div", { class: "q" });
  wrap.append(h("div", { class: "review-top" }, h("a", { class: "iconbtn", href: "#/feed", "aria-label": "End review" }, icon("x", 20)),
    h("div", { class: "bar", role: "progressbar", "aria-label": "Review progress" }, bar), count), q);
  const keys = (e) => {
    if (!document.body.contains(wrap) || document.querySelector(".sheet") || /INPUT/.test(document.activeElement.tagName)) return;
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
  let tab = args[0] || "favorites", limit = 60;
  const st = model.stats(p.id);
  const search = h("input", { type: "search", id: "saved-search", placeholder: "Search every word in Lumin Vocab", "aria-label": "Search words" });
  const out = h("div", { style: { display: "flex", flexDirection: "column", gap: "16px" } });
  const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Saved words" });
  const tile = (w, meta) => { const word = model.lookup(w); const t = word ? (word.custom ? "My words" : word.t) : "Describing";
    return h("button", { class: "tile", onclick: () => details(w) }, h("span", { class: "top" }, h("span", { class: "w" }, w), topicIcon(t)), h("span", { class: "m" }, meta)); };
  const empty = (ic, text) => h("div", { class: "empty" }, badge(ic, null, "lg"), h("p", { style: { margin: 0, maxWidth: "36ch" } }, text));
  const stateLabel = (c) => c.st === "learning" ? (srs.isMastered(c.srs) ? "Mastered" : "Learning") : c.st === "known" ? "Known" : "Seen";
  function drawTab() {
    const add = (...k) => out.append(...k.flat().filter(Boolean));
    tabs.replaceChildren(...[["favorites", "Favorites", "heart"], ["collections", "Collections", "folder"], ["history", "History", "history"], ["mine", "My words", "t-mine"]].map(([k, l, ic]) =>
      h("button", { role: "tab", "aria-selected": String(tab === k), onclick: () => { tab = k; limit = 60; drawTab(); } }, icon(ic, 18), l)));
    out.replaceChildren();
    const q = search.value.trim().toLowerCase();
    if (q) {
      const hits = model.WORDS.filter(w => w.w.startsWith(q)).concat(model.WORDS.filter(w => !w.w.startsWith(q) && w.w.includes(q))).slice(0, 48);
      const mine = model.customWords(p.id).filter(c => c.w.toLowerCase().includes(q));
      add(h("p", { class: "muted", style: { margin: 0 } }, hits.length + mine.length ? `${hits.length + mine.length} words found` : "No words found. You can add it as your own word."),
        h("div", { class: "grid" }, mine.map(c => tile(c.w, "Your word")), hits.map(w => tile(w.w, `${LEVEL(w.l).name} · ${w.p}`))),
        !hits.find(w => w.w === q) ? h("button", { class: "btn quiet", style: { alignSelf: "flex-start" }, onclick: () => addWord(q) }, icon("plus", 20), `Add "${q}" as your own word`) : null);
      return;
    }
    if (tab === "favorites") {
      const favs = model.cards(p.id).filter(c => c.fav).sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
      add(favs.length ? h("div", { class: "grid" }, favs.map(c => tile(c.w, stateLabel(c)))) : empty("heart", "Tap the heart on any word to keep it here."));
    } else if (tab === "collections") {
      const cols = model.collections(p.id);
      add(...cols.map(col => h("div", { class: "panel", style: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" } },
        h("button", { class: "tile", style: { flex: 1, padding: 0, background: "none", minWidth: "160px" }, onclick: () => openCollection(col.id) }, h("strong", { style: { fontSize: "18px" } }, col.name), h("span", { class: "m" }, `${col.words.length} words${col.shared ? ", shared with family" : ""}`)),
        col.words.length ? h("a", { class: "btn small quiet", href: `#/review/col/${col.id}` }, "Quiz me") : null)),
        h("button", { class: "btn quiet", style: { alignSelf: "flex-start" }, onclick: async () => { const name = await ask("New collection", { label: "Name", confirm: "Create", maxlength: 40 }); if (name && name.trim()) { model.newCollection(p.id, name.trim()); drawTab(); } } }, icon("plus", 20), "New collection"));
    } else if (tab === "history") {
      const hist = model.cards(p.id).sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
      add(hist.length ? h("div", { class: "grid" }, hist.slice(0, limit).map(c => tile(c.w, `${stateLabel(c)} · ${relTime(c.seenAt)}`))) : empty("history", "Words you see will be listed here, with no limit."),
        hist.length > limit ? h("button", { class: "btn quiet", onclick: () => { limit += 120; drawTab(); } }, `Show more (${hist.length - limit})`) : null);
    } else {
      const mine = model.customWords(p.id);
      add(mine.length ? h("div", { class: "grid" }, mine.map(c => tile(c.w, c.d.slice(0, 60)))) : empty("t-mine", "Found a great word while reading? Add it, and it joins your reviews."),
        h("button", { class: "btn primary", style: { alignSelf: "flex-start" }, onclick: () => addWord("") }, icon("plus", 20), "Add your own word"));
    }
  }
  search.addEventListener("input", drawTab);
  main.append(h("div", { class: "page" },
    h("h1", {}, "Saved"),
    h("div", { class: "grid", style: { gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" } },
      [[st.learning, "Learning", "sprout", "var(--c6)"], [st.mastered, "Mastered", "medal", "var(--c3)"], [st.known, "Already known", "check", "var(--c1)"]].map(([n, l, ic, col]) =>
        h("div", { class: "tile stat" }, badge(ic, col), h("span", {}, h("span", { class: "num" }, String(n)), h("br"), h("span", { class: "m" }, l))))),
    search, tabs, out));
  drawTab();
});
function openCollection(id) {
  const p = app.profile;
  const col = model.collections(p.id).find(c => c.id === id); if (!col) return;
  sheet(col.name, (b) => {
    b.append(col.words.length ? h("div", { class: "chips" }, col.words.map(w => h("button", { class: "chip", onclick: () => details(w) }, w))) : h("p", { class: "muted" }, "Add words from any word's details."),
      h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Share with family"), h("small", {}, "Everyone in your family can see and quiz this collection")),
        h("input", { type: "checkbox", checked: !!col.shared, onchange: (e) => model.saveCollection({ ...col, shared: e.target.checked }) })),
      h("div", { class: "chips" },
        col.words.length ? h("a", { class: "btn small primary", href: `#/review/col/${col.id}`, onclick: () => closeSheet() }, "Quiz me") : null,
        h("button", { class: "btn quiet", onclick: async () => { const n = await ask("Rename collection", { label: "Name", confirm: "Save", maxlength: 40 }); if (n && n.trim()) { model.saveCollection({ ...col, name: n.trim() }); render(); } } }, "Rename"),
        h("button", { class: "btn quiet", onclick: async () => { if (await confirmBox("Delete collection?", `"${col.name}" will be removed. The words stay in your history.`, "Delete", true)) { store.remove("col:" + col.id); render(); } } }, "Delete")));
  });
}
function addWord(prefill) {
  const p = app.profile;
  sheet("Add your own word", (b) => {
    const w = h("input", { type: "text", id: "cw-w", maxlength: 40, autocomplete: "off", autocapitalize: "none", value: prefill });
    const pos = h("select", { id: "cw-p" }, ["noun", "verb", "adjective", "adverb", "phrase"].map(x => h("option", { value: x }, x)));
    const d = h("textarea", { id: "cw-d", maxlength: 240, rows: 3 });
    const e = h("textarea", { id: "cw-e", maxlength: 240, rows: 2 });
    const note = h("small", { class: "muted" });
    const fill = () => { const hit = model.BY.get(w.value.trim().toLowerCase()); if (hit) { if (!d.value) d.value = hit.d; if (!e.value) e.value = hit.e || ""; pos.value = ["noun", "verb", "adjective", "adverb"].includes(hit.p) ? hit.p : "phrase"; note.textContent = "Filled in from Lumin Vocab. Edit anything you like."; } };
    w.addEventListener("change", fill); w.addEventListener("blur", fill);
    b.append(h("form", { style: { display: "flex", flexDirection: "column", gap: "16px" }, onsubmit: (ev) => {
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
      h("button", { class: "btn primary", type: "submit", style: { alignSelf: "flex-start" } }, "Add word")));
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
    page.replaceChildren(h("h1", {}, "Family"));
    const list = h("div", { class: "panel", style: { padding: "8px 22px" } });
    for (const p of model.profiles()) list.append(h("div", { class: "row-item" }, avatar(p),
      h("span", { class: "grow" }, h("strong", {}, p.name), h("span", { class: "muted" }, ` · ${LEVEL(p.level).name}${p.manager ? " · Parent" : ""}`)),
      h("button", { class: "btn small quiet", onclick: async () => { if (p.id === app.pid || await guard("Editing a profile needs a grown-up")) editProfile(p.id); } }, "Edit")));
    list.append(h("div", { class: "row-item" }, h("button", { class: "btn quiet", onclick: async () => { if (await guard("Adding a profile needs a grown-up")) go("/setup"); } }, icon("plus", 20), "Add profile"),
      h("a", { href: "#/who", style: { marginLeft: "auto" } }, "Switch profile")));
    page.append(h("h2", { class: "sec-title" }, badge("t-people", "var(--c2)"), "Profiles"), list);

    // Sync
    const syncPanel = h("div", { class: "panel" });
    page.append(h("h2", { class: "sec-title" }, badge("sync", "var(--c5)"), "Your devices"), syncPanel);
    if (!st.enabled) {
      syncPanel.append(h("p", { style: { margin: 0 } }, "Right now everything lives on this device only. Turn on family sync to use Lumin Vocab on phones, tablets and computers, with everyone's progress kept in step."),
        h("p", { class: "muted", style: { margin: 0 } }, "Everything is encrypted on this device with your family code before it's sent. Our server can't read names, words or progress."),
        h("div", { class: "chips" },
          h("button", { class: "btn primary", onclick: async () => {
            if (!canManage && !(await guard("Turning on sync needs a grown-up"))) return;
            const pool = model.WORDS.filter(w => w.l <= 2).map(w => w.w);
            const c = sync.makeCode(pool);
            syncPanel.replaceChildren(h("p", {}, "Creating your family space…"));
            await sync.enable(c);
            toast(sync.status().error || "Family sync is on"); draw();
          } }, icon("sync", 20), "Turn on family sync"),
          h("a", { class: "btn quiet", href: "#/join" }, "Join an existing family")));
    } else {
      const showCode = h("div", { style: { display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" } });
      syncPanel.append(
        h("div", { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
          st.error ? h("span", { style: { color: "var(--bad)", fontWeight: 700 } }, st.error) : h("span", { class: "status" }, icon("check", 18), st.busy ? "Syncing…" : "Synced " + relTime(st.last)),
          h("button", { class: "btn small quiet", style: { marginLeft: "auto" }, onclick: async () => { await sync.syncNow(); draw(); } }, icon("sync", 18), "Sync now")),
        h("p", { class: "muted", style: { margin: 0 } }, `This device: ${LABELS.os[app.device.os]} · ${LABELS.browser[app.device.browser]}${app.device.installed ? " · installed" : ""}`),
        showCode,
        h("button", { class: "linkbtn", style: { alignSelf: "flex-start" }, onclick: async () => { if (await confirmBox("Stop syncing on this device?", "Your words stay on this device, but changes won't reach your other devices until you join again with the family code.", "Stop syncing", true)) { await sync.disable(); draw(); } } }, "Stop syncing on this device"));
      const reveal = h("button", { class: "btn quiet", onclick: async () => {
        if (!canManage && !(await guard("Showing the family code needs a grown-up"))) return;
        showCode.replaceChildren(qr(sync.joinLink(code)), h("div", { style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "200px" } },
          h("strong", {}, "Add a device"), h("span", { class: "muted" }, app.device.form === "desktop" ? "Scan this with the phone or tablet's camera. Or open the site there, choose Join your family, and type the code." : "Scan this from another device's camera, or type the code there."),
          h("span", { class: "code" }, code.replace(/-/g, " ")),
          h("span", { class: "muted", style: { fontSize: "14px" } }, "Keep this code private. Anyone with it can join your family.")));
      } }, icon("plusbox", 20), "Add a device");
      showCode.append(reveal);
    }

    // Backup
    page.append(h("h2", { class: "sec-title" }, badge("down", "var(--c3)"), "Backup"), h("div", { class: "panel" },
      h("p", { style: { margin: 0 } }, "Save a file with every profile, word and setting. Keep it somewhere safe, or use it to move to a new device."),
      h("div", { class: "chips" },
        h("button", { class: "btn quiet", onclick: () => download(`lumin-vocab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll())) }, icon("down", 20), "Download backup"),
        h("label", { class: "btn quiet" }, icon("up", 20), "Restore from file", h("input", { type: "file", accept: "application/json,.json", class: "sr", onchange: async (e) => {
          const file = e.target.files[0]; if (!file) return;
          try { const n = store.importAll(JSON.parse(await file.text())); toast(`Restored ${n} items`); render(); } catch (err) { toast(err.message || "That file couldn't be read"); }
        } })))));

    if (app.device.install.kind !== "installed") page.append(h("div", { class: "panel", style: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" } },
      icon(app.device.form === "desktop" ? "desktop" : "phone"), h("span", { style: { flex: 1, minWidth: "200px" } }, h("strong", {}, "Install on this device"), h("br"), h("span", { class: "muted" }, "Opens full screen and works offline.")),
      h("a", { class: "btn small primary", href: "#/install" }, "Show me how")));
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
    const rolesBox = h("div", { class: "chips" }), levelBox = h("div", { class: "chips" }), colorBox = h("div", { class: "chips" });
    const draw = () => {
      rolesBox.replaceChildren(...Object.entries(model.ROLES).map(([k, l]) => h("button", { class: "chip", "aria-pressed": String(role === k), onclick: () => { role = k; draw(); } }, l)));
      levelBox.replaceChildren(...model.LEVELS.map((L, i) => h("button", { class: "chip", "aria-pressed": String(level === i), onclick: () => { level = i; draw(); } }, L.name)));
      colorBox.replaceChildren(...model.COLORS.map((c, i) => h("button", { class: "iconbtn", "aria-label": `Color ${i + 1}`, "aria-pressed": String(color === i), style: { background: c.bg, border: `3px solid ${color === i ? "var(--ink)" : c.bg}` }, onclick: () => { color = i; draw(); } })));
    };
    draw();
    const others = model.profiles().filter(x => x.id !== id);
    b.append(h("div", { class: "field" }, h("label", { for: "ep-name" }, "Name"), name),
      h("div", { class: "field" }, h("span", { class: "flabel" }, "Role"), rolesBox),
      h("div", { class: "field" }, h("span", { class: "flabel" }, "Level"), levelBox),
      h("div", { class: "field" }, h("span", { class: "flabel" }, "Color"), colorBox),
      h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, "Parent"), h("small", {}, "Parents can manage the family, devices and the PIN")),
        h("input", { type: "checkbox", id: "ep-mgr", checked: !!p.manager, disabled: p.manager && !others.some(o => o.manager) })),
      h("div", { class: "chips" },
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
  const sec = (title, ...kids) => { const [ic, c] = SEC[title] || ["info", 1];
    return h("section", { style: { display: "flex", flexDirection: "column", gap: "12px" } }, h("h2", { class: "sec-title" }, badge(ic, `var(--c${c})`), title), h("div", { class: "panel" }, ...kids)); };
  const sw = (title, sub, checked, onchange, id) => h("label", { class: "switch" }, h("span", { class: "txt" }, h("strong", {}, title), sub ? h("small", {}, sub) : null), h("input", { type: "checkbox", id, checked, onchange: (e) => onchange(e.target.checked) }));
  const seg = (label, opts, value, onpick) => h("div", { class: "field" }, h("span", { class: "flabel" }, label), h("div", { class: "chips", role: "group", "aria-label": label },
    opts.map(([v, l]) => h("button", { class: "chip", "aria-pressed": String(value === v), onclick: (e) => { onpick(v); e.currentTarget.parentNode.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); } }, l))));

  // Header card
  const st = model.stats(p.id);
  page.append(h("div", { class: "panel", style: { flexDirection: "row", alignItems: "center", gap: "18px", flexWrap: "wrap" } }, avatar(p, "md"),
    h("div", { style: { flex: 1, minWidth: "160px" } }, h("h1", { style: { fontSize: "30px" } }, p.name), h("span", { class: "muted" }, `${LEVEL(p.level).name} · ${model.ROLES[p.role] || "Adult"}${p.manager ? " · Parent" : ""} · ${st.learning + st.mastered} words learning`)),
    h("a", { class: "btn small quiet", href: "#/who" }, "Switch profile")));

  // Look (everyone, kids first)
  const themes = h("div", { class: "theme-grid" }, model.THEMES.map(([k, name, bg, ink]) => h("button", { class: "theme", "aria-pressed": String(p.theme === k), onclick: (e) => { save({ theme: k }); page.querySelectorAll(".theme").forEach(t => t.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); } },
    h("span", { class: "sw", style: { backgroundColor: bg, backgroundImage: `url(/scenes/${k}.svg)`, color: ink } }, "luminous"), h("span", { class: "nm" }, name))));
  const scale = h("input", { type: "range", id: "set-scale", min: "0.9", max: "1.3", step: "0.05", value: String(p.scale || (model.isKid(p) ? 1.08 : 1)), oninput: (e) => save({ scale: parseFloat(e.target.value) }) });
  const avatarPick = h("div", { class: "chips" }, model.COLORS.map((c, i) => h("button", { class: "iconbtn", "aria-label": `Color ${i + 1}`, "aria-pressed": String(p.color === i), style: { background: c.bg, border: `3px solid ${p.color === i ? "var(--ink)" : c.bg}` }, onclick: () => { save({ color: i }); render(); } })));
  page.append(sec(kid ? "My look" : "Look",
    themes,
    h("div", { class: "field" }, h("label", { for: "set-scale" }, "Text size"), scale),
    kid ? h("div", { class: "field" }, h("span", { class: "flabel" }, "My color"), avatarPick) : null,
    lockedKid ? null : seg("Dark mode", [["device", "Match device"], ["sunset", "After sunset"], ["off", "Never"]], p.dark || "device", (v) => save({ dark: v })),
    lockedKid ? null : sw("Calmer motion", matchMedia("(prefers-reduced-motion: reduce)").matches ? "Your device already asks for less motion, so it's on" : "Fewer animations when moving between words", !!p.calm, (v) => save({ calm: v }))));

  // Sound
  if (canSpeak()) {
    const vs = voices();
    page.append(sec(kid ? "Reading help" : "Sound",
      sw("Read words aloud", kid ? "Hear each new word and review question" : "Hear each new word as it appears", !!p.readAloud, (v) => save({ readAloud: v })),
      lockedKid || !vs.length ? null : h("div", { class: "field" }, h("label", { for: "set-voice" }, "Voice"),
        h("select", { id: "set-voice", onchange: (e) => { save({ voice: e.target.value }); speak("luminous", p); } }, h("option", { value: "" }, "Automatic"), vs.map(v => h("option", { value: v.name, selected: p.voice === v.name }, `${v.name} (${v.lang})`))),
        h("small", {}, `Voices come from this ${LABELS.os[app.device.os]}, so they can differ between devices.`)),
      lockedKid ? null : h("div", { class: "field" }, h("label", { for: "set-rate" }, "Speaking speed"), h("input", { type: "range", id: "set-rate", min: "0.6", max: "1.2", step: "0.05", value: String(p.rate || 0.9), onchange: (e) => { save({ rate: parseFloat(e.target.value) }); speak("luminous", p); } })),
      h("button", { class: "btn small quiet", style: { alignSelf: "flex-start" }, onclick: () => speak("Lumin Vocab. Luminous.", p) }, icon("speak", 20), "Test")));
  }

  if (lockedKid) {
    page.append(h("button", { class: "btn quiet", style: { alignSelf: "flex-start" }, onclick: async () => { if (await guard("Grown-up settings")) render(); } }, icon("lock", 20), "Grown-up settings"), footer());
    return;
  }

  // Learning (first for teens and adults, after the fun stuff for kids)
  const learnSec = sec("Learning",
    seg("Level", model.LEVELS.map((L, i) => [i, `${L.name}`]), p.level, (v) => save({ level: v })),
    h("p", { class: "muted", style: { margin: "-6px 0 0" } }, model.LEVELS.map(L => `${L.name}: ${L.ages.toLowerCase()}`).join(" · ")),
    h("div", { class: "field" }, h("span", { class: "flabel" }, "Favorite topics"), h("div", { class: "chips" }, model.TOPICS.map(t => h("button", { class: "chip", style: { display: "inline-flex", alignItems: "center", gap: "8px" }, "aria-pressed": String((p.topics || []).includes(t)), onclick: (e) => { const cur = model.profile(p.id).topics || []; const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]; save({ topics: next }); e.currentTarget.setAttribute("aria-pressed", String(next.includes(t))); } }, topicIcon(t), t)))),
    seg("New words a day", [[3, "3"], [5, "5"], [10, "10"], [15, "15"]], p.goal, (v) => save({ goal: v })),
    seg("Words per review", [[10, "10"], [20, "20"], [30, "30"]], p.reviewSize || 20, (v) => save({ reviewSize: v })),
    kid ? null : sw("Spelling practice", "Some reviews ask you to type the word", p.spelling !== false, (v) => save({ spelling: v })),
    h("button", { class: "linkbtn", style: { alignSelf: "flex-start" }, onclick: () => wordCheck(p.role, (l) => { save({ level: l }); toast(`Level set to ${model.LEVELS[l].name}`); render(); }) }, "Take the word check again"));
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
      f.pin ? h("button", { class: "linkbtn", style: { alignSelf: "flex-start" }, onclick: async () => { if (await confirmBox("Turn off the family PIN?", "Anyone using this app will be able to change settings and profiles.", "Turn off", true)) { await model.setPin(null); render(); } } }, "Turn off PIN") : null,
      h("a", { class: "btn small quiet", href: "#/family", style: { alignSelf: "flex-start" } }, icon("family", 20), "Profiles, devices and backup")));
  }

  // This device
  const d = app.device;
  const synced = sync.status();
  page.append(sec("This device",
    h("div", { class: "row-item" }, icon(d.form === "desktop" ? "desktop" : "phone"), h("span", { class: "grow" }, h("strong", {}, `${LABELS.os[d.os]} · ${LABELS.browser[d.browser]}`), h("br"),
      h("span", { class: "muted" }, `${d.form === "desktop" ? "Computer" : d.form === "tablet" ? "Tablet" : "Phone"} · ${d.width}×${d.height} · ${d.installed ? "Installed as an app" : "Running in the browser"}`))),
    d.installed ? null : h("a", { class: "btn small primary", href: "#/install", style: { alignSelf: "flex-start" } }, "Install Lumin Vocab here"),
    h("div", { class: "row-item" }, icon("sync"), h("span", { class: "grow" }, synced.enabled ? `Family sync is on. Last synced ${relTime(synced.last)}.` : "Family sync is off. Everything stays on this device."), h("a", { href: "#/family" }, synced.enabled ? "Manage" : "Turn on")),
    store.persistent() ? null : h("p", { class: "muted", style: { margin: 0 } }, "This browser isn't letting Lumin Vocab save data. Private browsing can cause this.")));
  if (d.keyboard && d.layout === "wide") page.append(sec("Keyboard shortcuts",
    h("p", { style: { margin: 0, lineHeight: 2.2 } }, h("span", { class: "kbd" }, "↓"), " next word · ", h("span", { class: "kbd" }, "↑"), " previous · ", h("span", { class: "kbd" }, "L"), " learn · ", h("span", { class: "kbd" }, "K"), " know it · ",
      h("span", { class: "kbd" }, "F"), " favorite · ", h("span", { class: "kbd" }, "S"), " say it · ", h("span", { class: "kbd" }, "1"), "–", h("span", { class: "kbd" }, "4"), " answer in review · ", h("span", { class: "kbd" }, "Esc"), " close")));

  // Data
  page.append(sec("Your data",
    h("p", { style: { margin: 0 } }, "Everything is stored on your devices. With family sync on, it's encrypted before it leaves this device. There are no ads, trackers or accounts."),
    h("div", { class: "chips" },
      h("button", { class: "btn small quiet", onclick: () => download(`lumin-vocab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll())) }, icon("down", 20), "Download backup"),
      h("a", { class: "btn small quiet", href: "/privacy.html" }, "Privacy")),
    p.manager || app.unlocked ? h("button", { class: "linkbtn", style: { alignSelf: "flex-start", color: "var(--bad)" }, onclick: async () => {
      if (!(await confirmBox("Erase everything on this device?", "All profiles and progress on this device will be deleted. Other synced devices keep their copy. Download a backup first if you're not syncing.", "Erase", true))) return;
      await sync.disable(); await store.wipe(); localStorage.clear(); location.hash = ""; location.reload();
    } }, "Erase everything on this device") : null));

  page.append(sec("About",
    h("p", { style: { margin: 0 } }, `Lumin Vocab ${VERSION}. Free and open source under the AGPL-3.0 license. Made by `, h("a", { href: "https://b7collective.com", rel: "noopener" }, "B7 Collective"), "."),
    h("div", { class: "chips" }, h("a", { class: "btn small quiet", href: "#/about" }, "Credits and licenses"), h("a", { class: "btn small quiet", href: SOURCE, rel: "noopener" }, "Source code"))));
});

// ---- Install (tailored to the device) ----------------------------------------
route("install", (main) => {
  const d = app.device, g = d.install;
  const place = d.form === "desktop" ? "this computer" : `your ${LABELS.os[d.os] === "this device" ? "device" : LABELS.os[d.os]}`;
  const page = h("div", { class: "page narrow" });
  main.append(page);
  const ic = { share: "share", plus: "plusbox", menu: "menu", check: "check" };
  const stepsList = (steps) => h("ol", { class: "steps" }, steps.map(s => h("li", {}, h("span", { class: "ic" }, icon(ic[s.icon] || "check", 20)), h("span", {}, s.text))));
  const draw = () => {
    page.replaceChildren(h("img", { src: "/icons/logo.svg", alt: "", width: 64, height: 64, style: { borderRadius: "16px" } }));
    if (g.kind === "installed") {
      page.append(h("h1", {}, "You're using the app"), h("p", { class: "lead" }, "Lumin Vocab is installed on this device. It opens full screen and works offline."), h("a", { class: "btn primary", href: "#/feed", style: { alignSelf: "flex-start" } }, "Back to words"));
    } else {
      page.append(h("h1", {}, `Install Lumin Vocab on ${place}`), h("p", { class: "lead" }, "It installs like an app: its own icon, full screen, and it works offline. No app store, no account."));
      if (g.kind === "prompt") {
        if (app.installPrompt) page.append(h("button", { class: "btn primary", style: { alignSelf: "flex-start" }, onclick: async () => {
          const ev = app.installPrompt; app.installPrompt = null; ev.prompt(); const r = await ev.userChoice; if (r.outcome === "accepted") toast("Installing…"); draw();
        } }, icon("down", 20), "Install"), h("p", { class: "muted" }, "Or do it yourself:"));
        page.append(stepsList(g.fallback));
      } else if (g.kind === "steps") page.append(stepsList(g.steps));
      else if (g.kind === "openInBrowser") page.append(h("div", { class: "panel" }, h("p", { style: { margin: 0 } }, `You're inside another app's browser, which can't install web apps. Open this page in ${g.target}: tap the menu (often ••• or a compass icon) and choose Open in browser.`),
        h("button", { class: "btn small quiet", style: { alignSelf: "flex-start" }, onclick: async () => { try { await navigator.clipboard.writeText(SITE); toast("Link copied"); } catch { toast(SITE); } } }, "Copy the link")));
      else page.append(h("div", { class: "panel" }, h("p", { style: { margin: 0 } }, g.note)));
    }
    if (d.form === "desktop") page.append(h("h2", {}, "Get it on your phone"), h("div", { class: "panel", style: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: "22px" } }, qr(SITE + "/#/install"),
      h("p", { style: { margin: 0, flex: 1, minWidth: "200px" } }, "Point your phone's camera at this code. It opens Lumin Vocab with the right steps for that phone.")));
    page.append(footer());
  };
  draw();
  const ready = () => { if (document.body.contains(page)) draw(); else document.removeEventListener("lumin-install-ready", ready); };
  document.addEventListener("lumin-install-ready", ready);
});

// ---- About / credits ---------------------------------------------------------
route("about", (main) => {
  const li = (...k) => h("li", { style: { marginBottom: "10px" } }, ...k);
  main.append(h("div", { class: "page narrow" },
    h("h1", {}, "Credits and licenses"),
    h("p", { class: "lead" }, "Lumin Vocab is free and open source. Here's what it's built from."),
    h("div", { class: "panel" }, h("h2", {}, "The app"),
      h("p", { style: { margin: 0 } }, `Lumin Vocab ${VERSION}, made by `, h("a", { href: "https://b7collective.com", rel: "noopener" }, "B7 Collective LLC"), ". Code licensed under the GNU Affero General Public License v3.0. ", h("a", { href: SOURCE, rel: "noopener" }, "Get the source code"), ".")),
    h("div", { class: "panel" }, h("h2", {}, "Words"),
      h("p", { style: { margin: 0 } }, "The word list is released under CC BY-SA 4.0 and built from:"),
      h("ul", { style: { margin: 0, paddingLeft: "20px" } },
        li("Sprout and Explorer definitions and examples: written for Lumin Vocab by B7 Collective."),
        li("Scholar and Wordsmith definitions and examples: adapted from ", h("a", { href: "https://en-word.net", rel: "noopener" }, "Open English WordNet"), " by the Open English WordNet Community, CC BY 4.0. WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved. THIS SOFTWARE AND DATABASE IS PROVIDED \"AS IS\" AND PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED."),
        li("Pronunciation respellings: generated from the CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University, BSD 2-Clause License."),
        li("Word difficulty: ranked using word frequencies from wordfreq by Robyn Speer (data CC BY-SA 4.0), which includes data from Google Books Ngram, OpenSubtitles, SUBTLEX by Marc Brysbaert et al., and other sources."),
        li("Family-safe filtering: helped by the List of Dirty, Naughty, Obscene, and Otherwise Bad Words, CC BY 4.0."))),
    h("div", { class: "panel" }, h("h2", {}, "Other parts"),
      h("ul", { style: { margin: 0, paddingLeft: "20px" } },
        li("Review scheduling: based on the FSRS algorithm by the open-spaced-repetition project (MIT)."),
        li("Fonts: Literata (SIL Open Font License 1.1) and Atkinson Hyperlegible by the Braille Institute (SIL Open Font License 1.1)."),
        li("QR codes: qrcode-generator by Kazuhiko Arase (MIT). QR Code is a registered trademark of DENSO WAVE INCORPORATED."))),
    h("a", { href: app.profile ? "#/settings" : "#/welcome" }, "Back"), footer()));
});
