import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REFUSAL =
  "Maaf, AERO-BOT hanya membantu pertanyaan tentang kualitas udara, pengurangan polusi, dan lingkungan. Silakan gunakan bahasa yang sopan.";
export const UNAVAILABLE =
  "AERO-BOT belum dapat memproses permintaan ini. Silakan coba lagi. Data sensor tetap tersedia di dashboard.";
export const LIMITS = {
  temperature_c: [-40, 80],
  humidity_pct: [0, 100],
  eco2_ppm: [0, 60000],
  tvoc_ppb: [0, 60000],
  dust_ug_m3: [0, 10000],
  pm25_ug_m3: [0, 10000],
};
export const sha = (text) => createHash("sha256").update(text).digest("hex");
export function equal(a, b) {
  const x = Buffer.from(a || ""),
    y = Buffer.from(b || "");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}
export function verifyMeta(raw, signature, secret) {
  return equal(signature, "sha256=" + createHmac("sha256", secret).update(raw).digest("hex"));
}
export function cleanText(text) {
  if (typeof text !== "string" || !text.trim() || text.length > 2000)
    throw new Error("Teks harus berisi 1 sampai 2000 karakter");
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .trim();
}
export function abusive(text) {
  // Preliminary screen only. Contextual hate, SARA and scope require the Gemini gate too.
  return /\b(anjing|bangsat|bajingan|kontol|memek|fuck|shit|nigger)\b/i.test(
    text.normalize("NFKC"),
  );
}
export function validateTelemetry(p, node, now = Date.now()) {
  if (p.node_id !== node.id || !node.enabled) throw new Error("Node tidak terdaftar");
  if (
    !/^[a-zA-Z0-9_-]{1,64}$/.test(p.boot_id) ||
    !Number.isSafeInteger(p.sequence) ||
    p.sequence < 0
  )
    throw new Error("Identitas paket tidak valid");
  const ts = Date.parse(p.observed_at);
  if (!Number.isFinite(ts) || ts > now + 60000 || ts < now - 86400000)
    throw new Error("Waktu pengamatan tidak valid");
  if (!p.metrics || typeof p.metrics !== "object" || Array.isArray(p.metrics))
    throw new Error("Metrics tidak valid");
  for (const [key, value] of Object.entries(p.metrics)) {
    if (
      !LIMITS[key] ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < LIMITS[key][0] ||
      value > LIMITS[key][1]
    )
      throw new Error("Nilai sensor tidak valid: " + key);
    if (key === "pm25_ug_m3" && !node.pm25_validated)
      throw new Error("PM2.5 belum divalidasi pada node ini");
  }
  if (!Object.keys(p.metrics).length) throw new Error("Metrics kosong");
  if (p.gru != null) {
    if (typeof p.gru.model_version !== "string" || p.gru.model_version.length > 100)
      throw new Error("Invalid model version");
    for (const key of ["artifact_sha256", "manifest_sha256"])
      if (p.gru[key] != null && !/^[a-f0-9]{64}$/.test(p.gru[key]))
        throw new Error("Invalid model hash");
    if (p.gru.processed_at != null && !Number.isFinite(Date.parse(p.gru.processed_at)))
      throw new Error("Invalid processing time");
    if (
      p.gru.input_features != null &&
      (!Array.isArray(p.gru.input_features.names) ||
        p.gru.input_features.names.some((k) => !LIMITS[k]))
    )
      throw new Error("Invalid feature names");
    for (const key of ["input_features", "normalized_input"]) {
      const matrix = key === "input_features" ? p.gru[key]?.values : p.gru[key];
      if (
        matrix != null &&
        (!Array.isArray(matrix) ||
          !matrix.length ||
          matrix.length > 128 ||
          matrix.some(
            (row) =>
              !Array.isArray(row) ||
              row.length > 16 ||
              !row.length ||
              row.some((v) => !Number.isFinite(v)),
          ))
      )
        throw new Error("Invalid model input");
    }
    if (
      p.gru.input_readings != null &&
      (!Array.isArray(p.gru.input_readings) ||
        p.gru.input_readings.length > 128 ||
        p.gru.input_readings.some(
          (r) =>
            r.node_id !== p.node_id ||
            !Number.isFinite(Date.parse(r.observed_at)) ||
            !Number.isSafeInteger(r.sequence),
        ))
    )
      throw new Error("Invalid model reading references");
    const validEstimate = (key, value) =>
      Object.hasOwn(LIMITS, key) &&
      Number.isFinite(value) &&
      value >= LIMITS[key][0] &&
      value <= LIMITS[key][1] &&
      (key !== "pm25_ug_m3" || node.pm25_validated === true);
    if (p.gru.task === "fault_detection") {
      const estimates = p.gru.estimates;
      if (
        !estimates ||
        Array.isArray(estimates) ||
        !Object.keys(estimates).length ||
        !Object.entries(estimates).every(([key, value]) => validEstimate(key, value)) ||
        p.gru.mode !== "shadow" ||
        !Array.isArray(p.gru.suspect) ||
        p.gru.suspect.some((key) => !Object.hasOwn(estimates, key))
      )
        throw new Error("Hasil pemeriksaan GRU tidak valid");
      for (const field of ["fault_scores", "thresholds"]) {
        const scores = p.gru[field];
        if (
          !scores ||
          Array.isArray(scores) ||
          Object.keys(scores).length !== Object.keys(estimates).length ||
          !Object.entries(scores).every(
            ([key, value]) =>
              Object.hasOwn(estimates, key) && Number.isFinite(value) && value >= 0 && value <= 1,
          )
        )
          throw new Error("Skor pemeriksaan GRU tidak valid");
      }
    } else if (!validEstimate(p.gru.target, p.gru.value)) {
      throw new Error("Hasil GRU tidak valid");
    }
    if (
      !p.gru.model_version ||
      !Number.isInteger(p.gru.horizon_seconds) ||
      p.gru.horizon_seconds < 0 ||
      p.gru.horizon_seconds > 86400
    )
      throw new Error("Hasil GRU tidak valid");
  }
  for (const key of ["raw_metrics", "raw_payload", "processing", "quality"])
    if (
      p[key] != null &&
      (typeof p[key] !== "object" || Array.isArray(p[key]) || JSON.stringify(p[key]).length > 12000)
    )
      throw new Error("Invalid " + key);
  if (p.raw_sha256 != null && !/^[a-f0-9]{64}$/.test(p.raw_sha256))
    throw new Error("Invalid raw hash");
  if (p.gru && JSON.stringify(p.gru).length > 16000) throw new Error("Model input too large");
  return {
    node_id: p.node_id,
    boot_id: p.boot_id,
    sequence: p.sequence,
    observed_at: new Date(ts).toISOString(),
    metrics: p.metrics,
    gru: p.gru ?? null,
    raw_metrics: p.raw_metrics ?? null,
    raw_payload: p.raw_payload ?? null,
    raw_sha256: p.raw_sha256 ?? null,
    processing: p.processing ?? {},
    quality: {
      ...p.quality,
      clock_source: p.quality?.clock_source === "sensor" ? "sensor" : "gateway",
      invalid: p.quality?.invalid === true,
      calibration_version: node.calibration_version,
    },
  };
}
export function modelText(response) {
  if (response.status !== "completed") throw new Error("Gemini did not complete");
  const text = (response.steps || [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini empty response");
  return text;
}
export function parseGate(text) {
  const value = JSON.parse(text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
  if (!["allow", "deny"].includes(value.decision)) throw new Error("Invalid policy decision");
  return value.decision === "allow";
}
export function waPayload(job, contact, env, now = Date.now()) {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: job.phone,
  };
  if (now - Date.parse(contact.last_inbound_at) < 23.9 * 3600000)
    return { ...base, type: "text", text: { body: job.text.slice(0, 3500) } };
  if (!job.alert_id) return null; // Never reopen an expired conversation with a free-form reply.
  if (!env.WHATSAPP_ALERT_TEMPLATE) throw new Error("Approved alert template not configured");
  return {
    ...base,
    type: "template",
    template: {
      name: env.WHATSAPP_ALERT_TEMPLATE,
      language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE || "id" },
      components: [
        {
          type: "body",
          parameters: job.template_vars.map((text) => ({
            type: "text",
            text: String(text),
          })),
        },
      ],
    },
  };
}
export function wavAudio(response) {
  if (response.status !== "completed") throw new Error("Speech generation failed");
  const audio = response.steps
    ?.filter((s) => s.type === "model_output")
    .flatMap((s) => s.content || [])
    .filter((c) => c.type === "audio")
    .at(-1);
  if (!audio || !audio.mime_type?.startsWith("audio/wav"))
    throw new Error("Expected unary WAV response");
  const buffer = Buffer.from(audio.data, "base64");
  if (
    buffer.length > 2000000 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("Invalid WAV output");
  return buffer;
}
export function isFresh(row, now = Date.now()) {
  return now - Date.parse(row.observed_at) <= 600000;
}
export function validateInputWav(b) {
  if (
    b.length < 44 ||
    b.length > 480100 ||
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 12) !== "WAVE" ||
    b.readUInt32LE(4) + 8 !== b.length
  )
    throw new Error("Invalid WAV container");
  let format = null,
    data = null;
  for (let at = 12; at + 8 <= b.length; ) {
    const size = b.readUInt32LE(at + 4),
      end = at + 8 + size;
    if (end > b.length) throw new Error("Truncated WAV");
    const type = b.toString("ascii", at, at + 4);
    if (type === "fmt " && size >= 16)
      format = {
        encoding: b.readUInt16LE(at + 8),
        channels: b.readUInt16LE(at + 10),
        rate: b.readUInt32LE(at + 12),
        bits: b.readUInt16LE(at + 22),
      };
    if (type === "data") data = size;
    at = end + (size % 2);
  }
  if (
    !format ||
    format.encoding !== 1 ||
    format.channels !== 1 ||
    format.rate !== 16000 ||
    format.bits !== 16 ||
    !data ||
    data % 2 ||
    data > 480000
  )
    throw new Error("Expected up to 15 seconds of 16 kHz mono PCM16");
  return b;
}
