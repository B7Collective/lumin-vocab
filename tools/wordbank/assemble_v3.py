# Lumin Vocab word bank, version 3: six levels and 18 topics.
# Levels: 0 Sprout, 1 Explorer (hand-written kid lists), 2 Scholar, 3 Wordsmith (teens), 4 Academic, 5 Philosopher.
# Hand-written sources: kids_*.txt, advanced/*.txt (word|part of speech|definition|example|topic).
# topics.txt sorts words into topics by hand ("Topic: word, word, ..."); it wins over the topic in a word's line.
# Run from a folder that has oewn.pkl and data-src/ (see README.md), with this folder's files copied in.
import json, re, glob, collections, sys
exec(open("curated.py").read().split("def look(w):")[0])  # loaders, respell(), ipa()
from wordfreq import zipf_frequency

TOPICS = ["Feelings", "Character", "Talk and writing", "Mind and ideas", "Society and law", "Nature and weather", "Animals", "Senses",
          "Arts and stories", "Science and tech", "Body and health", "Food", "Money and work", "Time and change", "Places and travel",
          "Movement and action", "Look and shape", "Things and tools", "Good, bad and strange", "More and less"]
OLD = {"Words and talk": "Talk and writing", "Mind": "Mind and ideas", "Society": "Society and law", "Nature": "Nature and weather",
       "Arts": "Arts and stories", "Science": "Science and tech", "Money": "Money and work", "Time": "Time and change",
       "Places": "Places and travel", "Things": "Things and tools", "Body": "Body and health", "Actions": "Movement and action",
       "People": "Character", "Describing": "Look and shape"}
BEAUTIFUL = set(open("beautiful.txt").read().split()) if __import__("os").path.exists("beautiful.txt") else set()

override = {}
if __import__("os").path.exists("topics.txt"):
    for line in open("topics.txt", encoding="utf-8"):
        if ":" not in line or line.startswith("#"): continue
        t, ws = line.rsplit(":", 1) if line.count(":") == 1 else line.split(":", 1); t = t.strip()
        assert t in TOPICS, t
        for w in re.split(r"[,\s]+", ws.strip()):
            if w: override[w] = t

# levels.txt moves words between levels by hand ("3: word, word, ...")
relevel = {}
if __import__("os").path.exists("levels.txt"):
    for line in open("levels.txt", encoding="utf-8"):
        if ":" not in line or line.startswith("#"): continue
        l, ws = line.split(":", 1)
        for w in re.split(r"[,\s]+", ws.strip()):
            if w: relevel[w] = int(l)

def extras(w, kid):
    fam, sim = [], []
    if w in E:
        lst = sorted(E[w], key=lambda x: -len(x[1]))
        fam = family(w, lst[0][1])
        s0 = lst[0][1][0]["synset"] if lst[0][1] else None
        sim = simwords(w, s0) if s0 else []
    keep = lambda xs: [x for x in xs if not UNSAFE.search(x) and not (kid and KID_UNSAFE.search(x))][:3]
    return keep(fam), keep(sim)

out, seen = [], {}
def add(w, pos, d, ex, topic, level, sets=()):
    if w in seen: return False
    key = w.replace("-", "")
    fam, sim = extras(w, level < 3)
    o = {"w": w, "p": pos, "l": level, "d": d, "e": ex, "s": respell(cmu[key]) if key in cmu else "",
         "i": ipa(cmu[key]) if key in cmu else "", "t": OLD.get(topic, topic), "f": fam, "m": sim}
    if sets: o["x"] = list(sets)
    seen[w] = o; out.append(o); return True
