// Transform an operator-exported workflow without committing its credentials.
import fs from "node:fs";
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/build-gowa-workflow.mjs EXPORT.json OUTPUT.json");
const workflow = JSON.parse(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
const removed = new Set(["WhatsApp pesan masuk", "Konfigurasi webhook WhatsApp", "Antrekan pesan WhatsApp terverifikasi", "Penerima menyetujui notifikasi", "Siapkan jenis balasan WhatsApp", "Pilih jenis balasan WhatsApp", "WhatsApp kirim pesan", "WhatsApp kirim peringatan template", "WhatsApp kirim menu interaktif", "Catat status kirim WhatsApp"]);
const oldName = "Periksa persetujuan dan kirim WhatsApp", newName = "Kirim WhatsApp melalui GOWA";
const send = workflow.nodes.find(n => n.name === oldName);
if (!send) throw new Error("Expected WhatsApp send node missing; inspect current export before transforming");
send.name = newName;
send.parameters.url = '={{ $("Konfigurasi AEROSENSE").first().json.api_base_url.replace(/\\/$/,"")+"/internal/whatsapp/gowa-send" }}';
send.parameters.jsonBody = '={{ JSON.stringify({id:$json.job.id,lease_token:$json.job.lease_token}) }}';
send.parameters.options.timeout = 25000;
workflow.nodes = workflow.nodes.filter(n => !removed.has(n.name));
let keptNote = false;
workflow.nodes = workflow.nodes.filter(n => {
  if (n.type !== "n8n-nodes-base.stickyNote") return true;
  if (keptNote) return false;
  keptNote = true;
  return true;
});
for (const node of workflow.nodes) {
  if (node.type === "n8n-nodes-base.stickyNote") node.parameters.content =
    "## AEROSENSE · GOWA\nPesan masuk: GOWA → webhook bertanda tangan di backend → antrean wa_inbox.\nBalasan dan peringatan dikirim backend; kredensial GOWA hanya di Ubuntu.\nMenu memakai perintah teks. DAFTAR dan BERHENTI tetap berlaku.\nAktifkan dispatcher setelah nomor tertaut dan check-gowa berhasil. Status sent bukan bukti delivered/read.";
  const assignments = node.parameters.assignments?.assignments;
  if (assignments) {
    node.parameters.assignments.assignments = assignments.filter(a => !a.name.startsWith("whatsapp_"));
    const web = assignments.find(a => a.name === "web_base_url");
    if (web) web.value = "https://aerosense.me";
  }
}
const connections = {};
for (const [name, groups] of Object.entries(workflow.connections)) {
  if (removed.has(name) || name === oldName) continue;
  connections[name] = Object.fromEntries(Object.entries(groups).map(([kind, outputs]) => [kind,
    outputs.map(edges => edges.filter(edge => !removed.has(edge.node)).map(edge => ({...edge, node: edge.node === oldName ? newName : edge.node})))
  ]));
}
workflow.connections = connections;
workflow.active = false;
delete workflow.pinData;
const names = new Set(workflow.nodes.map(n => n.name));
const ids = new Set(workflow.nodes.map(n => n.id));
workflow.nodeGroups = (workflow.nodeGroups || []).map(g => ({...g,
  nodeIds:g.nodeIds.filter(id => ids.has(id))})).filter(g => g.nodeIds.length);
for (const [name, groups] of Object.entries(connections)) {
  if (!names.has(name)) throw new Error("Unknown source " + name);
  for (const outputs of Object.values(groups)) for (const edges of outputs) for (const edge of edges)
    if (!names.has(edge.node)) throw new Error("Unknown destination " + edge.node);
}
fs.writeFileSync(output, JSON.stringify(workflow, null, 2) + "\n");
console.log(`Prepared inactive GOWA workflow: ${workflow.nodes.length} nodes`);
