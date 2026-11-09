# Build the Lumin Vocab word bank from open data.
# Sources: Open English WordNet 2024 (CC BY 4.0), CMU Pronouncing Dictionary (BSD-2),
# wordfreq (data CC BY-SA 4.0, used only to rank and level words), LDNOOBW list (CC BY 4.0).
import pickle, re, json, sys
from wordfreq import zipf_frequency

D = pickle.load(open("oewn.pkl", "rb"))
E, S, SENSES = D["entries"], D["synsets"], D["senses"]

bad = {w.strip().lower() for w in open("data-src/badwords.txt") if w.strip()}
cmu = {}
for line in open("data-src/cmudict.dict"):
    parts = line.split()
    w = parts[0]
    if "(" in w: continue
    cmu[w] = [p for p in parts[1:] if not p.startswith("#")]

POS = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
UNSAFE = re.compile(r"\b(sex\w*|genital\w*|penis|vagina|breast\w*|nude|naked|erotic\w*|porn\w*|prostitut\w*|rape\w*|orgasm\w*|copulat\w*|intercourse|masturbat\w*|vulgar|obscene|offensive|derogatory|slang|slur|disparaging|ethnic|racial|homosexual\w*|lesbian\w*|drunk\w*|alcohol\w*|liquor|beer|wine|whiskey|drug\w*|narcotic\w*|cocaine|heroin|marijuana|cannabis|opium|intoxicat\w*|suicid\w*|torture\w*|murder\w*|kill\w*|corpse|excrement|feces|urine|urinat\w*|defecat\w*|buttocks|anus|rectum|testicle\w*|semen|menstru\w*|pregnan\w*|adulter\w*|seduc\w*|lust\w*|whore|bitch|bastard|damn\w*|hell|devil\w*|satan\w*|god|gods|religio\w*|church|christian\w*|muslim\w*|islam\w*|jew\w*|bible|biblical|deity|weapon\w*|gun\w*|firearm\w*|bomb\w*|explosive\w*|nazi\w*|slave\w*|execut\w*|gallows|hang\w*|stab\w*|wound\w*|blood\w*|gore|violen\w*|abuse\w*|assault\w*|insult\w*|stupid|idiot\w*|moron\w*|fat|obes\w*|gamble\w*|gambling|tobacco|cigar\w*|smok\w*|archaic|obsolete|dated|informal|british|chiefly)\b", re.I)
# Kid levels additionally avoid illness, death and fear words
KID_UNSAFE = re.compile(r"\b(die|dies|died|dying|death|dead|disease\w*|illness|cancer|tumor\w*|injur\w*|attack\w*|war|wars|battle\w*|army|military|soldier\w*|enemy|crime\w*|criminal\w*|prison\w*|jail\w*|police|steal\w*|theft|rob\w*|fear\w*|terror\w*|horror\w*|monster\w*|ghost\w*|grief|grieve\w*|funeral\w*|grave|money|debt\w*|tax\w*|legal|law|lawyer\w*|court|politic\w*|government\w*|medic\w*|surgery|surgical|vomit\w*|poison\w*|bitter\w*|hate\w*|anger|angry|rage)\b", re.I)

def clean_example(ex):
    ex = re.split(r"\s+--\s*|\s+-\s+[A-Z]", ex)[0].strip()
    ex = ex.strip('"“” ').strip()
    return ex

def inflections(w):
    out = {w, w+"s", w+"es", w+"ed", w+"d", w+"ing", w+"ly", w+"er", w+"est"}
    if w.endswith("e"): out |= {w[:-1]+"ing", w[:-1]+"ed"}
    if w.endswith("y"): out |= {w[:-1]+"ies", w[:-1]+"ied", w[:-1]+"ily"}
    if re.search(r"[^aeiou][aeiou][bdgklmnprt]$", w): out |= {w+w[-1]+"ed", w+w[-1]+"ing"}
    return out

def has_word(ex, w):
    toks = set(re.findall(r"[a-z]+", ex.lower()))
    return bool(toks & inflections(w))

ARP_V = {"AA":"ah","AE":"a","AH":"uh","AO":"aw","AW":"ow","AY":"eye","EH":"eh","ER":"ur","EY":"ay","IH":"ih","IY":"ee","OW":"oh","OY":"oy","UH":"uu","UW":"oo"}
ARP_C = {"B":"b","CH":"ch","D":"d","DH":"th","F":"f","G":"g","HH":"h","JH":"j","K":"k","L":"l","M":"m","N":"n","NG":"ng","P":"p","R":"r","S":"s","SH":"sh","T":"t","TH":"th","V":"v","W":"w","Y":"y","Z":"z","ZH":"zh"}
ONSETS = {("S","T"),("S","P"),("S","K"),("P","R"),("B","R"),("T","R"),("D","R"),("K","R"),("G","R"),("F","R"),("TH","R"),("P","L"),("B","L"),("K","L"),("G","L"),("F","L"),("S","L"),("S","M"),("S","N"),("S","W"),("K","W"),("T","W"),("D","W"),("SH","R"),("S","T","R"),("S","P","R"),("S","K","R"),("S","P","L")}

