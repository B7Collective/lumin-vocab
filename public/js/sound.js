// Lumin Vocab: small sounds made in the browser (no audio files), and taps you can feel.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
let ctx = null, enabled = true;
export function setEnabled(on) { enabled = !!on; }
function audio() {
  if (!enabled) return null;
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch { return null; }
}
// A soft bell-like note: a sine with a quick attack and a gentle fade
function note(freq, at = 0, dur = 0.5, vol = 0.12, type = "sine") {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
export const sounds = {
  tap: () => note(880, 0, 0.12, 0.05),
  right: () => { note(660, 0, 0.35, 0.1); note(990, 0.08, 0.5, 0.09); },
  wrong: () => { note(196, 0, 0.28, 0.09, "triangle"); },
  heart: () => { note(784, 0, 0.25, 0.07); note(1175, 0.05, 0.35, 0.05); },
  done: () => [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.6, 0.08)),
  unlock: () => [392, 523, 659, 784, 988].forEach((f, i) => note(f, i * 0.07, 0.7, 0.07)),
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm");
export function buzz(pattern = 10) { try { if (navigator.vibrate && !reduced()) navigator.vibrate(pattern); } catch {} }
export function play(name) { try { sounds[name] && sounds[name](); } catch {} }
