# Lumin Vocab

**A bigger vocabulary, one beautiful word at a time, for the whole family.** Immersive words, a Journey of short games, and real spaced review that makes words stick, with levels from early readers to adults. Free, private, and open source.

Live at **[lumin.b7collective.com](https://lumin.b7collective.com)**. Made by [B7 Collective](https://b7collective.com).

![Lumin Vocab on a computer](public/icons/screenshot-wide.jpg)

## What it does

- **Words.** One word at a time over a full-screen scene: the word, its pronunciation (tap to hear it), a clear definition and a natural example. Swipe up, scroll or use the arrow keys for the next one. Heart a word to keep it, bookmark it to practice it.
- **The Lantern Road.** A long Journey, one stop a day, through twelve regions, each with a keeper who greets you. Each region lays its own ground under the path, from heather to harbor sand to fresh snow, with things growing and resting beside the road. Every stop is a short path of games ending in the keeper's riddle and a landmark where you find a keepsake. Every word you learn lights your lantern. Campfire stops look back over the road, and a passport keeps every stop so you can review or replay it.
- **Side trails.** Nineteen short themed journeys with no waiting: words people misspell, mix-ups like affect and effect, slang through the decades, words from myths, borrowed words, words that sound like what they mean, and words for the doctor's office, the courtroom, the kitchen, the airport and more. Grown-up trails stay off kids' profiles.
- **Practice.** Today's review first, scheduled by an FSRS-based spaced repetition scheduler so words come back just before you'd forget them. Then games (flash cards, what it means, fill the gap, spelling, unscramble, true or false, find its twin, spot the right use, listen closely, game shuffle), three challenges (Perfection, Rush, Sprint) and a level check.
- **Six levels, all hand-written.** A difficulty slider in three bands: Kids (Sprout, Explorer), Teens (Scholar, Wordsmith) and Adults (Academic, Philosopher). About 4,200 words, 600 to 800 per level, each with a definition and two example sentences written for Lumin Vocab: the Words screen shows one, and games use the other so you meet each word somewhere new. Plus Beautiful words and Funny words collections and 20 topics.
- **Scenes to keep.** Sixteen scenes behind your words, from a snowy village to soft abstract washes. Any of them can be saved as a wallpaper.
- **Library and You.** Favorites, lists, history and your own words; a streak, the week at a glance and progress stats.
- **Family profiles.** Everyone gets their own level, words and settings. Kids get simple respellings instead of IPA, gentler words and read aloud. An optional family PIN keeps grown-up settings and parent profiles locked.
- **Private family sync.** Add phones, tablets and computers by scanning a QR code inside the app or typing a six-word family code. Everything is encrypted on the device before upload, so the server only ever stores ciphertext.
- **Installs like an app** on iPhone, iPad, Android, Windows, Mac, Linux and ChromeOS, straight from the landing page. Works offline.
- No ads, no trackers, no accounts, no third-party scripts.

## How it's built

Plain HTML, CSS and JavaScript modules with no build step, served by a Cloudflare Worker with static assets. Sync uses a small API on the same Worker with a D1 database.

```
public/            the app (index.html, app.css, js/, data/words.json, art/, fonts, icons, service worker)
src/worker.js      sync API: validation, rate limiting, stores encrypted blobs only
migrations/        D1 schema
tests/unit/        device detection, scheduler, encryption, server validation, word bank checks
tests/e2e/         Playwright tests on iPhone, Android, iPad and desktop, including two-device sync and the layout standard
tools/wordbank/    the hand-written word lists (kids lists and advanced/) and the scripts that build words.json
tools/icons/       the app icon sources; `sh tools/icons/make.sh` rebuilds every size
```

### Layout standard

Every screen is built from one set of tokens and layout classes at the top of `public/app.css`: a spacing scale (4, 8, 12, 16, 24, 32, 48, 64), a type scale, three content widths and one side gutter. Buttons and chips never wrap their labels, headings balance their lines, paragraphs avoid one-word last lines, and a word on the card shrinks to fit rather than breaking. `tests/e2e/layout.spec.js` checks every screen on every device for sideways scrolling, off-screen content, wrapped labels and overlaps.

### Security

The page runs under a strict Content Security Policy (no inline scripts or styles, same-origin only). The camera is allowed for this site only, for the code scanner. Home screen icons and the manifest are the one exception to the same-origin resource rule, because phones fetch them outside the page. The sync API accepts JSON only, reads at most 1 MB per request, rate limits by network and by family, and caps each family's record count and stored size. Backups are validated on restore, and restoring one needs the family PIN. Repeated wrong PINs make the app wait before the next try.

### Staying in step across devices

Each change is sent about a second after it's made, and right away when the app goes to the background (so locking a phone never strands a change). A device pulls new progress the moment it's opened or switched to, then checks every 30 seconds while in use and every 2 minutes after 5 quiet minutes. Open screens redraw in place when progress arrives; the word you're reading and a review in progress are never interrupted. An empty check is one small database read with no writes, which keeps the cost per family low.

### Installing and adding devices

The landing page has an Install button. Where the browser has its own install dialog (Chrome, Edge, Brave, Android) one tap opens it; elsewhere (iPhone, iPad, Safari on Mac) it shows the exact steps for that device. To add a device to a family, its Join screen can scan the code shown under Family, Add a device. Scanning happens inside the app on purpose: on iPhone, an app added to the Home Screen keeps its data apart from Safari, so a code scanned with the Camera app would join Safari instead of the installed app. The camera is on only while the scanner is open, and frames are read on the device and never stored or sent.

### Sync and privacy design

From the six-word family code, each device derives (PBKDF2-SHA256, 210,000 iterations) an AES-GCM key, an HMAC key and a family id. Records are encrypted with AES-GCM, record ids are replaced by HMAC values, and the server stores only a SHA-256 hash of the family id. Conflicts resolve by last writer wins per record, with device id as the tie breaker. Every record carries a UUID-based id, a change timestamp, its originating device and a soft-delete flag.

## Run it locally

```sh
npm install
npm run db:local      # create the local database and apply migrations
npm run dev           # http://127.0.0.1:8787
npm test              # unit tests
npx playwright install chromium && npm run test:e2e
```

## Deploy

Pushes to `main` deploy automatically through Cloudflare Workers Builds. To deploy by hand: `npm run deploy`.

## Licenses

- **Code:** GNU Affero General Public License v3.0 only. See [LICENSE](LICENSE).
- **Word data** (`public/data/words.json`, `tools/wordbank/*.txt`): Creative Commons Attribution-ShareAlike 4.0. See [CREDITS.md](CREDITS.md) for sources and attribution.
- Fonts, the QR code library and other third-party parts keep their own licenses, listed in [CREDITS.md](CREDITS.md) and [LICENSES/](LICENSES).

Copyright (C) 2026 B7 Collective LLC.
