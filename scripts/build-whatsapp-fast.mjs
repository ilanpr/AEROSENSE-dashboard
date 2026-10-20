// Apply the reviewed low-latency settings to an operator-exported workflow.
import fs from "node:fs";
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/build-whatsapp-fast.mjs EXPORT.json OUTPUT.json");
const workflow = JSON.parse(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
const model = workflow.nodes.find(n => n.name === "Gemini jawab dan periksa WhatsApp");
const scope = workflow.nodes.find(n => n.name === "Supabase lokasi percakapan");
if (!model || !scope) throw new Error("Expected WhatsApp nodes missing; inspect current export");
model.parameters.modelId = { __rl: true, mode: "id", value: '={{ "models/gemini-3.1-flash-lite" }}' };
model.retryOnFail = false;
scope.parameters.query = fs.readFileSync(new URL("../n8n/whatsapp-conversation.sql", import.meta.url), "utf8");
workflow.active = false;
delete workflow.pinData;
fs.writeFileSync(output, JSON.stringify(workflow, null, 2) + "\n");
console.log("Prepared inactive WhatsApp workflow: Flash-Lite and deduplicated processing reply");

