# Assemble words.json for Lumin Vocab.
import pickle, json, re, sys
sys.argv = ["x"]
exec(open("build_words.py").read().split("verbs = {w")[0])  # reuse loaders and helpers (no candidate rebuild)
cands = pickle.load(open("cands.pkl", "rb"))
by_word = {c["w"]: c for c in cands}

def entry_extras(w, kid):
    fam, sim = [], []
    if w in E:
        lst = sorted(E[w], key=lambda x: -len(x[1]))
        fam = family(w, lst[0][1])
    fam = [f for f in fam if not UNSAFE.search(f) and not (kid and KID_UNSAFE.search(f))]
    return fam[:3]

out, seen = [], set()
for level, fname in ((0, "kids_sprout.txt"), (1, "kids_explorer.txt")):
    for line in open(fname):
        line = line.strip()
        if not line: continue
        w, pos, d, ex, topic = line.split("|")
        assert "\u2014" not in line
        if w in seen: continue
        seen.add(w)
        out.append({"w": w, "p": pos, "l": level, "d": d, "e": ex, "s": respell(cmu[w]) if w in cmu else "",
                    "t": topic, "f": entry_extras(w, True), "m": []})

GOOD_LEX = {"noun.attribute","noun.cognition","noun.communication","noun.feeling","noun.state","noun.act","noun.event","noun.phenomenon","noun.person","noun.motive","noun.relation","noun.time","noun.shape","noun.group","noun.process","noun.possession"}
def pick(lo, hi, n, level):
    pool = [c for c in cands if lo <= c["z"] < hi and c["w"] not in seen
            and (c["pos"] in ("adjective", "verb", "adverb") or c["lexfile"] in GOOD_LEX)
            and len(c["def"].split()) <= 16 and c["say"] and c["lexfile"] != "adj.pert"
            and not re.match(r"(provide with|of or |relating to|of a |in a .* manner)", c["def"])
            and len(c["ex"].split()) >= 5 and c["w"] not in c["ex"].split()[0:0]
            and not any(UNSAFE.search(x) for x in c["family"] + c["similar"])]
    # favor adjectives and verbs, then mid-band frequency so words are useful but not common
    mid = (lo + hi) / 2
    pool.sort(key=lambda c: (c["pos"] not in ("adjective", "verb"), abs(c["z"] - mid)))
    chosen = pool[:n]
    for c in chosen:
        seen.add(c["w"])
        out.append({"w": c["w"], "p": c["pos"], "l": level, "d": c["def"], "e": c["ex"], "e2": c["ex2"] or None,
                    "s": c["say"], "t": c["topic"], "f": c["family"][:3], "m": c["similar"]})
    return len(chosen)

print("scholar", pick(3.2, 4.2, 800, 2))
print("wordsmith", pick(2.2, 3.2, 900, 3))
def nodash(t):
    return re.sub(r"\s*\u2014\s*", ", ", t).replace("\u2013", "-") if isinstance(t, str) else t
for o in out:
    for k in ("d","e","e2"):
        if o.get(k): o[k] = nodash(o[k])
    if o.get("e2") is None: o.pop("e2", None)
    # capitalize example sentences and end them with punctuation
    for k in ("e", "e2"):
        if k in o and o[k]:
            o[k] = re.sub(r"\s*\([^)]*\)", "", o[k]).strip()
            s = o[k][0].upper() + o[k][1:]
            if s[-1] not in ".!?\"": s += "."
            o[k] = s
text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
assert "\u2014" not in text
open("words.json", "w").write(text)
import collections
print(len(out), "words", collections.Counter(o["l"] for o in out), f"{len(text)//1024} KB")
