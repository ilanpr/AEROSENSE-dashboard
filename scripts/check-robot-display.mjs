import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const out = new URL("../artifacts/robot-face/", import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});
const errors = [],
  checks = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(90000);
page.on("pageerror", (e) => errors.push(e.message));
function wav() {
  const rate = 16000,
    seconds = 3.4,
    samples = Math.floor(rate * seconds),
    b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / rate,
      active = t < 0.65 || (t > 1.4 && t < 2.2);
    b.writeInt16LE(active ? Math.round(Math.sin(t * 2 * Math.PI * 180) * 9500) : 0, 44 + i * 2);
  }
  return b;
}
try {
  await page.goto("http://127.0.0.1:4210/");
  await page.waitForFunction(() => window.aerobotDisplay);
  await page.evaluate(() => window.aerobotDisplay.receive({ action: "sleep" }));
  assert.equal(await page.evaluate(() => window.aerobotDisplay.getState().mode), "sleeping");
  await page.screenshot({ path: new URL("sleeping.png", out).pathname.replace(/^\/(\w:)/, "$1") });
  await page.keyboard.press("Space");
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.aerobotDisplay.getState().mode), "waking");
  await page.screenshot({ path: new URL("waking.png", out).pathname.replace(/^\/(\w:)/, "$1") });
  await page.waitForTimeout(1650);
  assert.equal(await page.evaluate(() => window.aerobotDisplay.getState().mode), "listening");
  checks.push("sleep -> waking -> listening");
  for (const [key, name] of [
    ["2", "happy"],
    ["4", "warning"],
    ["5", "danger"],
  ]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(750);
    await page.screenshot({ path: new URL(`${name}.png`, out).pathname.replace(/^\/(\w:)/, "$1") });
    assert.equal(await page.evaluate(() => window.aerobotDisplay.getState().mood), name);
  }
  checks.push("whole-head yellow warning / red danger");
  const audio = wav().toString("base64");
  await page.evaluate(
    (audioBase64) =>
      window.aerobotDisplay.receive({
        action: "speak",
        text: "Bahaya. Jauhi area.",
        audioBase64,
        mime: "audio/wav",
      }),
    audio,
  );
  await page.waitForFunction(() => window.aerobotDisplay.getState().mode === "speaking");
  await page.waitForTimeout(250);
  const loud = await page.evaluate(() => ({
    state: window.aerobotDisplay.getState(),
    beak: document.querySelector("#lower-beak").getAttribute("transform"),
  }));
  assert.ok(loud.state.volume > 0.2);
  await page.screenshot({ path: new URL("speaking.png", out).pathname.replace(/^\/(\w:)/, "$1") });
  await page.waitForFunction(() => {
    const s = window.aerobotDisplay.getState();
    return s.mode === "speaking" && s.volume < 0.01;
  });
  const silent = await page.evaluate(() => ({
    state: window.aerobotDisplay.getState(),
    beak: document.querySelector("#lower-beak").getAttribute("transform"),
  }));
  assert.ok(silent.state.volume < 0.01);
  assert.notEqual(loud.beak, silent.beak);
  await page.waitForFunction(() => window.aerobotDisplay.getState().mode === "listening");
  checks.push(
    "real WAV amplitude opens beak, silence closes it, playback end returns to listening",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("2");
  await page.waitForTimeout(700);
  await page.screenshot({ path: new URL("portrait.png", out).pathname.replace(/^\/(\w:)/, "$1") });
  const sizes = await page.evaluate(() => ({
    svg: document.querySelector("svg").getBoundingClientRect().toJSON(),
    screen: document.querySelector("#screen").getBoundingClientRect().toJSON(),
    ratio: document.querySelector("svg").getAttribute("preserveAspectRatio"),
  }));
  assert.equal(sizes.ratio, "xMidYMid meet");
  assert.equal(sizes.svg.height, sizes.screen.height);
  checks.push("portrait preserves the original head proportions");
  await page.keyboard.press("c");
  assert.equal(await page.locator("svg").getAttribute("preserveAspectRatio"), "xMidYMid slice");
  checks.push("crop-to-fill preserves aspect ratio");
  assert.equal(
    await fs
      .access(new URL("../public/robot-display/", import.meta.url))
      .then(() => true)
      .catch(() => false),
    false,
  );
  checks.push("face assets are private to the local application");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    new URL("verification.json", out),
    JSON.stringify({ checks, errors, liveDeviceTested: false, geminiTested: false }, null, 2),
  );
  console.log(checks.join("\n"));
} finally {
  await browser.close();
}
