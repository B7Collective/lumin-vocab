# Word bank pipeline

Rebuilds `public/data/words.json`.

1. Download sources into `data-src/`: Open English WordNet 2024 XML (`english-wordnet-2024.xml.gz` from the globalwordnet/english-wordnet GitHub releases), `cmudict.dict` from cmusphinx/cmudict, and the LDNOOBW `en` list. Install `wordfreq` with pip.
2. `python3 parse_oewn.py data-src/oewn.xml.gz oewn.pkl`
3. `python3 build_words.py` (filters and ranks WordNet candidates)
4. `python3 assemble_v2.py` (version 2: keeps the hand-written kid lists, adds the hand-written Scholar and Wordsmith entries in `advanced/`, the Funny words set, IPA from CMUdict via `curated.py`, similar words from WordNet, and word frequency for Journey order). `assemble.py` built version 1.

All hand-written lists, including `advanced/*.txt`, use `word|part of speech|definition|example|topic`, one per line. Edit them freely; keep examples family-safe and free of real people's names.
