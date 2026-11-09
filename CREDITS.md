# Credits and licenses

## Word data (CC BY-SA 4.0)

`public/data/words.json` is released under the Creative Commons Attribution-ShareAlike 4.0 International license ([LICENSES/CC-BY-SA-4.0.txt](LICENSES/CC-BY-SA-4.0.txt)). It is built from:

- **Entries at every level:** words chosen, and definitions and examples written, for Lumin Vocab by B7 Collective LLC (hand-written sources in `tools/wordbank/`).
- **Similar words and word families:** from [Open English WordNet](https://en-word.net) (2024 edition) by the Open English WordNet Community, licensed CC BY 4.0. It is derived from Princeton WordNet: WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved. See [LICENSES/OEWN-LICENSE.md](LICENSES/OEWN-LICENSE.md) and [LICENSES/WordNet-License.txt](LICENSES/WordNet-License.txt).
- **Pronunciations (IPA and respellings):** generated from the [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict), Copyright (C) 1993-2015 Carnegie Mellon University, BSD 2-Clause ([LICENSES/CMUdict-BSD-2-Clause.txt](LICENSES/CMUdict-BSD-2-Clause.txt)).
- **Journey order:** words are ordered from common to rare using frequencies from [wordfreq](https://github.com/rspeer/wordfreq) by Robyn Speer (data CC BY-SA 4.0), which includes data from Google Books Ngram, OpenSubtitles, SUBTLEX by Marc Brysbaert et al. (freely available data), Wikipedia and other sources.
- **Family-safe filtering:** helped by the [List of Dirty, Naughty, Obscene, and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), CC BY 4.0.

## Pictures and sound (CC0 1.0)

The scenes in `public/art/scenes/` and the paper illustrations in `public/art/icons/` and `public/art/journey/` were made for Lumin Vocab by B7 Collective LLC with Google Gemini image generation. They are AI-generated images, not photographs. To the extent B7 Collective holds any rights in them, they are dedicated to the public domain under CC0 1.0. Sounds are synthesized in the browser by `public/js/sound.js`; there are no audio files.

## Software and fonts

- **Review scheduling:** based on the FSRS algorithm and default parameters from the [open-spaced-repetition](https://github.com/open-spaced-repetition) project (MIT).
- **Literata** font: SIL Open Font License 1.1 ([LICENSES/OFL-Literata.txt](LICENSES/OFL-Literata.txt)).
- **Atkinson Hyperlegible** font by the Braille Institute: SIL Open Font License 1.1 ([LICENSES/OFL-Atkinson-Hyperlegible.txt](LICENSES/OFL-Atkinson-Hyperlegible.txt)).
- **jsQR** by Cosmo Wolfe: Apache License 2.0 ([LICENSES/Apache-2.0-jsQR.txt](LICENSES/Apache-2.0-jsQR.txt)). Reads family codes with the camera; nothing leaves the device.
- **qrcode-generator** by Kazuhiko Arase: MIT ([LICENSES/MIT-qrcode-generator.txt](LICENSES/MIT-qrcode-generator.txt)). QR Code is a registered trademark of DENSO WAVE INCORPORATED.

The app's code is Copyright (C) 2026 B7 Collective LLC, licensed under the GNU AGPL v3.0 only.
