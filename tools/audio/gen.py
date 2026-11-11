# Records every word in both voices with Kokoro-82M (Apache-2.0) and saves MP3s. Resumable: skips files that exist.
# Usage: python3 gen.py public/audio public/data/words.json [us|gb]   (see README.md in this folder)
import sys, os, json, re, time, unicodedata, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from g2p import phonemes
from kokoro_onnx import Kokoro
K = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
words = [o["w"] for o in json.load(open(sys.argv[2]))]
only = sys.argv[3] if len(sys.argv) > 3 else None
slug = lambda w: re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode().lower()).strip("-")
k = Kokoro(os.environ.get("KOKORO_MODEL", f"{K}/model.onnx"), os.environ.get("KOKORO_VOICES", f"{K}/voices.npz"))
VOICES = {"us": ("af_heart", "en-us"), "gb": ("bf_emma", "en-gb")}
t0, n = time.time(), 0
for acc, (voice, lang) in VOICES.items():
    if only and acc != only: continue
    os.makedirs(f"{OUT}/{acc}", exist_ok=True)
    for w in words:
        path = f"{OUT}/{acc}/{slug(w)}.mp3"
        if os.path.exists(path): continue
        try:
            ph = phonemes(w, acc)
            a, sr = k.create(ph, voice=voice, speed=0.92, is_phonemes=True) if ph else k.create(w, voice=voice, speed=0.92, lang=lang)
        except Exception as e:
            print("FAIL", acc, w, e, flush=True); continue
        a = np.asarray(a, dtype=np.float32)
        peak = float(np.max(np.abs(a))) or 1.0
        a = np.concatenate([np.zeros(int(sr * 0.04), np.float32), a * (0.89 / peak), np.zeros(int(sr * 0.08), np.float32)])
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-", "-codec:a", "libmp3lame", "-q:a", "5", path + f".{os.getpid()}.tmp.mp3"], input=a.tobytes(), check=True)
        os.replace(path + f".{os.getpid()}.tmp.mp3", path)
        n += 1
        if n % 200 == 0: print(acc, n, f"{(time.time()-t0)/n:.2f}s each", flush=True)
print("DONE", n, flush=True)
