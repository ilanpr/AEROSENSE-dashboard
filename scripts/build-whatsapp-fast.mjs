// Apply the reviewed low-latency settings to an operator-exported workflow.
import fs from "node:fs";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("Usage: node scripts/build-whatsapp-fast.mjs EXPORT.json OUTPUT.json");
const workflow = JSON.parse(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
const model = workflow.nodes.find((n) => n.name === "Gemini jawab dan periksa WhatsApp");
const scope = workflow.nodes.find((n) => n.name === "Supabase lokasi percakapan");
if (!model || !scope) throw new Error("Expected WhatsApp nodes missing; inspect current export");
model.parameters.modelId = {
  __rl: true,
  mode: "list",
  value: "models/gemini-3.5-flash-lite",
  cachedResultName: "models/gemini-3.5-flash-lite",
};
model.retryOnFail = false;
model.parameters.options = { ...model.parameters.options, maxOutputTokens: 1024 };
model.parameters.options.systemMessage = fs.readFileSync(
  new URL("../n8n/chat-system-prompt.txt", import.meta.url),
  "utf8",
);
model.parameters.messages.values[0].content =
  "=" + fs.readFileSync(new URL("../n8n/chat-model-input.txt", import.meta.url), "utf8").trim();
const validator = workflow.nodes.find((n) => n.name === "Validasi jawaban WhatsApp");
if (!validator) throw new Error("WhatsApp answer validator missing");
validator.parameters.jsCode = fs
  .readFileSync(new URL("../n8n/chat-answer-validation.js", import.meta.url), "utf8")
  .replaceAll("konteks hub Web", "konteks hub WhatsApp")
  .replaceAll("Periksa input Web", "Periksa input WhatsApp");
const save = workflow.nodes.find((n) => n.name === "Simpan jawaban WhatsApp");
if (save?.parameters.jsonBody && !save.parameters.jsonBody.includes("emotion:"))
  save.parameters.jsonBody = save.parameters.jsonBody.replace(
    "decision:$json.decision,",
    "decision:$json.decision,emotion:$json.emotion,",
  );
scope.parameters.query = fs.readFileSync(
  new URL("../n8n/whatsapp-conversation.sql", import.meta.url),
  "utf8",
);
workflow.active = false;
delete workflow.pinData;
fs.writeFileSync(output, JSON.stringify(workflow, null, 2) + "\n");
console.log("Prepared inactive WhatsApp workflow: Flash-Lite and deduplicated processing reply");