def respell(phones):
    sylls, cur, stress = [], [], []
    nuclei = [i for i,p in enumerate(phones) if p[:-1] in ARP_V or p in ARP_V]
    if not nuclei: return None
    bounds = []
    for a, b in zip(nuclei, nuclei[1:]):
        cons = phones[a+1:b]
        if len(cons) <= 1: cut = a+1
        else:
            cut = b - 1
            for k in range(len(cons), 1, -1):
                if tuple(cons[-k:]) in ONSETS: cut = b - k; break
        bounds.append(cut)
    starts = [0] + bounds
    ends = bounds + [len(phones)]
    out = []
    for s, e in zip(starts, ends):
        part, st = "", False
        for p in phones[s:e]:
            base = re.sub(r"\d", "", p)
            if base in ARP_V:
                st = p.endswith("1")
                part += ARP_V[base] if not (base=="AH" and p.endswith("0")) else "uh"
            else: part += ARP_C.get(base, base.lower())
        out.append(part.upper() if st and len(nuclei) > 1 else part)
    return "-".join(out)

def family(word, senses):
    fam = set()
    for s in senses:
        for rt, tgt in s["rels"]:
            if rt in ("derivation", "pertainym") and tgt in SENSES:
                w2 = SENSES[tgt][0]
                if w2.isalpha() and w2.islower() and w2 != word and zipf_frequency(w2,"en") > 1.5: fam.add(w2)
    return sorted(fam, key=lambda x: -zipf_frequency(x, "en"))[:4]

def similar(word, syn):
    sims = set()
    for m in syn["members"]:
        for lem in E:
            pass
    return []

member_word = {}
for w, lst in E.items():
    for pos, senses in lst:
        for s in senses: member_word.setdefault(s["synset"], set()).add(w)

def simwords(word, sid):
    syn = S[sid]
    cands = set(member_word.get(sid, set()))
    for rt, tgt in syn["rels"]:
        if rt in ("similar", "also") and tgt in member_word: cands |= member_word[tgt]
    cands = [c for c in cands if c != word and c.isalpha() and c.islower() and c not in bad and zipf_frequency(c,"en") > 2.0]
    return sorted(cands, key=lambda x: -zipf_frequency(x, "en"))[:3]

TOPIC = {"noun.animal":"Animals","noun.plant":"Nature","noun.object":"Nature","noun.phenomenon":"Nature","noun.food":"Food","verb.consumption":"Food","noun.feeling":"Feelings","verb.emotion":"Feelings","noun.cognition":"Mind","verb.cognition":"Mind","noun.communication":"Words and talk","verb.communication":"Words and talk","noun.person":"People","verb.social":"People","noun.group":"People","noun.artifact":"Things","noun.act":"Actions","verb.motion":"Actions","verb.contact":"Actions","verb.change":"Actions","verb.creation":"Arts","noun.attribute":"Describing","adj.all":"Describing","adj.pert":"Describing","adv.all":"Describing","noun.time":"Time","noun.location":"Places","noun.substance":"Science","noun.process":"Science","noun.quantity":"Science","noun.shape":"Science","verb.perception":"Senses","noun.state":"Describing","noun.event":"Actions","noun.possession":"Money","verb.possession":"Money","noun.body":"Body","verb.body":"Body","noun.motive":"Mind","noun.relation":"Mind","verb.competition":"Actions","verb.stative":"Describing","verb.weather":"Nature"}


verbs = {w for w, lst in E.items() for pos, _ in lst if pos == "v"}
adjs = {w for w, lst in E.items() for pos, _ in lst if pos in ("a", "s")}
cands = []
for w, lst in E.items():
    if not re.fullmatch(r"[a-z]{3,15}", w) or w in bad: continue
    if w not in cmu: continue
    z = zipf_frequency(w, "en")
    if z < 2.2 or z > 4.9: continue
    # skip participle adjectives and -ly adverbs that just restate another word
    if re.search(r"(ed|ing)$", w) and (w[:-2] in verbs or w[:-3] in verbs or w[:-1] in verbs or w[:-3]+"e" in verbs): continue
    if w.endswith("ly") and (w[:-2] in adjs or w[:-3]+"y" in adjs): continue
    best = None
    for pos, senses in sorted(lst, key=lambda x: -len(x[1])):
        if pos not in POS: continue
        for rank, s0 in enumerate(senses[:2]):
            syn = S.get(s0["synset"])
            if not syn or not syn["def"]: continue
            gloss = re.sub(r"^\([^)]*\)\s*", "", syn["def"].strip())
            if not (2 <= len(gloss.split()) <= 20) or w in gloss.lower().split(): continue
            if syn["lexfile"] in ("noun.location", "noun.Tops"): continue
            exs = [clean_example(x) for x in syn["ex"]]
            exs = [x for x in exs if has_word(x, w) and 4 <= len(x.split()) <= 22 and not re.search(r"[;:]|\bthee\b|\bthou\b", x)]
            if not exs: continue
            alltext = gloss + " " + " ".join(exs)
            if UNSAFE.search(alltext): continue
            best = (pos, senses, s0, syn, gloss, exs, alltext); break
        if best: break
    if not best: continue
    pos, senses, s0, syn, gloss, exs, alltext = best
    exs.sort(key=lambda x: -len(x.split()))
    cands.append({
        "w": w, "pos": POS[pos], "z": round(z, 2), "def": gloss, "ex": exs[0], "ex2": exs[1] if len(exs) > 1 else "",
        "lexfile": syn["lexfile"], "kidsafe": not KID_UNSAFE.search(alltext),
        "say": respell(cmu[w]), "family": family(w, senses), "similar": simwords(w, s0["synset"]),
        "topic": TOPIC.get(syn["lexfile"], "Describing"),
    })
pickle.dump(cands, open("cands.pkl", "wb"))
import collections
print(len(cands), "candidates")
bands = collections.Counter()
for c in cands:
    z = c["z"]
    bands["E" if z >= 3.9 and c["kidsafe"] else "S" if z >= 3.2 else "W" if z < 3.2 else "x"] += 1
print(bands)
