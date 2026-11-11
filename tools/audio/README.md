# Word audio

Every word in `public/data/words.json` has two recordings: `public/audio/us/<word>.mp3` (American, the Kokoro
voice `af_heart`) and `public/audio/gb/<word>.mp3` (British, `bf_emma`). The app plays these for bank words, so every
device hears the same natural voice. Words a family adds themselves fall back to the device's own voice.

How they were made:

- Voice model: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) by hexgrad, Apache-2.0, using the ONNX export
  from [onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) (`onnx/model.onnx`).
- Voices: `af_heart` and `bf_emma` from the Kokoro voice set (Apache-2.0), as shipped in the `kokoro-js` npm package.
- Pronunciation: the American and British dictionaries from [misaki](https://github.com/hexgrad/misaki) (Apache-2.0).
  Words not in those dictionaries are spelled out by eSpeak NG through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT).
- Each clip is volume-matched and saved as MP3.

To add audio for new words: install `kokoro-onnx misaki soundfile` with pip, put `model.onnx` and `voices.npz`
(from `make_voices.py`) next to `gen.py`, then run `python3 tools/audio/gen.py public/audio public/data/words.json`.
It only records words that don't have a clip yet. `npm test` checks that every word has both clips.
