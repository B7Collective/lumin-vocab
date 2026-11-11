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

POSMAP = {"noun": ("n",), "verb": ("v",), "adjective": ("a", "s"), "adverb": ("r",)}
def antonyms(w, pos):
    """Opposites from Open English WordNet, only plain single words that don't share the word's stem (no undependable for dependable)"""
    out = []
    for p, senses in E.get(w, []):
        if p not in POSMAP.get(pos, ()): continue
        for s in senses:
            for rel, target in s["rels"]:
                if rel != "antonym" or target not in SENSES: continue
                a = SENSES[target][0]
                if re.fullmatch(r"[a-z]{3,}", a) and a not in out and a[:4] != w[:4] and w not in a and a not in w and not UNSAFE.search(a): out.append(a)
    return out[:2]
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
    ant = antonyms(w, pos)
    if ant: o["a"] = ant
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
# Funny words: a side collection only (marked "fo", kept off the main road). An optional sixth field sets the level.
for parts in read("advanced/funny.txt"):
    w, pos, d, ex, t = parts[:5]
    if add(w, pos, d, ex, t, int(parts[5]) if len(parts) > 5 else 1, ("funny",)): seen[w]["fo"] = 1
# funny_tags.txt adds bank words to the Funny collection at every level, so the collection follows the level you pick
FUNNY_TAGS = set(open("funny_tags.txt").read().split()) if __import__("os").path.exists("funny_tags.txt") else set()
# Version 4 expansion (v4/<level>_<nn>.txt, "word|pos|definition|example|second example|topic"). Each file's
# level is fixed: these words were written for that level and are never re-tiered. Sources: see CREDITS.md.
V4 = {}
for f in sorted(glob.glob("v4/[0-5]_*.txt")):
    level = int(f.split("/")[-1][0])
    for w, pos, d, ex, e2, t in read(f):
        if add(w, pos, d, ex, t, level): V4[w] = e2

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
for w, sent in V4.items():
    if "e2" not in seen[w]: seen[w]["e2"] = sent
open("e2_problems.txt", "w").write("\n".join(bad))
print("second sentences:", sum(1 for o in out if o.get("e2")), "of", len(out), "| problems:", len(bad))

# Third and fourth sentences plus hand-picked synonyms and opposites (sentences/more/out_*.txt,
# "word|sentence|sentence|syn, syn|ant, ant"). New sentences go in e3 so each word shows up in fresh settings.
# Hand-picked synonyms replace the automatic ones (which mixed in loose relatives like "animal" or "machine").
HYPERNYMS = {"animal", "bug", "bird", "machine", "thing", "person", "object", "device", "plant", "fish", "food", "place", "act", "being", "organism"}
more_n = 0
for f in sorted(glob.glob("sentences/more/out_*.txt")):
    for line in open(f, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"): continue
        w, s1, s2, syn, ant = [x.strip() for x in line.split("|")]
        if w not in seen: continue
        o = seen[w]; more_n += 1
        wre = re.compile(r"(^|[^\w])" + re.escape(w) + r"(?![\w])", re.I)
        o["e3"] = [x for x in (s1, s2) if wre.search(x) and x.lower() not in (o["e"].lower(), str(o.get("e2", "")).lower())]
        syns = [x.strip() for x in syn.split(",") if x.strip() and x.strip().lower() != w]
        ants = [x.strip() for x in ant.split(",") if x.strip() and x.strip().lower() != w]
        o["m"] = syns[:4] if syns else [x for x in o.get("m", []) if x not in HYPERNYMS]
        if ants: o["a"] = ants[:3]
print("hand-picked sentences and synonyms:", more_n)

for o in out: o["z"] = round(zipf_frequency(o["w"].replace("-", " "), "en"), 1)
# Rebalance: the rarest teen words move up to Philosopher; Scholar's most everyday words step aside
RARE_UP = float(sys.argv[1]) if len(sys.argv) > 1 else 1.9
for o in out:
    if o["l"] == 3 and o["z"] < RARE_UP and o["w"] not in V4: o["l"] = 5
    if o["w"] in relevel: o["l"] = relevel[o["w"]]
    if o["w"] in override: o["t"] = override[o["w"]]
    if o["t"] not in TOPICS: o["t"] = "Good, bad and strange"
    if o["w"] in BEAUTIFUL: o.setdefault("x", []).append("beautiful")
    if o["w"] in FUNNY_TAGS and "funny" not in o.get("x", []): o.setdefault("x", []).append("funny")
out = [o for o in out if not (o["l"] == 2 and o["z"] >= 4.6 and not o.get("x") and o["w"] not in V4)]
# Re-tier the older teen and adult words (Scholar to Philosopher) by how common each word is, so every step up
# is harder: Scholar gets the most familiar, Philosopher the rarest. Hand-moved words (levels.txt) and the
# version 4 words keep the level they were written for; the older words fill in around them so all four levels
# end up about the same size. Side trails pick their words by level, so this is safe for them too.
# (Without this, Academic's everyday "academic" words, like salary and urban, made it easier than Wordsmith.)
TIERS = (2, 3, 4, 5)
pinned = lambda o: o["w"] in relevel or o["w"] in V4 or o.get("fo")
movable = [o for o in out if o["l"] in TIERS and not o.get("c") and not pinned(o)]
fixed = collections.Counter(o["l"] for o in out if o["l"] in TIERS and not o.get("c") and pinned(o))
target = (len(movable) + sum(fixed[l] for l in TIERS)) // len(TIERS)
size = {l: max(0, target - fixed[l]) for l in TIERS[:-1]}; size[5] = len(movable) - sum(size.values())
movable.sort(key=lambda o: -(o["z"] - 0.05 * len(o["w"])))
i = 0
for l in TIERS:
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
