// Lumin Vocab: artwork. Scenes and paper illustrations live in /art (see CREDITS.md).
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

// Full-screen scenes behind words. x is the horizontal focus (percent) used when a tall screen crops the picture.
// Full-screen scenes behind words. x is the horizontal focus (percent) used when a tall screen crops the picture.
// group: places (photographs) or dreamy (soft abstract washes); light scenes get a deeper shade so white words stay readable.
export const SCENES = [
  { id: "library", name: "Library", x: 56, group: "places" }, { id: "forest", name: "Forest", x: 50, group: "places" },
  { id: "fireside", name: "Fireside", x: 62, group: "places" }, { id: "harbor", name: "Harbor", x: 52, group: "places" },
  { id: "conservatory", name: "Conservatory", x: 50, group: "places" }, { id: "aurora", name: "Aurora", x: 50, group: "places" },
  { id: "attic", name: "Attic", x: 46, group: "places" }, { id: "lavender", name: "Lavender", x: 54, group: "places" },
  { id: "summit", name: "High Pass", x: 54, group: "places" }, { id: "bridge", name: "Stone Bridge", x: 52, group: "places" },
  { id: "village", name: "Snowy Village", x: 54, group: "places" }, { id: "cliffs", name: "Lighthouse Cliffs", x: 48, group: "places" },
  { id: "swirl", name: "Sage Swirl", x: 52, group: "dreamy", light: true }, { id: "midnight", name: "Midnight Tide", x: 51, group: "dreamy" },
  { id: "crystal", name: "Crystal Star", x: 50, group: "dreamy" }, { id: "dawn", name: "Peach Dawn", x: 50, group: "dreamy", light: true },
];
export const SCENE_GROUPS = [["places", "Places"], ["dreamy", "Dreamy"]];
export const wallpaperUrl = (id) => `/art/wallpapers/${id}.jpg`;
export const sceneUrl = (id) => `/art/scenes/${id}.webp`;
// Pick a scene for a word: the profile's chosen one, or a gentle rotation that stays the same for a word on every device
export function sceneFor(p, word) {
  if (p && p.scene && p.scene !== "auto") return SCENES.find((s) => s.id === p.scene) || SCENES[0];
  let h = 0; for (const ch of word || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SCENES[h % SCENES.length];
}

const TOPIC_ART = { Feelings: "feelings", Character: "character", "Talk and writing": "talk", "Mind and ideas": "mind", "Society and law": "society",
  "Nature and weather": "nature", Animals: "animals", Senses: "senses", "Arts and stories": "arts", "Science and tech": "science", "Body and health": "body",
  Food: "food", "Money and work": "money", "Time and change": "time", "Places and travel": "places", "Movement and action": "actions",
  "Look and shape": "describing", "Things and tools": "things", "Good, bad and strange": "t:strange", "More and less": "shuffle", "My words": "mywords" };
export const topicArt = (t) => { const n = TOPIC_ART[t] || "describing"; return n.startsWith("t:") ? `/art/trails/${n.slice(2)}.webp` : `/art/icons/${n}.webp`; };
// Side trails borrow a landmark or an illustration that fits their theme
// Side trails have their own paper illustrations; a few borrow a fitting one from the icon set
const OWN_ART = new Set(["decades", "mixups", "myths", "borrowed", "sounds", "kind", "office", "doctor", "courtroom", "kitchen", "airport", "money", "space", "games", "tasting"]);
const BORROWED_ART = { spelling: "spelling", conversation: "talk", tech: "science", weather: "nature" };
export const trailArt = (k) => OWN_ART.has(k) ? `/art/trails/${k}.webp` : `/art/icons/${BORROWED_ART[k] || "shuffle"}.webp`;
export const keeperArt = (k) => `/art/keepers/${k}.webp`;
export const icon = (name) => `/art/icons/${name}.webp`;
export const landmark = (name) => `/art/journey/${name}.webp`;
// Picture element with size hints so nothing jumps while it loads
export function art(src, alt = "", size = 160) {
  const img = document.createElement("img");
  img.src = src; img.alt = alt; img.width = size; img.height = size; img.loading = "lazy"; img.decoding = "async"; img.className = "art";
  return img;
}
