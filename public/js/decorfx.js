// Lumin Vocab: little surprises when you tap the things beside the Journey road.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
// Every effect is drawn here in code (shapes and the Web Animations API); there are no outside assets.
import { play, buzz } from "./sound.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm");
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const SPRING = "cubic-bezier(.34, 1.4, .5, 1)", OUT = "cubic-bezier(.22, .8, .24, 1)";

// ---- How the thing itself moves --------------------------------------------------------------------------------
const MOVES = {
  squash: [[1, 1, 0], [1.16, .84, 0], [.9, 1.12, 0], [1.04, .97, 0], [1, 1, 0]],
  grow: [[1, 1, 0], [1.2, 1.2, 0], [1.2, 1.2, 0], [.96, .96, 0], [1, 1, 0]],
  wiggle: [[1, 1, 0], [1, 1, -9], [1, 1, 8], [1, 1, -5], [1, 1, 3], [1, 1, 0]],
  rustle: [[1, 1, 0], [1, 1, 6], [1, 1, -6], [1, 1, 5], [1, 1, -4], [1, 1, 2], [1, 1, 0]],
  tilt: [[1, 1, 0], [1, 1, -24], [1, 1, -24], [1, 1, 4], [1, 1, 0]],
};
function move(img, kind) {
  if (kind === "tilt") { const s = img.classList.contains("flip") ? -1 : 1;
    return img.animate([0, 22, 22, -4, 0].map((r) => ({ transform: `rotate(${r * s}deg)` })), { duration: 1100, easing: OUT }); }
  const opts = { duration: 620, easing: OUT };
  if (kind === "hop") return img.animate([
    { transform: "translateY(0) scale(1, 1)" }, { transform: "translateY(2%) scale(1.1, .9)", offset: .15 },
    { transform: "translateY(-26%) scale(.94, 1.08)", offset: .5 }, { transform: "translateY(0) scale(1.08, .92)", offset: .82 },
    { transform: "translateY(0) scale(1, 1)" }], { duration: 640, easing: "ease-out" });
  if (kind === "bob") return img.animate([{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(6%) rotate(-4deg)" },
    { transform: "translateY(-5%) rotate(3deg)" }, { transform: "translateY(2%) rotate(-1deg)" }, { transform: "translateY(0) rotate(0)" }], { duration: 1100, easing: "ease-in-out" });
  if (kind === "spin") return img.animate([{ transform: "perspective(400px) rotateY(0) scale(1)" }, { transform: "perspective(400px) rotateY(180deg) scale(1.12)" },
    { transform: "perspective(400px) rotateY(360deg) scale(1)" }], { duration: 760, easing: OUT });
  if (kind === "glow") return img.animate([{ filter: "drop-shadow(0 0 0 rgba(255, 206, 110, 0)) brightness(1)" },
    { filter: "drop-shadow(0 0 16px rgba(255, 206, 110, .95)) brightness(1.18)", offset: .3 },
    { filter: "drop-shadow(0 0 0 rgba(255, 206, 110, 0)) brightness(1)" }], { duration: 1300, easing: "ease-out" });
  const k = MOVES[kind] || MOVES.squash;
  return img.animate(k.map(([sx, sy, r]) => ({ transform: `scale(${sx}, ${sy}) rotate(${r}deg)` })), { ...opts, easing: kind === "grow" ? SPRING : OUT });
}

// ---- Particles: small pieces that appear around the thing and fade -------------------------------------------
const SVG = "http://www.w3.org/2000/svg";
const STAR = "M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5Z";
const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.6 3 5 6.5 5c2.1 0 3.5 1.2 4.3 2.5h2.4C14 6.2 15.4 5 17.5 5 21 5 23.1 8.6 21.6 11.8 19.5 16.4 12 21 12 21Z";
const PETAL = "M12 2c4.5 4 5.5 11 0 20C6.5 13 7.5 6 12 2Z";
const DROP = "M12 2c3.5 5 6 8.6 6 12a6 6 0 0 1-12 0c0-3.4 2.5-7 6-12Z";
function shape(path, color, size) {
  const s = document.createElementNS(SVG, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size);
  const p = document.createElementNS(SVG, "path"); p.setAttribute("d", path); p.setAttribute("fill", color); s.append(p); return s;
}
function bit(host, child, x, y, cls = "") {
  const b = document.createElement("span"); b.className = "fxbit " + cls; b.style.left = x + "%"; b.style.top = y + "%";
  if (child) b.append(child); host.append(b); return b;
}
const done = (anim, el) => { anim.onfinish = () => el.remove(); anim.oncancel = () => el.remove(); };
// Each particle maker: (host, size of the thing in px, options)
const PARTS = {
  stars(host, w, o) {
    const n = 6, colors = o.colors || ["#F2B544", "#FFE2A0", "#FFFFFF"];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-.3, .3), d = w * rnd(.45, .75), sz = rnd(9, 15);
      const b = bit(host, shape(STAR, pick(colors), sz), 50, 42);
      done(b.animate([{ transform: "translate(-50%, -50%) scale(0) rotate(0)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d * .7}px), calc(-50% + ${Math.sin(a) * d * .7}px)) scale(1) rotate(90deg)`, opacity: 1, offset: .55 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2) rotate(160deg)`, opacity: 0 }], { duration: rnd(700, 900), easing: OUT }), b);
    }
  },
  twinkle(host, w) {
    for (let i = 0; i < 5; i++) {
      const b = bit(host, shape(STAR, pick(["#FFF6D8", "#F2B544", "#CFE8FF"]), rnd(8, 13)), rnd(8, 92), rnd(0, 70));
      done(b.animate([{ transform: "translate(-50%, -50%) scale(0) rotate(0)", opacity: 0 }, { transform: "translate(-50%, -50%) scale(1.15) rotate(45deg)", opacity: 1, offset: .4 },
        { transform: "translate(-50%, -50%) scale(0) rotate(90deg)", opacity: 0 }], { duration: 900, delay: i * 110, easing: "ease-in-out", fill: "backwards" }), b);
    }
  },
  petals(host, w, o) {
    const colors = o.colors || ["#F4B6C8", "#FFFFFF"];
    for (let i = 0; i < 7; i++) {
      const b = bit(host, shape(PETAL, pick(colors), rnd(10, 14)), rnd(25, 75), rnd(10, 40)), dx = rnd(-w * .5, w * .5), fall = w * rnd(.6, 1);
      done(b.animate([{ transform: "translate(-50%, -50%) rotate(0)", opacity: 0 }, { transform: `translate(calc(-50% + ${dx * .3}px), calc(-50% + ${fall * .3}px)) rotate(120deg)`, opacity: 1, offset: .2 },
        { transform: `translate(calc(-50% + ${-dx * .2}px), calc(-50% + ${fall * .65}px)) rotate(250deg)`, opacity: .9, offset: .6 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${fall}px)) rotate(380deg)`, opacity: 0 }], { duration: rnd(1300, 1700), delay: i * 70, easing: "ease-in-out", fill: "backwards" }), b);
    }
  },
  fireflies(host, w, o) {
    const color = o.color || "#FFD27A";
    for (let i = 0; i < 7; i++) {
      const b = bit(host, null, rnd(25, 75), rnd(25, 55), "glowdot"); b.style.setProperty("--c", color);
      const rise = w * rnd(.5, 1.1), dx = rnd(-22, 22);
      done(b.animate([{ transform: "translate(-50%, -50%) scale(.4)", opacity: 0 }, { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% - ${rise * .4}px)) scale(1)`, opacity: 1, offset: .3 },
        { transform: `translate(calc(-50% - ${dx * .4}px), calc(-50% - ${rise * .75}px)) scale(.9)`, opacity: .8, offset: .65 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise}px)) scale(.3)`, opacity: 0 }], { duration: rnd(1400, 1900), delay: i * 90, easing: "ease-out", fill: "backwards" }), b);
    }
  },
  ripples(host) {
    for (let i = 0; i < 3; i++) {
      const b = bit(host, null, 50, 88, "ring");
      done(b.animate([{ transform: "translate(-50%, -50%) scale(.2, .07)", opacity: .9 }, { transform: "translate(-50%, -50%) scale(1.5, .45)", opacity: 0 }], { duration: 1200, delay: i * 260, easing: OUT, fill: "backwards" }), b);
    }
  },
  hearts(host, w) {
    for (let i = 0; i < 3; i++) {
      const b = bit(host, shape(HEART, pick(["#E86A8E", "#F29BB2", "#D9466F"]), rnd(12, 17)), rnd(30, 70), 30), rise = w * rnd(.6, .9), dx = rnd(-14, 14);
      done(b.animate([{ transform: "translate(-50%, -50%) scale(0)", opacity: 0 }, { transform: `translate(-50%, calc(-50% - ${rise * .25}px)) scale(1.1)`, opacity: 1, offset: .25 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise}px)) scale(.8)`, opacity: 0 }], { duration: 1300, delay: i * 160, easing: "ease-out", fill: "backwards" }), b);
    }
  },
  notes(host, w) {
    for (let i = 0; i < 4; i++) {
      const b = bit(host, null, rnd(30, 70), 25, "note"); b.textContent = pick(["♪", "♫", "♩"]);
      const rise = w * rnd(.6, 1), dx = rnd(-20, 20);
      done(b.animate([{ transform: "translate(-50%, -50%) rotate(-10deg) scale(.4)", opacity: 0 }, { transform: `translate(calc(-50% + ${dx * .4}px), calc(-50% - ${rise * .35}px)) rotate(8deg) scale(1)`, opacity: 1, offset: .3 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise}px)) rotate(-6deg) scale(.9)`, opacity: 0 }], { duration: 1500, delay: i * 180, easing: "ease-out", fill: "backwards" }), b);
    }
  },
  steam(host, w) {
    for (let i = 0; i < 3; i++) {
      const b = bit(host, null, 42 + i * 8, 22, "puff"), rise = w * rnd(.5, .8);
      done(b.animate([{ transform: "translate(-50%, -50%) scale(.3)", opacity: 0 }, { transform: `translate(-50%, calc(-50% - ${rise * .4}px)) scale(.9)`, opacity: .75, offset: .35 },
        { transform: `translate(calc(-50% + ${rnd(-10, 10)}px), calc(-50% - ${rise}px)) scale(1.8)`, opacity: 0 }], { duration: 1700, delay: i * 240, easing: "ease-out", fill: "backwards" }), b);
    }
  },
  snow(host, w) {
    for (let i = 0; i < 8; i++) {
      const b = bit(host, null, rnd(5, 95), rnd(-15, 15), "flake"), fall = w * rnd(.6, 1.1), dx = rnd(-12, 12);
      done(b.animate([{ transform: "translate(-50%, -50%)", opacity: 0 }, { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${fall * .3}px))`, opacity: 1, offset: .2 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${fall}px))`, opacity: 0 }], { duration: rnd(1500, 2100), delay: i * 90, easing: "linear", fill: "backwards" }), b);
    }
  },
  bees(host, w) {
    for (let i = 0; i < 3; i++) {
      const b = bit(host, null, 50, 45, "bee"), r = w * rnd(.45, .7), turns = rnd(1.2, 1.8), start = rnd(0, Math.PI * 2), frames = [];
      for (let k = 0; k <= 24; k++) { const t = k / 24, a = start + t * turns * Math.PI * 2; frames.push({ transform: `translate(calc(-50% + ${Math.cos(a) * r * (0.6 + t * .4)}px), calc(-50% + ${Math.sin(a * 2) * r * .3 - t * r * .4}px))`, opacity: t < .1 ? t * 10 : t > .85 ? (1 - t) / .15 : 1 }); }
      done(b.animate(frames, { duration: rnd(1800, 2300), delay: i * 150, easing: "linear", fill: "backwards" }), b);
    }
  },
  confetti(host, w) {
    const colors = ["#F2B544", "#E86A8E", "#7CC6CE", "#8FBF7A", "#B58AE0"];
    for (let i = 0; i < 9; i++) {
      const b = bit(host, null, 50, 40, "paper"); b.style.background = pick(colors);
      const a = rnd(-Math.PI * .9, -Math.PI * .1), d = w * rnd(.5, .9), x = Math.cos(a) * d, y = Math.sin(a) * d;
      done(b.animate([{ transform: "translate(-50%, -50%) rotate(0) scale(.5)", opacity: 1 }, { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rnd(180, 360)}deg) scale(1)`, opacity: 1, offset: .45 },
        { transform: `translate(calc(-50% + ${x * 1.2}px), calc(-50% + ${y + w * .9}px)) rotate(${rnd(400, 700)}deg) scale(.8)`, opacity: 0 }], { duration: rnd(1200, 1500), easing: "cubic-bezier(.2, .6, .4, 1)" }), b);
    }
  },
  dust(host, w) {
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
      const b = bit(host, null, 50 + side * 18, 92, "puff dust");
      done(b.animate([{ transform: "translate(-50%, -50%) scale(.3)", opacity: .8 }, { transform: `translate(calc(-50% + ${side * w * rnd(.3, .5)}px), calc(-50% - ${rnd(4, 12)}px)) scale(1.3)`, opacity: 0 }], { duration: 700, delay: 260 + i * 60, easing: OUT, fill: "backwards" }), b);
    }
  },
  drops(host, w, o) {
    const s = o.mirrored ? -1 : 1;
    for (let i = 0; i < 7; i++) {
      const b = bit(host, shape(DROP, pick(["#7CC6CE", "#A9DDE3", "#5AAFB9"]), rnd(7, 10)), 50 + s * rnd(40, 48), rnd(36, 46)), fall = w * rnd(.45, .75);
      done(b.animate([{ transform: "translate(-50%, -50%) scale(.6)", opacity: 0 }, { transform: `translate(calc(-50% + ${s * rnd(4, 12)}px), calc(-50% + ${fall * .4}px)) scale(1)`, opacity: 1, offset: .3 },
        { transform: `translate(calc(-50% + ${s * rnd(8, 18)}px), calc(-50% + ${fall}px)) scale(.8)`, opacity: 0 }], { duration: 900, delay: 240 + i * 80, easing: "cubic-bezier(.5, 0, .9, .6)", fill: "backwards" }), b);
    }
  },
};

