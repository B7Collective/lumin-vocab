import { test } from "node:test";
import assert from "node:assert/strict";
import { blankExample, escapeRe } from "../../public/js/model.js";

test("custom words with symbols never break the fill-in-the-blank pattern", () => {
  assert.equal(escapeRe("c++ (x)"), "c\\+\\+ \\(x\\)");
  assert.equal(blankExample({ w: "c++", e: "I write c++ at work." }), "I write _____ at work.");
  assert.equal(blankExample({ w: "(odd", e: "An (odd thing." }), "An _____ thing.");
});

test("blanks match whole words only, at any position and in any case", () => {
  assert.equal(blankExample({ w: "mix", e: "Mix the flour." }), "_____ the flour.");
  assert.equal(blankExample({ w: "ant", e: "The giant ant." }), "The giant _____.");
  assert.equal(blankExample({ w: "ant", e: "The giant elephant." }), null);
  assert.equal(blankExample({ w: "ant", e: "" }), null);
});
