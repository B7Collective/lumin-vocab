# Packs the two Kokoro voices Lumin uses (af_heart, bf_emma) into voices.npz for gen.py.
# The .bin voice files come from the kokoro-js npm package (npm pack kokoro-js; see package/voices/).
# Usage: python3 make_voices.py path/to/package/voices voices.npz
import sys, numpy as np
src, out = sys.argv[1], sys.argv[2]
np.savez(out, **{v: np.fromfile(f"{src}/{v}.bin", dtype=np.float32).reshape(-1, 1, 256) for v in ("af_heart", "bf_emma")})
