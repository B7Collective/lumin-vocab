# Word bank pipeline

Rebuilds `public/data/words.json`.

1. Download sources into `data-src/`: Open English WordNet 2024 XML (`english-wordnet-2024.xml.gz` from the globalwordnet/english-wordnet GitHub releases), `cmudict.dict` from cmusphinx/cmudict, and the LDNOOBW `en` list. Install `wordfreq` with pip.
2. `python3 parse_oewn.py data-src/oewn.xml.gz oewn.pkl`
3. `python3 build_words.py` (filters and ranks WordNet candidates)
4. `python3 assemble.py` (merges the hand-written kid lists `kids_sprout.txt` and `kids_explorer.txt` with WordNet-based Scholar and Wordsmith words)

The kid lists use `word|part of speech|definition|example|topic`, one per line. Edit them freely; keep examples family-safe and free of real people's names.