def read(fname):
    for line in open(fname, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"): yield line.split("|")

# Kid levels first, in their hand-made order
for level, pat in ((0, "kids_sprout*.txt"), (1, "kids_explorer*.txt")):
    for f in sorted(glob.glob(pat)):
        for w, pos, d, ex, t in read(f): add(w, pos, d, ex, t, level)
# Hardest first, so a word written at two levels lands at the harder one
for level, pat in ((5, "advanced/philosopher_*.txt"), (4, "advanced/academic_*.txt"), (3, "advanced/wordsmith_*.txt"), (2, "advanced/scholar_*.txt")):
    for f in sorted(glob.glob(pat)):
        for w, pos, d, ex, t in read(f): add(w, pos, d, ex, t, level)
for w, pos, d, ex, t in read("advanced/funny.txt"): add(w, pos, d, ex, t, 1, ("funny",))

# Side trails: themed collections. A bare word tags a word already in the bank; a full line adds a trail-only word.
# Line: word|pos|definition|example|topic|level|~partner (topic and level default to the trail's). "word ~ partner" for bare lines.
TRAILS = []
files = [[l.rstrip("\n") for l in open(f, encoding="utf-8") if l.strip() and not l.startswith("#  ")] for f in sorted(glob.glob("trails/*.txt"))]
for lines in files:  # first pass: add trail-only words, so bare mentions in other trails find them
    key, name, blurb, aud, lvl, topic = lines[0].lstrip("# ").split("|")
    for line in lines[1:]:
        parts = line.split("|")
        if len(parts) > 1:
            parts += [""] * (7 - len(parts)); w, pos, d, ex, t, l = parts[:6]
            if w not in seen: add(w, pos, d, ex, t or topic, int(l) if l else int(lvl)); seen[w]["c"] = 1
for lines in files:
    key, name, blurb, aud, lvl, topic = lines[0].lstrip("# ").split("|")
    words = []
    for line in lines[1:]:
        parts = line.split("|")
        if len(parts) == 1:
            w, _, cf = parts[0].partition("~"); w = w.strip(); cf = cf.strip()
        else:
            parts += [""] * (7 - len(parts)); w, cf = parts[0], parts[6].lstrip("~").strip()
        if w not in seen: print("MISSING", key, w); continue
        o = seen[w]; o.setdefault("x", [])
        if key not in o["x"]: o["x"].append(key)
        if cf: o["cf"] = cf
        words.append(w)
    TRAILS.append({"key": key, "name": name, "blurb": blurb, "aud": aud, "words": words})
open("trails.json", "w", encoding="utf-8").write(json.dumps(TRAILS, ensure_ascii=False, separators=(",", ":")))
print("trails:", " ".join(f"{t['key']}:{len(t['words'])}" for t in TRAILS))

# Second sentences (sentences/*.txt, "word|sentence"): games use these so you meet a word somewhere new
E2, bad = {}, []
for f in sorted(glob.glob("sentences/*.txt")):  # later files win, so fixes go in files that sort last
    for line in open(f, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"): w, sent = line.split("|", 1); E2[w] = sent.strip()
for w, sent in E2.items():
    if w not in seen: bad.append("unknown " + w); continue
    if not re.search(r"(^|[^\w])" + re.escape(w) + r"(?![\w])", sent, re.I): bad.append("noword " + w); continue
    if sent.lower() == seen[w]["e"].strip().lower(): bad.append("same " + w); continue
    seen[w]["e2"] = sent
open("e2_problems.txt", "w").write("\n".join(bad))
print("second sentences:", sum(1 for o in out if o.get("e2")), "of", len(out), "| problems:", len(bad))

for o in out: o["z"] = round(zipf_frequency(o["w"].replace("-", " "), "en"), 1)
# Rebalance: the rarest teen words move up to Philosopher; Scholar's most everyday words step aside
RARE_UP = float(sys.argv[1]) if len(sys.argv) > 1 else 1.9
for o in out:
    if o["l"] == 3 and o["z"] < RARE_UP: o["l"] = 5
    if o["w"] in relevel: o["l"] = relevel[o["w"]]
    if o["w"] in override: o["t"] = override[o["w"]]
    if o["t"] not in TOPICS: o["t"] = "Good, bad and strange"
    if o["w"] in BEAUTIFUL: o.setdefault("x", []).append("beautiful")
out = [o for o in out if not (o["l"] == 2 and o["z"] >= 4.6 and not o.get("x"))]
# Re-tier the teen and adult-academic levels by how common each word is, so every step up is harder:
# Scholar gets the most familiar third, Wordsmith the middle, Academic the least common. Each level keeps
# its size. Words on side trails and hand-moved words stay put, so trails and kids' trails don't shift.
# (Without this, Academic's everyday "academic" words, like salary and urban, made it easier than Wordsmith.)
movable = [o for o in out if o["l"] in (2, 3, 4) and not o.get("c") and not o.get("x") and o["w"] not in relevel]
size = {l: sum(1 for o in movable if o["l"] == l) for l in (2, 3, 4)}
movable.sort(key=lambda o: -(o["z"] - 0.05 * len(o["w"])))
i = 0
for l in (2, 3, 4):
    for o in movable[i:i + size[l]]: o["l"] = l
    i += size[l]
text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
assert "—" not in text  # no em dashes in the word list
open("words.json", "w", encoding="utf-8").write(text)
c = collections.Counter(o["l"] for o in out if not o.get("c"))
print(len(out), "words", sorted(c.items()), f"{len(text)//1024} KB")
for l in range(6):
    tc = collections.Counter(o["t"] for o in out if o["l"] == l and not o.get("c"))
    print(l, " ".join(f"{t.split()[0].rstrip(',')}:{tc[t]}" for t in TOPICS))
