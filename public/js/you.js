// Lumin Vocab: You. Streak, progress, and the doors to settings and family.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
import * as model from "./model.js";
import { app, route } from "./app.js";
import { h, icon, avatar, plural } from "./ui.js";
import { art, icon as artIcon, keeperArt, landFor, groundUrl } from "./art.js";
import { chapterInfo } from "./journey.js";
import { countUp } from "./motion.js";

route("you", (main) => {
  const p = app.profile, st = model.stats(p.id), n = model.streak(p), j = model.journeyState(p);
  const favs = model.cards(p.id).filter((c) => c.fav).length;
  const page = h("div", { class: "hub" });
  main.append(page);
  page.append(h("div", { class: "youhead" }, avatar(p, "lg"),
    h("div", { class: "stack tight grow" }, h("h1", {}, p.name), h("span", { class: "muted" }, `${model.LEVELS[p.level].name}, ${model.LEVELS[p.level].ages.toLowerCase()}. ${model.LEVELS[p.level].about}.`))));

  page.append(h("section", { class: "streak", "aria-label": "Streak" }, art(artIcon("streak"), "", 96),
    h("div", { class: "stack tight" },
      h("div", {}, h("span", { class: "n" }, String(n)), " ", h("strong", {}, n === 1 ? "day streak" : "day streak")),
      h("span", { class: "muted small" }, n ? "See or practice a word each day to keep it going." : "See or practice a word today to start one."),
      h("div", { class: "weekdots" }, model.week(p).map((d) => h("span", { class: (d.active ? "on" : "") + (d.today ? " today" : "") }, d.label, h("i", {}, d.active ? icon("check") : null)))))));

  const tile = (b, label, href) => h(href ? "a" : "div", { class: "stat", href }, h("b", {}, String(b)), h("span", {}, label));
  page.append(h("div", { class: "stats" },
    tile(st.seen, "Words seen", "#/library/history"), tile(st.learning, "Learning", "#/practice"), tile(st.mastered, "Mastered", "#/practice"), tile(favs, "Favorites", "#/library/favorites")));

  // The road so far: lights in the lantern, keepsakes found, trails walked
  const chs = model.chapterWords(p.level), lights = j.log.reduce((n, e) => n + (chs[e.ch] && !chs[e.ch].lookout ? chs[e.ch].words.length : 0), 0);
  const keepsakes = j.log.filter((e) => chs[e.ch] && !chs[e.ch].lookout).length;
  const trailsDone = Object.values(p.trails || {}).reduce((n, t) => n + ((t && t.log) || []).length, 0);
  page.append(h("a", { class: "roadcard land", href: "#/journey" }, h("div", { class: "ground", "aria-hidden": "true", style: { "--ground": `url(${groundUrl(landFor(model.regionOf(j.ch)[0]).ground)})` } }), h("img", { src: keeperArt("lantern"), alt: "", width: 84, height: 84 }),
    h("div", { class: "stack tight grow" }, h("strong", {}, "The road so far"),
      h("div", { class: "roadstats" }, h("span", {}, h("b", {}, String(lights)), lights === 1 ? " light" : " lights"), h("span", {}, h("b", {}, String(keepsakes)), keepsakes === 1 ? " keepsake" : " keepsakes"), h("span", {}, h("b", {}, String(trailsDone)), trailsDone === 1 ? " trail marker" : " trail markers"))),
    h("span", { class: "chev" }, icon("right"))));
  page.querySelectorAll(".stat b, .streak .n, .roadstats b").forEach((b) => countUp(b, +b.textContent));
  const ci = chapterInfo(p, j.ch);
  const row = (href, ic, title, sub) => h("a", { href }, icon(ic), h("span", {}, title, sub ? h("small", {}, sub) : null), h("span", { class: "chev" }, icon("right")));
  page.append(h("nav", { class: "menu", "aria-label": "More" },
    row("#/journey", "map", "The Lantern Road", ci.words.length ? `${model.regionOf(j.ch)[1]}, stop ${j.ch + 1} of ${ci.count}` : "The whole road, walked"),
    row("#/settings", "sliders", "Settings", "Difficulty, scenes, sound, reading"),
    row("#/family", "family", "Family and sync", "Profiles, devices, PIN"),
    model.profiles().length > 1 ? row("#/who", "user", "Switch profile", null) : null,
    app.canInstall && app.canInstall() ? row("#/install", "down", "Install the app", "Full screen, works offline") : null,
    row("#/about", "info", "About and credits", "Free and open source")));
});
