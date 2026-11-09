// Lumin Vocab: read a family code with the camera.
// Copyright (C) 2026 B7 Collective LLC. Licensed under AGPL-3.0-only.
// Frames are read on this device only. Nothing is saved or sent, and the camera turns off as soon as the panel closes.
import { h, sheet, closeSheet } from "./ui.js";

export const canScan = () => !!(typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// parse(text) returns the value to hand back, or null when the code isn't one we can use (scanning carries on)
export function scanCode(parse) {
  return new Promise((resolve) => {
    let stream = null, done = false, timer = 0, detector = null, jsQR = null, warned = 0;
    const video = h("video", { class: "scan-video", playsinline: true, muted: true, autoplay: true, "aria-hidden": "true" });
    video.muted = true;
    const msg = h("p", { class: "muted", role: "status" }, "Starting the camera…");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const stop = () => { clearTimeout(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    sheet("Scan the family code", (b) => {
      b.append(h("div", { class: "scan-box" }, video, h("span", { class: "scan-frame", "aria-hidden": "true" })), msg,
        h("p", { class: "muted small" }, "On the other device, open Family and tap Add a device. The camera is only on while this is open, and nothing is saved or sent."));
    }, { onClose: () => { if (!done) { done = true; stop(); resolve(null); } } });

    const read = async () => {
      if (!video.videoWidth || video.readyState < 2) return null;
      if (detector) { try { const r = await detector.detect(video); return r.length ? r[0].rawValue : null; } catch { return null; } }
      const w = Math.min(640, video.videoWidth), hh = Math.round(video.videoHeight * (w / video.videoWidth));
      canvas.width = w; canvas.height = hh;
      ctx.drawImage(video, 0, 0, w, hh);
      const r = jsQR(ctx.getImageData(0, 0, w, hh).data, w, hh, { inversionAttempts: "dontInvert" });
      return r ? r.data : null;
    };
    const tick = async () => {
      if (done) return;
      const text = await read();
      if (done) return;
      if (text) {
        const value = parse(text);
        if (value) { done = true; stop(); closeSheet(); resolve(value); return; }
        if (Date.now() - warned > 2500) { warned = Date.now(); msg.textContent = "That code isn't a Lumin Vocab family code. Scan the one under Family, Add a device."; }
      }
      timer = setTimeout(tick, 150);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (done) { stop(); return; }
        video.srcObject = stream;
        await video.play().catch(() => {});
        // Chrome on Android has a built-in reader; other browsers (Safari on iPhone) use the bundled one
        if ("BarcodeDetector" in self) {
          try { if ((await BarcodeDetector.getSupportedFormats()).includes("qr_code")) detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch {}
        }
        if (!detector) jsQR = (await import("./vendor/jsqr.mjs")).default;
        if (done) { stop(); return; }
        msg.textContent = "Point the camera at the code.";
        tick();
      } catch (e) {
        stop();
        msg.textContent = e && e.name === "NotAllowedError"
          ? "Camera access is off for this site. Allow it in your browser settings, or type the six words instead."
          : "The camera couldn't start. Type the six words instead.";
      }
    })();
  });
}
