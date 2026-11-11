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
  // Paper art: layered paper landscapes. Each is composed so the middle still reads on a tall phone screen.
  { id: "moonriver", name: "Moon River", x: 52, group: "paper" }, { id: "emberpeak", name: "Ember Peak", x: 58, group: "paper" },
  { id: "redfalls", name: "Red Falls", x: 50, group: "paper", light: true }, { id: "junglemoon", name: "Jungle Moon", x: 50, group: "paper" },
  { id: "greatwave", name: "Great Wave", x: 50, group: "paper" }, { id: "moonpagoda", name: "Moon Pagoda", x: 49, group: "paper" },
  { id: "canyonarch", name: "Canyon Arch", x: 53, group: "paper" }, { id: "crystalcave", name: "Crystal Cave", x: 50, group: "paper" },
];
export const SCENE_GROUPS = [["places", "Places"], ["paper", "Paper art"], ["dreamy", "Dreamy"]];
export const wallpaperUrl = (id) => `/art/wallpapers/${id}.jpg`;
export const sceneUrl = (id) => `/art/scenes/${id}.webp`;
// Full-screen spots (the Words screen, the welcome page, wallpapers) use a large copy where one exists: a phone
// stretches a scene to fill a tall screen, so the light copy would look soft. Thumbnails keep the light one.
const XL = new Set(["moonriver", "emberpeak", "redfalls", "junglemoon", "greatwave", "moonpagoda", "canyonarch", "crystalcave"]);
export const sceneBig = (id) => XL.has(id) ? `/art/scenes/xl/${id}.webp` : sceneUrl(id);
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
// Regions without a keeper portrait show the thing their keeper is known by instead
const KEEPER_STANDIN = { summit: "bellrope", bridge: "cattails", village: "streetlamp", cliffs: "seathrift" };
export const keeperSrc = (region) => region[4] ? keeperArt(region[4]) : `/art/decor/${KEEPER_STANDIN[region[0]] || "lavender"}.webp`;
export const icon = (name) => `/art/icons/${name}.webp`;
export const landmark = (name) => `/art/journey/${name}.webp`;
// ---- The land along the road -------------------------------------------------------------
// Each region has its own ground and a few things growing or resting beside the path.
// Decor sizes: big pieces stand taller, small ones sit low; plants sway, lights glow, boats bob.
export const LANDS = {
  lavender: { ground: "heather", decor: ["lavender", "beehive", "roses", "mossrock", "lavender", "wateringcan"] },
  forest: { ground: "ferns", decor: ["fern", "mushrooms", "stumplantern", "pinecones", "mossrock", "fern"] },
  harbor: { ground: "sand", decor: ["rowboat", "ropepost", "buoy", "shells", "netcrate", "bottle"] },
  library: { ground: "cobbles", decor: ["books", "streetlamp", "openbook", "quill", "bench", "scroll"] },
  summit: { ground: "alpine", decor: ["cairn", "edelweiss", "signpost", "tent", "bellrope", "edelweiss"] },
  conservatory: { ground: "clover", decor: ["pottedfern", "wateringcan", "cloche", "roses", "birdbath", "beehive"] },
  aurora: { ground: "shallows", decor: ["cattails", "waterlily", "docklantern", "canoe", "steppingstone", "cattails"] },
  bridge: { ground: "autumn", decor: ["mapleleaves", "acorns", "bench", "apples", "mushrooms", "pinecones"] },
  fireside: { ground: "snowpine", decor: ["firewood", "snowpine", "sled", "mittens", "cocoa", "stumplantern"] },
  attic: { ground: "dusk", decor: ["telescope", "moonchest", "books", "scroll", "openbook", "quill"] },
  village: { ground: "footprints", decor: ["snowman", "streetlamp", "snowpine", "sled", "mittens", "firewood"] },
  cliffs: { ground: "goldgrass", decor: ["seathrift", "moorpost", "shells", "tidepool", "bottle", "ropepost"] },
  garden: { ground: "meadow", decor: ["apples", "beehive", "wateringcan", "roses", "pottedfern", "birdbath"] },
  study: { ground: "gravel", decor: ["books", "quill", "openbook", "bench", "scroll", "streetlamp"] },
  heights: { ground: "scree", decor: ["cairn", "telescope", "signpost", "tent", "mossrock", "edelweiss"] },
  wildwood: { ground: "moss", decor: ["mushrooms", "fern", "stumplantern", "mossrock", "pinecones", "fern"] },
};
const TRAIL_LAND = { kitchen: "garden", tasting: "garden", kind: "lavender", games: "bridge", doctor: "conservatory", space: "attic", weather: "aurora",
  sounds: "forest", decades: "harbor", airport: "cliffs", borrowed: "harbor", spelling: "library", mixups: "study", conversation: "lavender",
  courtroom: "library", office: "study", money: "study", myths: "wildwood", tech: "heights" };
export const landFor = (regionOrTrail, isTrail) => LANDS[isTrail ? TRAIL_LAND[regionOrTrail] || "garden" : regionOrTrail] || LANDS.lavender;
export const groundUrl = (name) => `/art/ground/${name}.webp`;
export const decorUrl = (name) => `/art/decor/${name}.webp`;
const DECOR_BIG = new Set(["rowboat", "canoe", "tent", "bench", "streetlamp", "snowman", "telescope", "snowpine", "signpost", "docklantern", "moorpost", "beehive", "birdbath", "cairn", "moonchest"]);
const DECOR_SMALL = new Set(["shells", "acorns", "mittens", "cocoa", "bottle", "pinecones", "quill", "mushrooms", "steppingstone", "apples", "waterlily", "scroll"]);
const DECOR_MOVE = { sway: ["lavender", "fern", "cattails", "edelweiss", "roses", "seathrift", "pottedfern", "mapleleaves"], glow: ["stumplantern", "docklantern", "streetlamp"], bob: ["rowboat", "buoy", "canoe", "waterlily"] };
export const decorSize = (name) => (DECOR_BIG.has(name) ? 96 : DECOR_SMALL.has(name) ? 58 : 76);
export const decorMove = (name) => Object.keys(DECOR_MOVE).find((k) => DECOR_MOVE[k].includes(name)) || "";
// Picture element with size hints so nothing jumps while it loads
export function art(src, alt = "", size = 160) {
  const img = document.createElement("img");
  img.src = src; img.alt = alt; img.width = size; img.height = size; img.loading = "lazy"; img.decoding = "async"; img.className = "art";
  return img;
}