// ---- Which effects suit which things ----------------------------------------------------------------------------
const PLANT_COLORS = { lavender: ["#A68AD6", "#C9B3EE"], roses: ["#E06688", "#F4A6BB"], fern: ["#7FA86A", "#A9C98F"], pottedfern: ["#7FA86A", "#A9C98F"],
  edelweiss: ["#FFFFFF", "#F3EEDD"], seathrift: ["#EFA3BE", "#F9CADA"], cattails: ["#B98E5C", "#D9C29A"], mapleleaves: ["#E0782F", "#C9502A", "#F2B544"] };
const FAMILY = {};
const fam = (names, combos) => names.forEach((n) => { FAMILY[n] = combos; });
fam(Object.keys(PLANT_COLORS), [["rustle", "petals"], ["grow", "petals"], ["rustle", "fireflies"]]);
fam(["stumplantern", "docklantern", "streetlamp"], [["glow", "fireflies"], ["grow", "twinkle"], ["glow", "stars"]]);
fam(["rowboat", "buoy", "canoe", "waterlily", "tidepool", "steppingstone", "birdbath"], [["bob", "ripples"], ["wiggle", "ripples"], ["bob", "twinkle"]]);
fam(["snowman", "snowpine", "sled", "mittens"], [["wiggle", "snow"], ["squash", "snow"], ["hop", "snow"]]);
fam(["beehive"], [["wiggle", "bees"], ["squash", "bees"]]);
fam(["cocoa"], [["squash", "steam"], ["grow", "hearts"]]);
fam(["firewood"], [["wiggle", "fireflies"], ["squash", "fireflies"]]);
fam(["books", "openbook", "scroll", "quill"], [["grow", "twinkle"], ["hop", "stars"], ["spin", "twinkle"]]);
fam(["telescope", "moonchest"], [["grow", "twinkle"], ["wiggle", "stars"]]);
fam(["bellrope"], [["wiggle", "notes"], ["rustle", "notes"]]);
fam(["wateringcan"], [["tilt", "drops"]]);
fam(["apples", "acorns", "pinecones", "shells", "bottle", "mushrooms", "mossrock", "cairn"], [["hop", "dust"], ["squash", "stars"], ["spin", "stars"], ["hop", "twinkle"]]);
const DEFAULT = [["squash", "stars"], ["hop", "dust"], ["grow", "confetti"], ["wiggle", "hearts"], ["spin", "twinkle"]];
const SURPRISE = [["grow", "confetti"], ["hop", "hearts"], ["squash", "notes"]];
const SOUND = { stars: "twinkle", twinkle: "twinkle", notes: "bell", ripples: "bloop", drops: "bloop", bees: "buzzy", confetti: "pop", hearts: "pop", petals: "rustle", snow: "twinkle" };

