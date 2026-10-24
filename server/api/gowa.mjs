// GOWA v9.6: keep its transport separate from the Meta Cloud API payload.
export function phoneFromJid(jid) {
  return typeof jid === "string" && /^\d{8,15}@s\.whatsapp\.net$/.test(jid)
    ? jid.split("@")[0] : null;
}
const validId = (id) => typeof id === "string" && /^[A-Za-z0-9:_-]{1,160}$/.test(id);
const commands = { menu: "menu", latest: "kondisi", nodes: "lokasi", history: "riwayat", chart: "grafik", summary: "ringkasan", chat: "tanya aerobot", settings: "notifikasi", enable: "notifikasi aktif", disable: "notifikasi nonaktif" };
const mainChoices = ["latest", "nodes", "history", "chart", "summary", "chat", "settings"].map(id => "ae:" + id);
const mainTitles = ["Udara sekarang", "Pilih lokasi", "Riwayat", "Grafik", "Ringkasan hari ini", "Tanya AERO-BOT", "Notifikasi"];
function command(id) {
  const value = id?.replace(/^ae:/, "");
  if (commands[value]) return commands[value];
  if (/^node:[A-Za-z0-9_-]{1,40}$/.test(value || "")) return value.replace(":", " ");
  if (/^nodes:\d{1,4}$/.test(value || "")) return "lokasi " + (Number(value.split(":")[1]) + 1);
  return null;
}
function choiceRows(body) {
  const interactive = body.interactive;
  const rows = interactive?.action?.sections?.flatMap(s => s.rows || []) ||
    interactive?.action?.buttons?.map(b => b.reply) || [];
  return rows.filter(r => r && command(r.id) && typeof r.title === "string").slice(0, 12);
}
export const gowaChoiceIds = body => choiceRows(body || {}).map(r => r.id);
export function gowaText(body) {
  const rows = choiceRows(body);
  const main = rows.length === mainChoices.length && rows.every((r, i) => r.id === mainChoices[i]);
  const text = main ? "*AEROSENSE*\nPilih yang ingin Anda cek." : body.text || body.interactive?.body?.text || "";
  const choices = rows.map((r, i) => `*${i + 1}*  ${main ? mainTitles[i] : r.title}`);
  const range = choices.length === 1 ? "1" : `1–${choices.length}`;
  const footer = choices.length ? `Balas angka *${range}* untuk memilih.\n*0* untuk menu.` : body.alert_id ? "" : "Ketik *0* untuk menu.";
  const result = [text, choices.join("\n"), footer].filter(Boolean).join("\n\n");
  if (!text.trim() || result.length > 12000) throw Object.assign(new Error("Invalid GOWA message text"), { definitive: true });
  return result;
}
function menuReply(text, choices) {
  const t = text.trim().toLowerCase();
  if (/^(?:halo|hallo|hai|hi|hello|mulai|start|menu|\/start|\/menu|tes|test|ping|permisi|p|selamat (?:pagi|siang|sore|malam)|assalamualaikum)(?:[\s,!.-]+(?:aerosense|aero[ -]?bot))?[\s!.,]*$/i.test(t)) return "ae:menu";
  if (/^\d{1,2}$/.test(t)) {
    if (Number(t) === 0) return "ae:menu";
    return (choices.length ? choices : mainChoices)[Number(t) - 1] || "ae:menu";
  }
  if (t === "notifikasi aktif") return "ae:enable";
  if (t === "notifikasi nonaktif") return "ae:disable";
  const node = /^node ([a-z0-9_-]{1,40})$/i.exec(text.trim());
  if (node) return "ae:node:" + node[1];
  const page = /^lokasi ([1-9]\d{0,3})$/.exec(t);
  if (page) return "ae:nodes:" + (Number(page[1]) - 1);
  return null;
}
export function normalizeGowa(event, env, now = Date.now(), choices = []) {
  if (!phoneFromJid(env.GOWA_DEVICE_JID) || event?.device_id !== env.GOWA_DEVICE_JID ||
      (event.session_id && event.session_id !== env.GOWA_DEVICE_ID)) return null;
  const p = event.payload;
  if (!p || typeof p !== "object") return null;
  // GOWA v9.6 resolves a receipt sender to PN, but leaves its chat_id as LID.
  // Accept that resolved sender only for a private-chat receipt; never parse a LID as a phone.
  const phone = phoneFromJid(p.chat_id) || (event.event === "message.ack" &&
    /^\d{8,20}@lid$/.test(p.chat_id || "") ? phoneFromJid(p.from) : null);
  if (!phone) return null; // No group, broadcast or unresolved LID identifiers.
  if (event.event === "message.ack") {
    if (!["delivered", "read", "played"].includes(p.receipt_type) ||
        !Array.isArray(p.ids) || p.ids.length > 100 || !p.ids.every(validId)) return null;
    return { type: "receipt", phone, ids: p.ids, status: p.receipt_type };
  }
  const timestamp = Date.parse(p.timestamp);
  if (event.event !== "message" || p.is_from_me !== false || !validId(p.id) ||
      !Number.isFinite(timestamp) || timestamp < now - 86400000 || timestamp > now + 300000 ||
      typeof p.body !== "string" || p.body.length > 12000 ||
      (p.from !== p.chat_id && !/^\d{8,20}@lid$/.test(p.from || ""))) return null;
  const reply = menuReply(p.body, choices);
  const message = { id: p.id, from: phone, timestamp: String(Math.floor(timestamp / 1000)),
    type: reply ? "interactive" : "text", text: { body: p.body } };
  if (reply) message.interactive = { type: "list_reply", list_reply: { id: reply } };
  return { type: "message", phone, message };
}
export async function sendGowa(body, env, fetcher = fetch) {
  if (!/^\d{8,15}$/.test(body.phone || "") || !phoneFromJid(env.GOWA_DEVICE_JID) ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(env.GOWA_DEVICE_ID || "") || !env.GOWA_BASIC_AUTH)
    throw Object.assign(new Error("GOWA configuration incomplete"), { definitive: true });
  const base = new URL(env.GOWA_BASE_URL);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw Object.assign(new Error("Invalid GOWA URL"), { definitive: true });
  const payload = { phone: body.phone + "@s.whatsapp.net", message: gowaText(body) };
  const response = await fetcher(new URL("/send/message", base), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Device-Id": env.GOWA_DEVICE_ID,
      Authorization: "Basic " + Buffer.from(env.GOWA_BASIC_AUTH).toString("base64") },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw Object.assign(new Error("GOWA HTTP " + response.status), {
    definitive: [400, 401, 403, 404, 422, 429].includes(response.status),
  });
  const result = await response.json();
  const id = result?.results?.message_id;
  if (result.code !== "SUCCESS" || !validId(id)) throw new Error("GOWA send acknowledgement missing");
  return id;
}
