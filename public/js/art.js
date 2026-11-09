// Lumin Vocab: artwork. Scenes and paper illustrations live in /art (see CREDITS.md).
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.

// Full-screen scenes behind words. x is the horizontal focus (percent) used when a tall screen crops the picture.
export const SCENES = [
  { id: "library", name: "Library", x: 56 }, { id: "forest", name: "Forest", x: 50 }, { id: "fireside", name: "Fireside", x: 62 },
  { id: "harbor", name: "Harbor", x: 52 }, { id: "conservatory", name: "Conservatory", x: 50 }, { id: "aurora", name: "Aurora", x: 50 },
  { id: "attic", name: "Attic", x: 46 }, { id: "lavender", name: "Lavender", x: 54 },
];
export const sceneUrl = (id) => `/art/scenes/${id}.webp`;
// Pick a scene for a word: the profile's chosen one, or a gentle rotation that stays the same for a word on every device
export function sceneFor(p, word) {
  if (p && p.scene && p.scene !== "auto") return SCENES.find((s) => s.id === p.scene) || SCENES[0];
  let h = 0; for (const ch of word || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SCENES[h % SCENES.length];
}

const TOPIC_ART = { Feelings: "feelings", Character: "character", People: "character", "Words and talk": "talk", Mind: "mind", Society: "society",
  Nature: "nature", Animals: "animals", Senses: "senses", Arts: "arts", Science: "science", Body: "body", Food: "food", Money: "money",
  Time: "time", Places: "places", Actions: "actions", Describing: "describing", Things: "things", "My words": "mywords" };
export const topicArt = (t) => `/art/icons/${TOPIC_ART[t] || "describing"}.webp`;
export const icon = (name) => `/art/icons/${name}.webp`;
export const landmark = (name) => `/art/journey/${name}.webp`;
// Picture element with size hints so nothing jumps while it loads
export function art(src, alt = "", size = 160) {
  const img = document.createElement("img");
  img.src = src; img.alt = alt; img.width = size; img.height = size; img.loading = "lazy"; img.decoding = "async"; img.className = "art";
  return img;
}
