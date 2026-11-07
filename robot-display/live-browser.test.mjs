import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { launchLiveBrowser } from "./live-browser.mjs";
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<title>Bridge replay</title>");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = "http://127.0.0.1:" + server.address().port;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "aerobot-bridge-"));
const received = [];
const b = launchLiveBrowser(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  profile,
  url,
  (e) => received.push(e),
  { chatUrl: url + "/aerobot" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.ready;
  const targets = await b.command("Target.getTargets");
  const tab = targets.targetInfos.find((t) => t.url === url + "/aerobot");
  const { sessionId } = await b.command("Target.attachToTarget", {
    targetId: tab.targetId,
    flatten: true,
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const r = await b.command(
      "Runtime.evaluate",
      { expression: "window.__aerobotFaceBridge===true", returnByValue: true },
      sessionId,
    );
    if (r.result?.value) {
      ready = true;
      break;
    }
    await sleep(300);
  }
  assert.ok(ready, "bridge ready");
  await b.command(
    "Runtime.evaluate",
    {
      expression: `(()=>{const c=new BroadcastChannel('aerosense-robot-face-v1');c.postMessage({kind:'aerosense-face',userId:'replay',at:Date.now(),action:'speak',text:'Ada bencana banjir.',audio:new Blob([new Uint8Array([1,2,3])],{type:'audio/wav'})});setTimeout(()=>c.close(),1000);})()`,
    },
    sessionId,
  );
  for (let i = 0; i < 100 && !received.some((e) => e.audioBase64); i++) await sleep(200);
  const e = received.find((e) => e.audioBase64);
  assert.equal(e?.audioBase64, "AQID");
  assert.equal(e.monitorOnly, true);
  assert.equal(e.text, "Ada bencana banjir.");
  console.log("PASS: native browser pipe, correct origin, live playback Blob, local display relay");
} finally {
  b.close();
  await sleep(1000);
  await new Promise((r) => server.close(r));
}
