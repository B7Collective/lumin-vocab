# Parse Open English WordNet (LMF XML) into a compact pickle for the build step.
import gzip, pickle, sys
import xml.etree.ElementTree as ET

src, out = sys.argv[1], sys.argv[2]
entries = {}   # lemma -> list of (pos, [sense dicts])
synsets = {}   # id -> dict
sense_index = {}  # sense id -> (lemma, synset)
for ev, el in ET.iterparse(gzip.open(src), events=("end",)):
    if el.tag == "LexicalEntry":
        lem = el.find("Lemma")
        word, pos = lem.get("writtenForm"), lem.get("partOfSpeech")
        senses = []
        for s in el.findall("Sense"):
            rels = [(r.get("relType"), r.get("target")) for r in s.findall("SenseRelation")]
            senses.append({"id": s.get("id"), "synset": s.get("synset"), "rels": rels})
            sense_index[s.get("id")] = (word, s.get("synset"))
        entries.setdefault(word, []).append((pos, senses))
        el.clear()
    elif el.tag == "Synset":
        d = el.find("Definition")
        synsets[el.get("id")] = {
            "pos": el.get("partOfSpeech"), "lexfile": el.get("lexfile"),
            "members": el.get("members", "").split(),
            "def": d.text if d is not None else "",
            "ex": [e.text for e in el.findall("Example") if e.text],
            "rels": [(r.get("relType"), r.get("target")) for r in el.findall("SynsetRelation")],
        }
        el.clear()
pickle.dump({"entries": entries, "synsets": synsets, "senses": sense_index}, open(out, "wb"))
print(len(entries), "entries", len(synsets), "synsets")
