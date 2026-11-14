import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const local = new URL("./screen/expression.js", import.meta.url);
const source = await fs
  .access(local)
  .then(() => local)
  .catch(() => new URL("../public/robot-display/expression.js", import.meta.url));
const { expressionFor, poseFor, parts } = await import(source.href);
const artwork = await fs.readFile(new URL("./screen/face.svg", import.meta.url), "utf8");
test("explicit severity wins, Gemini mood precedes keyword fallback, and negation is respected", () => {
  assert.equal(expressionFor("Bahaya adalah nama kategori.", undefined, "neutral"), "neutral");
  assert.equal(expressionFor("Bahaya. Jauhi area."), "danger");
  assert.equal(expressionFor("Tidak ada bahaya."), "neutral");
  assert.equal(expressionFor("Halo.", "danger", "happy"), "danger");
  assert.equal(expressionFor("Pembacaan terakhir.", undefined, "__proto__"), "neutral");
});
test("sleep, wake, whole-head color, and beak silence are deterministic", () => {
  assert.equal(poseFor("sleeping", "happy", 0, 1).beak, 0);
  assert.equal(poseFor("waking", "happy", 0).open, 0);
  assert.ok(poseFor("waking", "happy", 1.9).open > 0.99);
  assert.equal(poseFor("speaking", "danger", 1, 2).hue, 140);
  assert.equal(poseFor("speaking", "warning", 1, 0).hue, -165);
  assert.equal(parts(poseFor("speaking", "happy", 1, 0))["mouth-cavity"].opacity, "0");
  assert.notEqual(
    parts(poseFor("speaking", "happy", 1, 0.8))["lower-beak"].transform,
    parts(poseFor("speaking", "happy", 1, 0))["lower-beak"].transform,
  );
  assert.match(artwork, /^<svg[^>]+fill="none"/);
  assert.doesNotMatch(artwork, /<image|base-image/);
  assert.match(artwork, /id="forelock"/);
  assert.doesNotMatch(artwork, /base-mask|lower-mask|clip-path/);
});
test("reference expressions differ visibly and speaking opens a hinged beak without opening on silence", () => {
  assert.equal(
    expressionFor("Ada laporan bencana banjir di Jawa.", undefined, "concerned"),
    "concerned",
  );
  assert.equal(expressionFor("Gempa terdeteksi.", "danger"), "danger");
  const brows = ["neutral", "happy", "concerned", "warning", "danger", "surprised"].map(
    (mood) => parts(poseFor("speaking", mood, 1, 0.7))["brow-left"].d,
  );
  assert.equal(new Set(brows).size, 6);
  for (const mood of ["neutral", "happy", "concerned", "warning", "danger", "surprised"]) {
    const rig = parts(poseFor("speaking", mood, 1, 0.7));
    assert.equal(rig["brow-left"].transform, undefined);
    assert.ok(!rig["brow-left"].d.includes("NaN"));
  }
  const normal = parts(poseFor("listening", "neutral", 1)),
    happy = parts(poseFor("listening", "happy", 1)),
    star = parts(poseFor("listening", "surprised", 1));
  assert.notEqual(normal["eye-left"].d, happy["eye-left"].d);
  assert.equal(star["star-left"].opacity, "1");
  assert.equal(star["eye-left"].opacity, "0");
  const loud = parts(poseFor("speaking", "neutral", 1, 1));
  assert.match(loud["lower-beak"].transform, /-32/);
  assert.equal(loud["mouth-cavity"].opacity, "1");
  assert.equal(parts(poseFor("speaking", "neutral", 1, 0))["mouth-cavity"].opacity, "0");
});

test("a happy greeting moves from open eyes to a smile and an independent wink", () => {
  const open = poseFor("listening", "happy", 0);
  const smile = poseFor("listening", "happy", 1.5);
  const wink = poseFor("listening", "happy", 4.65);
  assert.equal(open.smile, 0);
  assert.equal(smile.smile, 1);
  assert.equal(wink.smile, 0);
  assert.equal(wink.wink, 1);
  const bothOpen = parts({ ...wink, wink: 0 });
  const oneClosed = parts(wink);
  assert.notEqual(oneClosed["eye-left"].d, bothOpen["eye-left"].d);
  assert.equal(oneClosed["eye-right"].d, bothOpen["eye-right"].d);
  assert.notEqual(oneClosed["brow-left"].d, bothOpen["brow-left"].d);
  assert.equal(oneClosed["brow-right"].d, bothOpen["brow-right"].d);
  assert.equal(poseFor("listening", "happy", 4.65, 0, true).wink, 0);
  assert.equal(poseFor("speaking", "danger", 1.5, 1).smile, 0);
});
