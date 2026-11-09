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
import { canScan, scanCode } from "./scan.js";
import { SCENES, sceneUrl, topicArt } from "./art.js";
import "./words.js";
import "./journey.js";
import "./practice.js";
import "./games.js";
import "./library.js";
import "./you.js";

const SITE = "https://lumin.b7collective.com";
const SOURCE = "https://github.com/B7Collective/lumin-vocab";
const LEVEL = (l) => model.LEVELS[l] || model.LEVELS[3];
const LEVEL_ICON = ["sprout", "t-nature", "t-mind", "star"], LEVEL_TINT = [6, 1, 5, 3]; // used by the word check

function footer({ short = false } = {}) {
  return h("footer", { class: "footer" }, short ? null : h("p", {}, "100% free. No ads, no tracking, no accounts."),
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
const section = (title, ic, color, ...kids) => h("section", { class: "section" }, h("h2", { class: "sec-title" }, title), ...kids);
// Small paper illustration used in chips and choices
const thumb = (src, size = 26) => h("img", { class: "thumb", src, alt: "", width: size, height: size, loading: "lazy" });
const ROLE_ART = { adult: "character", teen: "talk", kid: "animals" }, LEVEL_ART = ["nature", "places", "science", "mywords"];
const backup = () => download(`lumin-vocab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll()));
const swatches = (selected, onpick) => h("div", { class: "chips", role: "group", "aria-label": "Color" }, model.COLORS.map((c, i) =>
  h("button", { class: "swatch", "aria-label": `Color ${i + 1}`, "aria-pressed": String(selected === i), style: { background: c.bg, color: c.fg }, onclick: () => onpick(i) }, selected === i ? icon("check", 20) : null)));

// ---- Welcome -------------------------------------------------------------
// A window onto a scene, with a word from each level arriving the way it does in the app.
// Draws before the word list loads, so these samples are copied from it.
const SAMPLES = [
  { w: "gentle", p: "adj.", i: "JEHN-tuhl", d: "Soft and careful, not rough", scene: "lavender", x: 54 },
  { w: "curious", p: "adj.", i: "/ˈkjʊriəs/", d: "Eager to know or learn something", scene: "forest", x: 50 },
  { w: "meticulous", p: "adj.", i: "/məˈtɪkjələs/", d: "Showing great attention to detail; very careful", scene: "attic", x: 46 },
  { w: "ineffable", p: "adj.", i: "/ɪˈnɛfəbəl/", d: "Too great or extreme to be expressed in words", scene: "library", x: 56 },
];
route("welcome", (main) => {
  let cur = 0, timer = null;
  const bgs = SAMPLES.map((x, k) => h("img", { class: "wbg", src: k ? null : sceneUrl(x.scene), "data-src": sceneUrl(x.scene), alt: "", style: { "--fx": x.x + "%", opacity: k ? "0" : "1", transition: "opacity 1.2s var(--ease)" }, decoding: "async", fetchpriority: k ? "low" : "high" }));
  // The other scenes load once the first is on screen, so the page appears quickly
  addEventListener("load", () => setTimeout(() => bgs.forEach((b) => { if (!b.src) b.src = b.dataset.src; }), 600), { once: true });
  if (document.readyState === "complete") setTimeout(() => bgs.forEach((b) => { if (!b.src) b.src = b.dataset.src; }), 600);
  const sample = h("div", { class: "wsample", "aria-live": "polite" });
  const show = (k) => {
    const x = SAMPLES[k]; cur = k;
    bgs.forEach((b, j) => { b.style.opacity = j === k ? "1" : "0"; });
    const word = h("div", { class: "wword", lang: "en" }, [...x.w].map((ch, i) => h("span", { class: "ch", style: { "--i": i } }, ch)));
    sample.replaceChildren(h("span", { class: "wpos" }, model.LEVELS[k].name + ", " + model.LEVELS[k].ages.toLowerCase()), word, h("span", { class: "wipa glass" }, x.i), h("p", { class: "wdef" }, `(${x.p}) ${x.d}`));
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
        feat("/art/icons/flashcards.webp", "One word at a time", "Swipe through words in a calm, beautiful space. Tap to hear them said."),
        feat("/art/journey/lighthouse.webp", "A Journey to follow", "Short chapters with games, from words everyone should know to rare ones."),
        feat("/art/icons/review.webp", "Practice that sticks", "Words come back just before you'd forget them, as quick games."),
        feat("/art/icons/society.webp", "A profile for everyone", "Each person learns at their own level, synced privately across devices."))),
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
      const roles = [["adult", "An adult", "Rich, rare words like perspicacious", "t-mind", 5], ["teen", "A teen", "Words that matter at school", "target", 4], ["kid", "A kid", "Friendly words, simple sounds, read aloud", "sprout", 6]];
      page.append(head(1, first ? "Let's set up your profile" : "Add someone to your family", first ? "Start with yourself. You can add your family next, and everyone gets their own words and progress." : null),
        h("div", { class: "field" }, h("span", { class: "flabel" }, "Who is this profile for?"),
          h("div", { class: "choices" }, roles.map(([k, t, sub, ic, c]) => h("button", { class: "choice", "aria-pressed": String(s.role === k), onclick: () => { s.role = k; s.level = k === "adult" ? 3 : k === "teen" ? 2 : 0; draw(); } },
            h("img", { class: "art-badge", src: `/art/icons/${ROLE_ART[k]}.webp`, alt: "", width: 64, height: 64 }), h("span", { class: "ttl" }, t), h("span", { class: "sub" }, sub))))),
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
          h("img", { class: "art-badge", src: `/art/icons/${LEVEL_ART[l]}.webp`, alt: "", width: 64, height: 64 }),
          h("span", { class: "ttl" }, model.LEVELS[l].name, suggested.includes(l) ? h("span", { class: "suggest" }, "Suggested") : null),
          h("span", { class: "sub" }, model.LEVELS[l].ages), h("span", { class: "s" }, model.LEVELS[l].sample)))),
        h("div", { class: "stack tight" },
          h("button", { class: "linkbtn start", onclick: () => wordCheck(s.role, (l) => { s.level = l; draw(); toast(`${model.LEVELS[l].name} looks like a good fit`); }) }, "Not sure? Take the word check"),
          h("p", { class: "muted" }, "You can change this any time in settings.")),
        h("div", { class: "actions between" }, h("button", { class: "btn quiet", onclick: () => { s.step = 1; draw(); } }, "Back"), h("button", { class: "btn primary", onclick: () => { s.step = 3; draw(); } }, "Continue")));
    } else {
      const kid = s.role === "kid";
      page.append(head(3, kid ? `What does ${s.name.trim()} like?` : "What are you into?", "Pick any topics to see more of them. Or skip, and you'll get a mix."),
        h("div", { class: "chips" }, model.TOPICS.filter(t => t !== "My words").map((t) => h("button", { class: "chip", "aria-pressed": String(s.topics.includes(t)), onclick: (e) => { s.topics = s.topics.includes(t) ? s.topics.filter(x => x !== t) : [...s.topics, t]; e.currentTarget.setAttribute("aria-pressed", String(s.topics.includes(t))); } }, thumb(topicArt(t)), t))),
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

  page.append(h("a", { class: "back", href: "#/you" }, icon("left"), "You"), h("div", { class: "phead" }, h("div", {}, h("h1", {}, "Settings"), h("p", {}, `For ${p.name}. Changes save as you go.`))));

  // Look (everyone, kids first)
  const cur = p.scene || "auto";
  const themes = h("div", { class: "scenes", role: "group", "aria-label": "Scene" },
    h("button", { class: "scene auto", "aria-pressed": String(cur === "auto"), onclick: (e) => { save({ scene: "auto" }); pressOne(e, ".scene"); } }, icon("sync"), "Changes with each word"),
    SCENES.map((sc) => h("button", { class: "scene", "aria-pressed": String(cur === sc.id), onclick: (e) => { save({ scene: sc.id }); pressOne(e, ".scene"); } },
      h("img", { src: sceneUrl(sc.id), alt: "", loading: "lazy", width: 160, height: 120 }), h("span", {}, sc.name))));
  const scale = h("input", { type: "range", id: "set-scale", min: "0.9", max: "1.3", step: "0.05", value: String(p.scale || (model.isKid(p) ? 1.08 : 1)), oninput: (e) => save({ scale: parseFloat(e.target.value) }) });
  const avatarPick = swatches(p.color, (i) => { save({ color: i }); render(); });
  page.append(sec(kid ? "My look" : "Look",
    h("div", { class: "field" }, h("span", { class: "flabel" }, "Scene behind words"), themes),
    h("div", { class: "field" }, h("label", { for: "set-scale" }, "Text size"), h("div", { class: "range-row" }, h("span", { "aria-hidden": "true", class: "small muted" }, "A"), scale, h("span", { "aria-hidden": "true", style: { fontSize: "22px" }, class: "muted" }, "A"))),
    kid ? h("div", { class: "field" }, h("span", { class: "flabel" }, "My color"), avatarPick) : null,
    lockedKid ? null : seg("Appearance", [["device", "Match device"], ["light", "Light"], ["dark", "Dark"]], ["light", "dark"].includes(p.dark) ? p.dark : "device", (v) => save({ dark: v })),
    lockedKid ? null : (() => { const sys = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const el = sw("Calmer motion", sys ? "On, because this device asks for less motion" : "Fewer animations when moving between words", sys || !!p.calm, (v) => save({ calm: v }));
      if (sys) el.querySelector("input").disabled = true; return el; })()));

  // Sound
  page.append(sec(kid ? "Reading help" : "Sound", sw("Sound effects", "Soft chimes when you answer and finish", p.sound !== false, (v) => save({ sound: v }))));
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
    h("div", { class: "field" }, h("span", { class: "flabel" }, "Favorite topics"), h("div", { class: "chips" }, model.TOPICS.map(t => h("button", { class: "chip", "aria-pressed": String((p.topics || []).includes(t)), onclick: (e) => { const cur = model.profile(p.id).topics || []; const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]; save({ topics: next }); e.currentTarget.setAttribute("aria-pressed", String(next.includes(t))); } }, thumb(topicArt(t)), t)))),
    seg("Words per review", [[10, "10"], [20, "20"], [30, "30"]], p.reviewSize || 20, (v) => save({ reviewSize: v })),
    h("a", { class: "linkbtn start", href: "#/practice" }, "Not sure? Take the level check in Practice"));
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
    h("div", { class: "actions" }, h("a", { class: "btn small quiet", href: "#/about" }, "Credits and licenses"), h("a", { class: "btn small quiet", href: SOURCE, rel: "noopener" }, "Source code"))), footer());
});

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
        h("li", {}, "Similar words and word families: from ", h("a", { href: "https://en-word.net", rel: "noopener" }, "Open English WordNet"), " by the Open English WordNet Community, CC BY 4.0. WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved. THIS SOFTWARE AND DATABASE IS PROVIDED \"AS IS\" AND PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED."),
        h("li", {}, "Pronunciations (IPA and simple respellings): generated from the CMU Pronouncing Dictionary, Copyright (C) 1993-2015 Carnegie Mellon University, BSD 2-Clause License."),
        h("li", {}, "Journey order, from common to rare: ranked using word frequencies from wordfreq by Robyn Speer (data CC BY-SA 4.0), which includes data from Google Books Ngram, OpenSubtitles, SUBTLEX by Marc Brysbaert et al., and other sources."),
        h("li", {}, "Family-safe filtering: helped by the List of Dirty, Naughty, Obscene, and Otherwise Bad Words, CC BY 4.0."))),
    h("div", { class: "panel" }, h("h2", {}, "Pictures and sound"),
      h("ul", { class: "credits" },
        h("li", {}, "Scenes and paper illustrations: made for Lumin Vocab by B7 Collective with Google Gemini image generation. They are AI-generated, not photographs, and are dedicated to the public domain (CC0 1.0)."),
        h("li", {}, "Sounds: synthesized in your browser by the app's own code; there are no audio files."))),
    h("div", { class: "panel" }, h("h2", {}, "Other parts"),
      h("ul", { class: "credits" },
        h("li", {}, "Review scheduling: based on the FSRS algorithm by the open-spaced-repetition project (MIT)."),
        h("li", {}, "Fonts: Literata (SIL Open Font License 1.1) and Atkinson Hyperlegible by the Braille Institute (SIL Open Font License 1.1)."),
        h("li", {}, "QR codes: qrcode-generator by Kazuhiko Arase (MIT) draws them, and jsQR by Cosmo Wolfe (Apache License 2.0) reads them. QR Code is a registered trademark of DENSO WAVE INCORPORATED."))),
    h("a", { class: "textlink start", href: app.profile ? "#/settings" : "#/welcome" }, "Back"), footer()));
});
