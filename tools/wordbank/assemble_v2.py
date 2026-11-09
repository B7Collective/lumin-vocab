# Lumin Vocab word bank, version 2.
# Kid levels (Sprout, Explorer) keep their hand-written lists; Scholar and Wordsmith are hand-written in advanced/.
# Each line: word|part of speech|definition|example|topic. Pronunciation (IPA and a simple respelling) comes
# from the CMU Pronouncing Dictionary; related words and synonyms from Open English WordNet.
# Run from a folder that has oewn.pkl and data-src/ (see README.md), with this folder's files copied in.
import json, re, sys, glob, collections
exec(open("curated.py").read().split("def look(w):")[0])  # loaders, respell(), ipa()

BEAUTIFUL = set("mellifluous ethereal luminous serendipity halcyon gossamer zephyr ephemeral ineffable effulgent resplendent sonorous limpid verdant sublime evanescent diaphanous reverie incandescent refulgent pellucid wistful serene radiant exquisite tranquil vivid nostalgia epiphany cadence".split())

def extras(w, kid):
    fam, sim = [], []
    if w in E:
        lst = sorted(E[w], key=lambda x: -len(x[1]))
        fam = family(w, lst[0][1])
        s0 = lst[0][1][0]["synset"] if lst[0][1] else None
        sim = simwords(w, s0) if s0 else []
    bad_re = KID_UNSAFE if kid else None
    keep = lambda xs: [x for x in xs if not UNSAFE.search(x) and not (bad_re and bad_re.search(x))][:3]
    return keep(fam), keep(sim)

old = json.load(open("words_v1.json"))
out, seen = [], set()
for o in old:
    if o["l"] > 1: continue
    o["i"] = ipa(cmu[o["w"]]) if o["w"] in cmu else ""
    out.append(o); seen.add(o["w"])

def add(fname, level, sets=()):
    n = 0
    for line in open(fname, encoding="utf-8"):
        line = line.strip()
        if not line: continue
        w, pos, d, ex, topic = line.split("|")
        if w in seen: continue
        seen.add(w)
        fam, sim = extras(w, level < 3)
        key = w.replace("-", "")
        o = {"w": w, "p": pos, "l": level, "d": d, "e": ex, "s": respell(cmu[key]) if key in cmu else "",
             "i": ipa(cmu[key]) if key in cmu else "", "t": topic, "f": fam, "m": sim}
        x = [s for s in sets] + (["beautiful"] if w in BEAUTIFUL else [])
        if x: o["x"] = x
        out.append(o); n += 1
    return n

for f in sorted(glob.glob("advanced/scholar_*.txt")): add(f, 2)
for f in sorted(glob.glob("advanced/wordsmith_*.txt")): add(f, 3)
add("advanced/funny.txt", 1, ("funny",))
from wordfreq import zipf_frequency
for o in out:
    o["z"] = round(zipf_frequency(o["w"].replace("-", " "), "en"), 1)
for o in out:
    if o["w"] in BEAUTIFUL and "beautiful" not in o.get("x", []): o.setdefault("x", []).append("beautiful")
text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
assert "\u2014" not in text  # no em dashes in the word list
open("words.json", "w", encoding="utf-8").write(text)
print(len(out), "words", sorted(collections.Counter(o["l"] for o in out).items()), f"{len(text)//1024} KB",
      "no IPA:", sum(1 for o in out if not o["i"]), "sets:", collections.Counter(x for o in out for x in o.get("x", [])))
