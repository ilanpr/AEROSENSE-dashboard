// Robot mood: every 15 minutes (06.00–21.00 WIB) each online robot tells how the air near its node feels,
// with a face matching the condition, what the number means, and what to do. Pure text logic is in moodFor().
export const MOOD_EVERY_MS = 15 * 60000;

const HOOKS = {
  danger: [
    "Aduh, kok aku ngerasa sesak dan panas banget ya. Pasti karena udara di luar sedang buruk nih.",
    "Uhuk uhuk, aduh tenggorokanku nggak enak. Kayaknya udara di luar lagi kotor banget.",
    "Aduh, kepalaku pusing nih. Sepertinya udara di sekitar sini sedang tidak sehat.",
  ],
  warning: [
    "Hmm, hidungku mulai gatal nih. Sepertinya udara di luar mulai kurang bersih.",
    "Eh, aku merasa udaranya agak pengap ya. Yuk kita cek bareng.",
    "Hmm, aku agak kurang nyaman nih. Udara di luar sedang tidak terlalu bersih.",
  ],
  calm: [
    "Yeay, napasku lega banget! Udara di sekitar sini lagi segar.",
    "Halo semuanya! Aku lagi senang nih, udaranya bersih.",
    "Asyik, sensorku bilang udaranya lagi bagus hari ini.",
  ],
};
const MEANING = {
  danger:
    "Artinya debu halus cukup banyak dan bisa masuk ke paru-paru, bikin batuk atau sesak, terutama untuk anak-anak, lansia, dan penderita asma.",
  warning:
    "Artinya udara masih bisa dipakai beraktivitas, tapi teman-teman yang sensitif seperti penderita asma bisa mulai merasa terganggu.",
  calm: "Artinya udara aman untuk beraktivitas di luar.",
};
const ACTION = {
  danger:
    "Yuk tutup jendela, pakai masker N95 atau KN95 kalau harus keluar, tunda olahraga di luar, dan jangan bakar sampah ya.",
  warning:
    "Kalau mau keluar lama, siapkan masker, kurangi olahraga berat di luar, dan hindari asap kendaraan ya.",
  calm: "Waktu yang pas untuk buka jendela supaya udara segar masuk. Tetap jaga ya, jangan bakar sampah.",
};
const FACE = { danger: "danger", warning: "warning", calm: "happy" };
// ISPU PM2.5 (Permen LHK 14/2020) categories, used for wording and when a node has no rule.
const ispu = (v) =>
  v <= 15.5
    ? ["baik", "calm"]
    : v <= 55.4
      ? ["sedang", "calm"]
      : v <= 150.4
        ? ["tidak sehat", "warning"]
        : v <= 250.4
          ? ["sangat tidak sehat", "danger"]
          : ["berbahaya", "danger"];
const num = (v, d = 0) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");

// latest: ae_latest row; rules: ae_rules rows for the node; slot: index used to vary the opening line.
// Returns null when there is nothing trustworthy to say (no recent valid reading).
export function moodFor({ latest, rules = [], pm25Validated, slot = 0, now = Date.now() }) {
  if (!latest?.observed_at || now - Date.parse(latest.observed_at) > 600000) return null;
  if (latest.quality?.invalid === true) return null;
  const metric = pm25Validated && Number.isFinite(latest.metrics?.pm25_ug_m3) ? "pm25_ug_m3" : "dust_ug_m3";
  const value = latest.metrics?.[metric];
  if (!Number.isFinite(value) || value < 0) return null;
  const [category, ispuBand] = ispu(value);
  const rule = rules.find((r) => r.enabled && r.metric === metric && Number.isFinite(r.high) && r.high > 0);
  const band = rule
    ? Number.isFinite(rule.danger_high) && value >= rule.danger_high
      ? "danger"
      : value >= rule.high
        ? "warning"
        : "calm"
    : ispuBand;
  const label = metric === "pm25_ug_m3" ? "PM2.5" : "kadar debu";
  const hooks = HOOKS[band];
  const parts = [
    hooks[slot % hooks.length],
    `Sensorku membaca ${label} di angka ${num(value, 1)} mikrogram per meter kubik, masuk kategori ${category}.`,
    MEANING[band],
    ACTION[band],
  ];
  const t = latest.metrics?.temperature_c;
  if (Number.isFinite(t) && t >= 32)
    parts.push(`Suhunya juga ${num(t, 1)} derajat, jadi minum air putih yang cukup dan cari tempat teduh.`);
  return { band, face: FACE[band], severity: band === "calm" ? null : band, text: parts.join(" ") };
}

// Hours in WIB when the robot may speak on its own.
export const awakeHour = (now = Date.now()) => {
  const h = new Date(now + 7 * 3600000).getUTCHours();
  return h >= 6 && h < 21;
};

export function startRobotMood({ db, filter, speak, now = Date.now }) {
  async function tick() {
    const t = now();
    if (!awakeHour(t)) return;
    const slot = Math.floor(t / MOOD_EVERY_MS);
    const robots = await db("ae_robots", "enabled=eq.true&quiet=eq.false&select=id,node_id,last_seen_at");
    for (const robot of robots || []) {
      // Skip robots that are not polling: audio for an offline robot would only expire unused.
      if (!robot.last_seen_at || t - Date.parse(robot.last_seen_at) > 600000) continue;
      const [latest] = await db("ae_latest", "node_id=eq." + filter(robot.node_id) + "&limit=1");
      const [node] = await db("ae_nodes", "id=eq." + filter(robot.node_id) + "&select=pm25_validated&limit=1");
      const rules = await db("ae_rules", "node_id=eq." + filter(robot.node_id));
      const mood = moodFor({ latest, rules, pm25Validated: node?.pm25_validated === true, slot, now: t });
      if (!mood) continue;
      await speak(robot, "mood:" + robot.id + ":" + slot, mood).catch((err) =>
        console.error("[robot mood]", robot.id, err.message),
      );
    }
  }
  const run = () => void tick().catch((err) => console.error("[robot mood]", err.message));
  const timer = setInterval(run, MOOD_EVERY_MS);
  timer.unref();
  return timer;
}
