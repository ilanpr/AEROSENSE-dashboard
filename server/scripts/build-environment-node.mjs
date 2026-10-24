import { readFile, writeFile, mkdir } from "node:fs/promises";
import { summarizeEnvironment } from "../api/environment-insights.mjs";
import { normalizeHazardEvents } from "../api/environment-events.mjs";
const [source, target] = process.argv.slice(2);
if (!source || !target)
  throw new Error(
    "Usage: node build-environment-node.mjs original-node.js output-node.js",
  );
const original = await readFile(source, "utf8");
const marker = "facts:ok?facts:[],status:";
if (!original.includes("function normalizeResponse("))
  throw new Error(
    "Normalizer layout changed. Inspect the live Code node before applying.",
  );
const output =
  "// Ringkasan singkat dari fakta yang masih berlaku. Tidak memakai Gemini.\n/* oxlint-disable no-control-regex */\n" +
  normalizeHazardEvents.toString() + "\n" +
  summarizeEnvironment.toString() +
  "\n" +
  original.slice(original.indexOf("function normalizeResponse("))
    .replace(
      "const labels={temperature_2m:",
      "const labels={weather_code:['Kode kondisi cuaca (WMO)',''],temperature_2m:",
    )
    .replace(
      marker,
      "facts:ok?facts:[],insights:summarizeEnvironment(ok?facts:[],now).filter(i=>i.available),summary_method:'rules-v1',status:",
    );
new Function("$json", "$", output);
await mkdir(new URL("../../n8n/", import.meta.url), { recursive: true });
await writeFile(target, output);
console.log("Code node ready: " + output.length + " characters");
