// Lumin Vocab: You. Streak, progress, and the doors to settings and family.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import { app, route } from "./app.js";
import { h, icon, avatar, plural } from "./ui.js";
import { art, icon as artIcon } from "./art.js";
import { chapterInfo } from "./journey.js";
import { countUp } from "./motion.js";

route("you", (main) => {
  const p = app.profile, st = model.stats(p.id), n = model.streak(p), j = model.journeyState(p);
  const favs = model.cards(p.id).filter((c) => c.fav).length;
  const page = h("div", { class: "hub" });
  main.append(page);
  page.append(h("div", { class: "youhead" }, avatar(p, "lg"),
    h("div", { class: "stack tight grow" }, h("h1", {}, p.name), h("span", { class: "muted" }, `${model.LEVELS[p.level].name}, ${model.LEVELS[p.level].ages.toLowerCase()}`))));

  page.append(h("section", { class: "streak", "aria-label": "Streak" }, art(artIcon("streak"), "", 96),
    h("div", { class: "stack tight" },
      h("div", {}, h("span", { class: "n" }, String(n)), " ", h("strong", {}, n === 1 ? "day streak" : "day streak")),
      h("span", { class: "muted small" }, n ? "See or practice a word each day to keep it going." : "See or practice a word today to start one."),
      h("div", { class: "weekdots" }, model.week(p).map((d) => h("span", { class: (d.active ? "on" : "") + (d.today ? " today" : "") }, d.label, h("i", {}, d.active ? icon("check") : null)))))));

  const tile = (b, label, href) => h(href ? "a" : "div", { class: "stat", href }, h("b", {}, String(b)), h("span", {}, label));
  page.append(h("div", { class: "stats" },
    tile(st.seen, "Words seen", "#/library/history"), tile(st.learning, "Learning", "#/practice"), tile(st.mastered, "Mastered", "#/practice"), tile(favs, "Favorites", "#/library/favorites")));

  page.querySelectorAll(".stat b, .streak .n").forEach((b) => countUp(b, +b.textContent));
  const ci = chapterInfo(p.level, j.ch);
  const row = (href, ic, title, sub) => h("a", { href }, icon(ic), h("span", {}, title, sub ? h("small", {}, sub) : null), h("span", { class: "chev" }, icon("right")));
  page.append(h("nav", { class: "menu", "aria-label": "More" },
    row("#/journey", "map", "Journey", ci.words.length ? `${model.regionOf(j.ch)[1]}, stop ${j.ch + 1} of ${ci.count}` : "The whole road, walked"),
    row("#/settings", "sliders", "Settings", "Level, scenes, sound, reading"),
    row("#/family", "family", "Family and sync", "Profiles, devices, PIN"),
    model.profiles().length > 1 ? row("#/who", "user", "Switch profile", null) : null,
    app.canInstall && app.canInstall() ? row("#/install", "down", "Install the app", "Full screen, works offline") : null,
    row("#/about", "info", "About and credits", "Free and open source")));
});
