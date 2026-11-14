// Lumin Vocab: Library (favorites, lists, history, your own words) and Topics.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import * as store from "./store.js";
import { app, route, go, render } from "./app.js";
import { h, icon, toast, ask, confirmBox, plural, tile } from "./ui.js";
import { art, icon as artIcon, topicArt, trailArt } from "./art.js";
import { wordCard, addWord } from "./wordsheet.js";
import { start } from "./games.js";

const LOOKUP = "https://lookup.b7collective.com"; // Lumin Lookup, the sister dictionary and thesaurus
const SHELVES = [
  { key: "favorites", name: "Favorites", art: "favorites", empty: "Tap the heart on any word to keep it here." },
  { key: "saved", name: "Saved", art: "review", empty: "Tap the bookmark on any word to save it. Saved words come back in Practice." },
  { key: "lists", name: "Lists", art: "lists", empty: "Make a list for a book, a trip or a test." },
  { key: "history", name: "History", art: "history", empty: "Every word you see shows up here." },
  { key: "mine", name: "My words", art: "mywords", empty: "Add words you meet in books or conversation." },
];
function shelfWords(p, key) {
  const cs = model.cards(p.id);
  const when = (c) => Math.max(c.actAt || 0, c.seenAt || 0);
  if (key === "favorites") return cs.filter((c) => c.fav).sort((a, b) => when(b) - when(a)).map((c) => [c.w, when(c)]);
  if (key === "saved") return cs.filter((c) => c.st === "learning" || (c.st === "known" && c.srs)).sort((a, b) => when(b) - when(a)).map((c) => [c.w, when(c)]);
  if (key === "history") return cs.sort((a, b) => when(b) - when(a)).map((c) => [c.w, when(c)]);
  if (key === "mine") return model.customWords(p.id).sort((a, b) => b.created - a.created).map((c) => [c.w, c.created]);
  return [];
}

route("library", (main, args) => {
  const p = app.profile, [key, id] = args;
  const page = h("div", { class: "hub" });
  main.append(page);

  if (!key) {
    page.append(h("div", { class: "phead" }, h("div", {}, h("h1", {}, "Library"), h("p", {}, "Everything you've kept, in one place."))),
      h("div", { class: "lib" }, SHELVES.map((s) => {
        const n = s.key === "lists" ? model.collections(p.id).length : shelfWords(p, s.key).length;
        return h("a", { class: "gcard", href: `#/library/${s.key}` }, art(artIcon(s.art), "", 240), h("strong", {}, s.name), h("small", {}, s.key === "lists" ? plural(n, "list") : plural(n, "word")));
      })),
      h("a", { class: "btn start", href: "#/topics" }, icon("grid"), "Browse topics"),
      // Our sister app, for any word at all: a word's full entry is one tap from every word sheet too
      h("a", { class: "lookupcard", href: LOOKUP, rel: "noopener" },
        h("img", { src: "/icons/lumin-lookup.png", alt: "", width: 56, height: 56, loading: "lazy" }),
        h("span", {}, h("strong", {}, "Lumin Lookup"),
          h("small", {}, "Our free dictionary and thesaurus: about 225,000 entries, synonyms sorted by meaning, and where each word came from, drawn as a journey. Can't think of a word? Describe it. Your family code works there too.")),
        h("span", { class: "chev" }, icon("right"))));
    return;
  }

  const shelf = SHELVES.find((s) => s.key === key);
  if (!shelf) { go("/library"); return; }
  page.append(h("a", { class: "back", href: key === "lists" && id ? "#/library/lists" : "#/library" }, icon("left"), key === "lists" && id ? "Lists" : "Library"));

  if (key === "lists") {
    if (id) return listPage(page, p, id);
    const cols = model.collections(p.id);
    page.append(hero(shelf, plural(cols.length, "list")),
      h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: async () => { const name = await ask("New list", { label: "Name", confirm: "Create", maxlength: 40 }); if (name && name.trim()) { const col = model.newCollection(p.id, name.trim()); go(`/library/lists/${col.id}`); } } }, icon("plus"), "New list")),
      cols.length ? h("div", { class: "menu" }, cols.map((c) => h("a", { href: `#/library/lists/${c.id}` }, icon("folder"), h("span", {}, c.name, h("small", {}, plural(c.words.length, "word") + (c.shared ? ", shared with family" : ""))), h("span", { class: "chev" }, icon("right")))))
        : h("p", { class: "muted" }, shelf.empty));
    return;
  }

  const items = shelfWords(p, key);
  page.append(hero(shelf, plural(items.length, "word")));
  const acts = h("div", { class: "actions" });
  if (items.length >= 2) acts.append(h("button", { class: "btn primary", onclick: () => start({ title: shelf.name, words: practiceFrom(items), kind: "mixed", art: shelf.art, back: `/library/${key}` }) }, "Practice these"));
  if (key === "mine") acts.append(h("button", { class: "btn", onclick: () => addWord() }, icon("plus"), "Add a word"));
  page.append(acts);
  if (!items.length) { page.append(h("p", { class: "muted" }, shelf.empty)); return; }
  // Long histories render in pages so the screen stays quick
  const list = h("div", { class: "wlist" }); page.append(list);
  let shown = 0;
  const more = h("button", { class: "btn quiet start", onclick: () => draw() }, "Show more");
  const draw = () => { items.slice(shown, shown + 30).forEach(([w, t]) => { const c = wordCard(w, { when: t }); if (c) list.append(c); }); shown += 30; if (shown >= items.length) more.remove(); };
  draw(); if (shown < items.length) page.append(more);
});