export function tapDecor(dc, name) {
  const img = dc.querySelector("img"); if (!img) return;
  dc.getAnimations({ subtree: true }).forEach((a) => { if (a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains("fxbit")) a.finish(); });
  img.getAnimations().forEach((a) => { if (!(a instanceof CSSAnimation)) a.cancel(); });
  if (reduced()) { img.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-in-out" }); return; }
  // cycle through the combinations that suit this thing, never the same one twice in a row, with a rare surprise
  const options = FAMILY[name] || DEFAULT;
  let combo = Math.random() < 0.12 ? pick(SURPRISE) : options[(Number(dc.dataset.fx || -1) + 1) % options.length];
  if (!SURPRISE.includes(combo)) dc.dataset.fx = String(options.indexOf(combo));
  const [body, parts] = combo, w = dc.getBoundingClientRect().width || 70;
  // lift it above its neighbors while it plays, so nothing covers the sparkle
  if (!dc.dataset.z) dc.dataset.z = dc.style.zIndex || "";
  dc.style.zIndex = "5000"; clearTimeout(dc._fxz); dc._fxz = setTimeout(() => { dc.style.zIndex = dc.dataset.z; }, 2400);
  move(img, body);
  PARTS[parts](dc, w, { colors: PLANT_COLORS[name], color: name === "firewood" ? "#FFA35C" : undefined, mirrored: img.classList.contains("flip") });
  play(SOUND[parts] || "pop"); buzz(8);
}
