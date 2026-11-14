// Runs inside aerosense-api, uses its existing environment; never prints secrets.
const e = process.env;
const headers = { Authorization: "Basic " + Buffer.from(e.GOWA_BASIC_AUTH || "").toString("base64") };
async function get(path) {
  const r = await fetch(new URL(path, e.GOWA_BASE_URL), { headers, redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("GOWA HTTP " + r.status);
  return r.json();
}
try {
  const devices = (await get("/devices")).results;
  const device = devices?.find(d => d.id === e.GOWA_DEVICE_ID);
  if (!device) throw new Error("Create the aerosense device slot in GOWA first");
  const status = (await get("/devices/" + encodeURIComponent(e.GOWA_DEVICE_ID) + "/status")).results;
  const jid = device.jid;
  const linked = status?.is_connected === true && status?.is_logged_in === true && /^\d{8,15}@s\.whatsapp\.net$/.test(jid || "");
  if (process.argv.includes("--jid")) {
    if (!linked) throw new Error("Scan the QR for the aerosense device and wait until connected");
    // This output is consumed by setup-gowa.sh, not included in status reports.
    process.stdout.write(jid);
  } else {
    const r = await fetch(e.SUPABASE_URL + "/rest/v1/ae_wa_receipts?select=message_id&limit=0", {
      headers: { apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + e.SUPABASE_SERVICE_ROLE_KEY }, signal: AbortSignal.timeout(10000),
    });
    console.log(JSON.stringify({ provider: e.WHATSAPP_PROVIDER || "meta", linked,
      bound: linked && jid === e.GOWA_DEVICE_JID, receipt_schema_ready: r.ok }));
    if (!linked || !r.ok) process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