const practiceFrom = (items) => items.slice(0, 20).map(([w]) => model.lookup(w)).filter(Boolean).sort(() => Math.random() - 0.5);
const hero = (shelf, sub) => h("div", { class: "listhero" }, art(artIcon(shelf.art), "", 96), h("div", {}, h("h1", {}, shelf.name), h("p", { class: "muted" }, sub)));

function listPage(page, p, id) {
  const col = model.collections(p.id).find((c) => c.id === id);
  if (!col) { page.append(h("p", { class: "muted" }, "This list was removed.")); return; }
  page.append(h("div", { class: "listhero" }, art(artIcon("lists"), "", 96), h("div", {}, h("h1", {}, col.name), h("p", { class: "muted" }, plural(col.words.length, "word") + (col.shared ? ", shared with family" : "")))),
    h("div", { class: "actions" },
      col.words.length >= 2 ? h("button", { class: "btn primary", onclick: () => start({ title: col.name, words: practiceFrom(col.words.map((w) => [w])), kind: "mixed", art: "lists", back: `/library/lists/${col.id}` }) }, "Practice these") : null,
      h("button", { class: "btn quiet", onclick: async () => { const n = await ask("Rename list", { label: "Name", confirm: "Save", maxlength: 40 }); if (n && n.trim()) { const fresh = model.collections(p.id).find((c) => c.id === col.id); if (fresh) model.saveCollection({ ...fresh, name: n.trim() }); render({ refresh: true }); } } }, "Rename"),
      h("button", { class: "btn quiet", onclick: () => { const fresh = model.collections(p.id).find((c) => c.id === col.id) || col; model.saveCollection({ ...fresh, shared: !col.shared }); toast(col.shared ? "Only you can see this list now" : "Shared with your family"); render({ refresh: true }); } }, col.shared ? "Stop sharing" : "Share with family"),
      h("button", { class: "btn quiet danger", onclick: async () => { if (await confirmBox("Delete this list?", `"${col.name}" will be removed. The words stay in your history.`, "Delete", true)) { store.remove("col:" + col.id); go("/library/lists"); } } }, "Delete")));
  if (!col.words.length) page.append(h("p", { class: "muted" }, "Add words from any word's details: tap the info button on the Words screen, then Add to a list."));
  else page.append(h("div", { class: "wlist" }, col.words.map((w) => wordCard(w))));
}

// ---- Topics -----------------------------------------------------------------
route("topics", (main) => {
  const p = app.profile, counts = model.topicCounts(p), allowed = model.levelsFor(p);
  const page = h("div", { class: "hub" });
  main.append(page);
  const pickTopic = (t, set) => { model.saveProfile({ ...model.profile(p.id), feedTopic: t || null, feedSet: set || null }); go("/words"); };
  const current = p.feedSet || p.feedTopic || "";
  const card = (label, sub, src, on, onclick) => tile({ label, sub, src, on, onclick, note: on ? " (showing now)" : "" });
  page.append(h("div", { class: "phead" }, h("div", {}, h("h1", {}, "Topics"), h("p", {}, "Choose what the Words screen shows. Your difficulty still decides how hard."))),
    h("div", { class: "actions" }, h("button", { class: "btn" + (current ? "" : " primary"), onclick: () => pickTopic(null) }, current ? "Show all words" : "Showing all words at your level")));
  const setWords = (set) => model.MAIN.filter((w) => w.x && w.x.includes(set) && allowed.includes(w.l));
  const sets = [["beautiful", "Beautiful words"], ["funny", "Funny words"]].filter(([k]) => setWords(k).length >= 4);
  if (sets.length) page.append(h("section", { class: "sec" }, h("h2", {}, "Collections"),
    h("div", { class: "ttiles" }, sets.map(([k, label]) => card(label, plural(setWords(k).length, "word"), artIcon(k), current === k, () => pickTopic(null, k))))));
  const trails = model.trailsFor(p);
  if (trails.length) page.append(h("section", { class: "sec" }, h("h2", {}, "Side trails"), h("p", {}, "Themed sets. You can also walk each one as a short journey."),
    h("div", { class: "ttiles" }, trails.map((t) => card(t.name, plural(model.trailWords(t, p).length, "word"), trailArt(t.key), current === t.key, () => pickTopic(null, t.key))))));
  const topics = Object.entries(counts).filter(([, n]) => n >= 4).sort((a, b) => a[0].localeCompare(b[0]));
  page.append(h("section", { class: "sec" }, h("h2", {}, "By topic"),
    h("div", { class: "ttiles" }, topics.map(([t, n]) => card(t, plural(n, "word"), topicArt(t), current === t, () => pickTopic(t))))));
});
