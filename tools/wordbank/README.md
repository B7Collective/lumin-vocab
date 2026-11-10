# Word bank pipeline

Rebuilds `public/data/words.json`.

1. Download sources into `data-src/`: Open English WordNet 2024 XML (`english-wordnet-2024.xml.gz` from the globalwordnet/english-wordnet GitHub releases), `cmudict.dict` from cmusphinx/cmudict, and the LDNOOBW `en` list. Install `wordfreq` with pip.
2. `python3 parse_oewn.py data-src/oewn.xml.gz oewn.pkl`
3. `python3 build_words.py` (filters and ranks WordNet candidates)
4. `python3 assemble_v3.py` (version 3, six levels). Hand-written sources: `kids_*.txt` (Sprout, Explorer), `advanced/scholar_*`, `wordsmith_*`, `academic_*`, `philosopher_*` (one entry per line: `word|part of speech|definition|example|topic`), `funny.txt`, side trails in `trails/` (first line `# key|Name|blurb|all, teen or adult|default level|default topic`, then bare words already in the bank, `word ~ partner` for mix-ups, or full entries `word|pos|definition|example|topic|level|~partner`), second example sentences in `sentences/` (`word|sentence`; files that sort later win), `topics.txt` and `levels.txt` for hand sorting, and `beautiful.txt`. Writes `words.json` and `trails.json`. An optional argument moves Wordsmith words rarer than that frequency up to Philosopher (default 1.9). Earlier versions: `assemble_v2.py`, `assemble.py`.

All hand-written lists, including `advanced/*.txt`, use `word|part of speech|definition|example|topic`, one per line. Edit them freely; keep examples family-safe and free of real people's names.
