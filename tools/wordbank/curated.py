# Look up the hand-picked Scholar and Wordsmith words in Open English WordNet.
# Writes curated.json: one entry per word with the best sense, its examples (if any), synonyms and IPA.
import json, re, sys
sys.argv = ["x"]
exec(open("build_words.py").read().split("verbs = {w")[0])  # loaders and helpers

# ARPAbet to IPA, General American
IPA_V = {"AA":"ɑ","AE":"æ","AH":"ʌ","AO":"ɔ","AW":"aʊ","AY":"aɪ","EH":"ɛ","ER":"ɝ","EY":"eɪ","IH":"ɪ","IY":"i","OW":"oʊ","OY":"ɔɪ","UH":"ʊ","UW":"u"}
IPA_C = {"B":"b","CH":"tʃ","D":"d","DH":"ð","F":"f","G":"ɡ","HH":"h","JH":"dʒ","K":"k","L":"l","M":"m","N":"n","NG":"ŋ","P":"p","R":"r","S":"s","SH":"ʃ","T":"t","TH":"θ","V":"v","W":"w","Y":"j","Z":"z","ZH":"ʒ"}
IPA_ONSETS = ONSETS | {(c, "Y") for c in ("K","P","B","F","M","V","HH","G","T","D","N","S")}
def ipa(phones):
    nuclei = [i for i, p in enumerate(phones) if re.sub(r"\d", "", p) in IPA_V]
    if not nuclei: return ""
    starts = [0]
    for a, b in zip(nuclei, nuclei[1:]):
        cons = phones[a+1:b]
        cut = a + 1 if len(cons) <= 1 else b - 1
        if len(cons) > 1:
            for k in range(len(cons), 1, -1):
                if tuple(re.sub(r"\d", "", c) for c in cons[-k:]) in IPA_ONSETS: cut = b - k; break
        starts.append(cut)
    out = []
    for i, s in enumerate(starts):
        e = starts[i+1] if i + 1 < len(starts) else len(phones)
        syl, mark = "", ""
        for p in phones[s:e]:
            base = re.sub(r"\d", "", p)
            if base in IPA_V:
                if p.endswith("1"): mark = "ˈ"
                v = IPA_V[base]
                if base == "AH" and p.endswith("0"): v = "ə"
                if base == "ER" and p.endswith("0"): v = "ɚ"
                syl += v
            else: syl += IPA_C.get(base, base.lower())
        out.append((mark if len(nuclei) > 1 else "") + syl)
    return "".join(out)

def look(w):
    if w not in E: return None
    best = None
    for pos, senses in sorted(E[w], key=lambda x: -len(x[1])):
        if pos not in POS: continue
        for s0 in senses[:3]:
            syn = S.get(s0["synset"])
            if not syn or not syn["def"]: continue
            gloss = re.sub(r"^\([^)]*\)\s*", "", syn["def"].strip())
            if UNSAFE.search(gloss) and not best: continue
            exs = [clean_example(x) for x in syn["ex"]]
            exs = [x for x in exs if has_word(x, w) and 4 <= len(x.split()) <= 24 and not re.search(r"\bthee\b|\bthou\b", x) and not UNSAFE.search(x)]
            cand = {"w": w, "p": POS[pos], "d": gloss, "ex": exs, "lexfile": syn["lexfile"], "t": TOPIC.get(syn["lexfile"], "Describing"),
                    "f": family(w, senses)[:3], "m": simwords(w, s0["synset"])}
            if best is None: best = cand
            if exs: return cand
        if best: break
    return best

out = {}
for level, fname in ((3, "wordsmith.txt"), (2, "scholar.txt")):
    for w in open(fname).read().split():
        if w in out: continue
        r = look(w)
        if not r: print("missing", w); continue
        r["l"] = level
        r["ipa"] = ipa(cmu[w]) if w in cmu else ""
        r["s"] = respell(cmu[w]) if w in cmu else ""
        out[w] = r
json.dump(out, open("curated.json", "w"), ensure_ascii=False, indent=0)
import collections
print(len(out), "found;", sum(1 for r in out.values() if r["ex"]), "with examples;", sum(1 for r in out.values() if not r["ipa"]), "without IPA")
print(collections.Counter(r["l"] for r in out.values()))
