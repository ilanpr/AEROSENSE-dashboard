import test from "node:test";
import assert from "node:assert/strict";
import {
  expressionFor as responseMood,
  poseFor as facePose,
  parts as faceParts,
} from "../../robot-display/screen/expression.js";
import fs from "node:fs/promises";
const faceSvg = await fs.readFile(
  new URL("../../robot-display/screen/face.svg", import.meta.url),
  "utf8",
);

test("face intent gives explicit danger precedence, handles negation, and never accepts arbitrary expressions", () => {
  assert.equal(responseMood("Terima kasih.", "danger", "happy"), "danger");
  assert.equal(responseMood("Halo.", "warning"), "warning");
  assert.equal(responseMood("Tidak ada bahaya. Terima kasih."), "happy");
  assert.equal(responseMood("Tidak aman berada di area ini."), "danger");
  assert.equal(responseMood("No danger reported."), "neutral");
  assert.equal(responseMood("Data belum tersedia."), "concerned");
  assert.equal(responseMood("Waspada, debu meningkat."), "warning");
  assert.equal(responseMood("Pembacaan terakhir.", undefined, "execute-command"), "neutral");
  assert.equal(responseMood("Pembacaan terakhir.", undefined, "__proto__"), "neutral");
});

test("waking opens eyes before blinking and finishes awake; sleeping mouth is closed", () => {
  assert.equal(facePose("waking", "happy", 0).open, 0);
  assert.ok(facePose("waking", "happy", 1.05).open > 0.95);
  assert.ok(facePose("waking", "happy", 1.35).open < 0.06);
  assert.ok(facePose("waking", "happy", 1.9).open > 0.99);
  assert.equal(facePose("sleeping", "neutral", 1, 1).beak, 0);
  assert.equal(facePose("speaking", "danger", 1, 4).beak, 1);
  assert.equal(facePose("speaking", "neutral", 1, -2).beak, 0);
  assert.equal(facePose("speaking", "danger", 1).hue, 140);
  assert.equal(facePose("speaking", "warning", 1).hue, -165);
  for (const mode of ["sleeping", "waking", "listening", "thinking", "speaking"]) {
    const parts = faceParts(facePose(mode, "danger", 2, 0.6));
    assert.ok(!JSON.stringify(parts).includes("NaN"));
    assert.ok(faceSvg.includes('preserveAspectRatio="xMidYMid meet"'));
  }
});
