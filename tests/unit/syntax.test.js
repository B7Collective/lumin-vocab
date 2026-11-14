// Every script the app loads must parse. A single stray bracket stops the whole app from starting, and the other
// unit tests don't load the screen files, so this checks them all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const dir = new URL("../../public/js/", import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
  test(`public/js/${f} parses`, () => {
    const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: readFileSync(new URL(f, dir)) });
    assert.equal(r.status, 0, String(r.stderr));
  });
}
