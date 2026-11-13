// Lumin Vocab: motion helpers. Small, soft movements that answer what you do; all of it turns off
// with the device's reduced-motion setting or the app's calmer motion option.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
export const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm");

// Count a number up from zero
export function countUp(el, to, dur = 900) {
  if (!el) return;
  const end = Number(to) || 0;
  if (calm() || end <= 1) { el.textContent = String(end); return; }
  const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = String(Math.round(end * e)); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
  el.textContent = "0"; requestAnimationFrame(step);
}

// A screen arrives: its sections rise in one after another, and grids fill in card by card
const GRIDS = ".cards, .lib, .stats, .scenes, .choices, .people, .wlist, .menu, .chips, .score, .reviewlist, .steps, .wfeat";
export function enter(root) {
  if (!root || calm()) return;
  let i = 0;
  for (const el of root.children) {
    if (el.matches("svg, .footer, script")) continue;
    el.classList.add("rise"); el.style.setProperty("--i", Math.min(i++, 8)); settle(el);
  }
  root.querySelectorAll(GRIDS).forEach((g) => {
    const base = parseFloat(getComputedStyle(g.closest(".rise") || g).getPropertyValue("--i")) || 0;
    [...g.children].slice(0, 12).forEach((c, k) => { c.classList.add("rise"); c.style.setProperty("--i", base + 0.6 + k * 0.45); settle(c); });
  });
}

// Once an arrival finishes, step aside so hover and press effects work normally
function settle(el) { const done = (e) => { if (e.target !== el) return; el.classList.remove("rise"); el.removeEventListener("animationend", done); }; el.addEventListener("animationend", done); }

// The navigation highlight glides to the current place
export function glide(nav, active) {
  if (!nav) return;
  // the same highlight is kept between redraws, so it slides from where it was
  let ind = nav._ind;
  if (!ind) { ind = nav._ind = document.createElement("span"); ind.className = "navind"; ind.setAttribute("aria-hidden", "true"); }
  nav.prepend(ind);
  const place = () => {
    const a = nav.querySelector('[aria-current="page"]');
    if (!a) { ind.style.opacity = "0"; return; }
    ind.style.opacity = "1";
    ind.style.width = a.offsetWidth + "px";
    ind.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  requestAnimationFrame(place);
  // a bar that was hidden (the top bar on an upright phone) has no size yet: place the highlight again when it appears
  nav._place = place;
  if (!nav._watch && "ResizeObserver" in window) { nav._watch = new ResizeObserver(() => nav._place && nav._place()); nav._watch.observe(nav); }
}
