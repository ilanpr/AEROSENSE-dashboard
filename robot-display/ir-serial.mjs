import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { parseIrLine } from "./ir-protocol.mjs";
const script = fileURLToPath(new URL("./ir-reader.py", import.meta.url));
const platformioPython = path.join(os.homedir(), ".platformio/penv/Scripts/python.exe");
const python =
  process.env.AEROBOT_PYTHON ||
  (process.platform === "win32" && fs.existsSync(platformioPython) ? platformioPython : "python3");
export function readIr(port, onSample, onClose = () => {}) {
  const child = spawn(python, [script, port], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const sample = parseIrLine(line);
    if (sample) onSample(sample);
  });
  child.stderr.on("data", (data) => console.error("[IR]", data.toString().trim()));
  child.on("error", (error) => console.error("[IR]", error.message));
  child.on("close", onClose);
  return child;
}
export function listIrPorts() {
  const child = spawn(python, [script], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "";
  child.stdout.on("data", (data) => (output += data));
  child.stderr.on("data", (data) => console.error("[IR]", data.toString().trim()));
  child.on("error", (error) => console.error("[IR]", error.message));
  child.on("close", () => {
    try {
      const ports = JSON.parse(output);
      for (const item of ports) console.log(`${item.port} — ${item.name}`);
      if (!ports.length) console.log("[IR] Belum ada port USB.");
    } catch {
      console.error("[IR] Tidak dapat membaca daftar port.");
    }
  });
}
