import json, os, re, misaki
D = os.path.join(os.path.dirname(misaki.__file__), "data")
LEX = {a: [json.load(open(f"{D}/{a}_gold.json")), json.load(open(f"{D}/{a}_silver.json"))] for a in ("us", "gb")}
def lookup(word, accent):
    for d in LEX[accent]:
        for k in (word, word.lower(), word.capitalize()):
            v = d.get(k)
            if v:
                if isinstance(v, dict): v = v.get("DEFAULT") or next(iter(v.values()))
                if v: return v
    return None
def phonemes(text, accent):
    """misaki dictionary phonemes for each part, or None if any part is unknown"""
    parts = [p for p in re.split(r"[\s\-]+", text.strip()) if p]
    out = [lookup(p, accent) for p in parts]
    return None if any(o is None for o in out) else " ".join(out)
