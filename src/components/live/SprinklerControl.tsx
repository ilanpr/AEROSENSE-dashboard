import { useState, type FormEvent } from "react";
import { Droplets, Square, Radio, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLiveData } from "@/hooks/useLiveData";
import { api } from "@/services/api";
import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import "./sprinkler-control.css";
type Command = {
  id: string;
  action: "pulse" | "session" | "stop";
  state: string;
  reason?: string;
  issued_at: string;
  expires_at: string;
  trigger_band?: "warning" | "danger" | null;
};
type Actuator = {
  id: string;
  name: string;
  enabled: boolean;
  online: boolean;
  can_run: boolean;
  latitude?: number | null;
  longitude?: number | null;
  auto_metric?: string | null;
  espnow_auto?: boolean;
  espnow_duration_ms?: number;
  espnow_policy?: { revision: string; enabled: boolean };
  next_run_at?: string;
  status: {
    output?: string;
    battery_v?: number;
    session_active?: boolean;
    manual_restart?: boolean;
    max_session_duration_ms?: number;
    session_burst_ms?: number | null;
    session_pause_ms?: number | null;
    espnow_paired?: boolean;
    espnow_fresh?: boolean;
    espnow_policy_rev?: string | null;
  };
  commands: Command[];
};
const labels: Record<string, string> = {
  queued: "Menunggu pengiriman",
  dispatching: "Mengirim ke perangkat",
  published: "Menunggu balasan ESP32",
  accepted: "Perintah berjalan",
  completed: "Selesai",
  rejected: "Ditolak perangkat",
  fault: "Dihentikan pengaman",
  expired: "Balasan belum diterima",
  cancelled: "Dibatalkan",
  stopped: "Dihentikan",
};
function SprinklerCard({ actuator: a, canManage, nodeId }: {
  actuator: Actuator; canManage: boolean; nodeId: string;
}) {
  const [minutes, setMinutes] = useState("30"),
    [busy, setBusy] = useState(false),
    [stopping, setStopping] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [pending, setPending] = useState<Command | null>(null);
  const durationMs = Number(minutes) * 60000;
  const durationSupported = (a.status.max_session_duration_ms ?? 0) >= durationMs;
  const durationLabel = minutes === "60" ? "1 jam" : `${minutes} menit`;
  const burstMs = a.status.session_burst_ms;
  const burstLabel = burstMs && (burstMs % 60000 === 0 ? `${burstMs / 60000} menit` : `${burstMs / 1000} detik`);
  const latest = a.commands[0];
  const command =
    latest && (!pending || Date.parse(latest.issued_at) >= Date.parse(pending.issued_at))
      ? latest
      : pending;
  const active =
    (a.online && a.status.session_active) || (command &&
    ["queued", "dispatching", "published", "accepted"].includes(command.state) &&
    Date.parse(command.expires_at) > Date.now());
  async function send(action: "session" | "stop") {
    if (action === "stop") setStopping(true);
    else setBusy(true);
    setError("");
    try {
      const result = await api.post<{ command: Command }>("/v1/actuators/commands", {
        actuator_id: a.id,
        action,
        duration_ms: action === "session" ? durationMs : 0,
        request_id: crypto.randomUUID(),
      });
      setPending((previous) =>
        !previous || Date.parse(result.command.issued_at) >= Date.parse(previous.issued_at)
          ? result.command
          : previous,
      );
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perintah belum dapat dikirim.");
    } finally {
      if (action === "stop") setStopping(false);
      else setBusy(false);
    }
  }
  return (
    <article className="sprinkler-card">
      <div className="sprinkler-card-heading">
        <div className="sprinkler-device-icon">
          <Droplets size={24} aria-hidden="true" />
        </div>
        <div>
          <h3>{a.name}</h3>
          <p>WATERSENSE · {a.id}</p>
        </div>
        <span className={"sprinkler-connection " + (a.online ? "online" : "")}>
          <Radio size={14} aria-hidden="true" />
          {a.online ? "Terhubung" : "Offline"}
        </span>
      </div>
      <dl className="sprinkler-facts">
        <div>
          <dt>Perangkat</dt>
          <dd>{a.enabled ? "Kontrol diaktifkan" : "Belum diaktifkan admin"}</dd>
        </div>
        <div>
          <dt>Baterai</dt>
          <dd>
            {a.online && typeof a.status.battery_v === "number"
              ? `${a.status.battery_v.toFixed(1)} V`
              : "Belum tersedia"}
          </dd>
        </div>
        <div>
          <dt>Keluaran ESP32</dt>
          <dd>
            {a.online ? (a.status.output === "on" ? "Aktif" : "Mati") : "Belum terkonfirmasi"}
          </dd>
        </div>
        <div>
          <dt>Aktivasi otomatis</dt>
          <dd>{a.auto_metric && a.enabled ? (a.espnow_auto ? "ESP-NOW · debu optik" : a.auto_metric === "pm25_ug_m3" ? "PM2.5 estimasi" : "Debu optik") : "Nonaktif"}</dd>
        </div>
        {a.espnow_auto && (
          <div>
            <dt>Link sensor lokal</dt>
            <dd>{!a.online ? "Belum terpantau dari web" : a.status.espnow_fresh ? "Data diterima" : a.status.espnow_paired ? "Menunggu data" : "Belum dipasangkan"}</dd>
          </div>
        )}
        {a.latitude != null && a.longitude != null && (
          <div>
            <dt>Posisi WATERSENSE</dt>
            <dd><Link to={`/sensor-map?node_id=${encodeURIComponent(nodeId)}&watersense=${encodeURIComponent(a.id)}`}>Lihat di peta</Link></dd>
          </div>
        )}
      </dl>
      <div className="sprinkler-command-status" role="status" aria-live="polite">
        <strong>
          {a.online && a.status.session_active
            ? (a.status.output === "on" ? "Sesi berlangsung · menyemprot" : "Sesi berlangsung · jeda")
            : command ? labels[command.state] || command.state : a.can_run ? "Siap menerima perintah" : "Perangkat belum siap"}
        </strong>
        {command?.trigger_band && <span>Otomatis · {command.trigger_band === "danger" ? "Bahaya" : "Waspada"}</span>}
        <span>
          {!a.online
            ? "Periksa Wi-Fi dan daya WATERSENSE."
            : !a.status.manual_restart && !a.status.session_active && a.next_run_at && Date.parse(a.next_run_at) > Date.now()
              ? `Kendali berikutnya tersedia pukul ${new Date(a.next_run_at).toLocaleTimeString("id-ID")}.`
              : "Durasi dibatasi dan pompa berhenti otomatis."}
        </span>
      </div>
      {canManage ? (
        <>
          <label className="sprinkler-duration">
            Durasi sesi
            <MonitoringSelect
              label={"Durasi sesi " + a.name}
              value={minutes}
              onValueChange={(v) => {
                setMinutes(v);
                setConfirm(false);
              }}
              options={[30, 45, 60].map((value) => ({
                value: String(value),
                label: value === 60 ? "1 jam" : `${value} menit`,
              }))}
            />
          </label>
          <p className="sprinkler-readonly">
            {a.online && burstLabel && a.status.session_pause_ms != null
              ? `Total sesi mencakup siklus semprot ${burstLabel} dan jeda ${a.status.session_pause_ms / 1000} detik.`
              : "Total sesi mencakup waktu semprot dan jeda perangkat."}
            {a.online && !durationSupported && " Perbarui firmware WATERSENSE untuk menjalankan sesi."}
          </p>
          <div className="sprinkler-actions">
            <button
              className="live-button"
              disabled={busy || !a.can_run || !!active || !durationSupported}
              onClick={() => setConfirm(true)}
            >
              <Droplets size={16} aria-hidden="true" />
              Aktifkan sprinkler
            </button>
            <button
              className="sprinkler-stop"
              disabled={stopping}
              onClick={() => void send("stop")}
            >
              <Square size={16} aria-hidden="true" />
              Hentikan
            </button>
          </div>
          {confirm && (
            <div className="sprinkler-confirm">
              <p>
                Mulai sesi semprot berjeda selama <strong>{durationLabel}</strong> pada <strong>{a.name}</strong>?
              </p>
              <div>
                <button
                  className="live-button"
                  disabled={busy || !a.can_run || !!active || !durationSupported}
                  onClick={() => void send("session")}
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}Ya, mulai sesi
                </button>
                <button
                  className="live-button secondary"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="sprinkler-readonly">
          Kontrol memerlukan penugasan admin atau pengelola pada lokasi ini.
        </p>
      )}
      {error && (
        <p className="threshold-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function SprinklerSettings({ nodeId, actuators, pm25 }: {
  nodeId: string; actuators: Actuator[]; pm25: boolean;
}) {
  const [selected, setSelected] = useState(actuators[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const actuator = actuators.find((item) => item.id === selected);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const coordinate = (key: string) => {
      const value = String(form.get(key) || "").trim().replace(",", ".");
      return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : null;
    };
    const values = {
      id: actuator?.id || form.get("id"), node_id: nodeId, name: form.get("name"),
      latitude: coordinate("latitude"), longitude: coordinate("longitude"),
      enabled: form.has("enabled"), auto_metric: form.get("auto_metric") || null,
      espnow_auto: form.has("espnow_auto"),
      espnow_duration_ms: Number(form.get("espnow_duration_ms")) || 1800000,
    };
    if (values.enabled && values.auto_metric &&
        (!actuator?.enabled || values.auto_metric !== actuator.auto_metric ||
          values.espnow_auto !== Boolean(actuator.espnow_auto)) &&
        !window.confirm("Aktifkan semprotan otomatis saat ambang lokasi terpenuhi?")) return;
    setBusy(true);
    setMessage("");
    try {
      if (actuator) await api.patch("/v1/actuators", values);
      else {
        await api.post("/v1/actuators", values);
        element.reset();
      }
      setMessage(actuator ? "Pengaturan tersimpan." : "Perangkat berhasil ditambahkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pengaturan belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="sprinkler-settings">
      <summary>Pengaturan WATERSENSE</summary>
      <label className="sprinkler-settings-picker">
        Perangkat
        <select
          aria-label="Perangkat"
          value={actuator?.id ?? ""}
          disabled={busy}
          onChange={(event) => {
            setSelected(event.target.value);
            setMessage("");
          }}
        >
          {actuators.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.id}</option>
          ))}
          <option value="">Tambah perangkat baru</option>
        </select>
      </label>
      <form key={actuator?.id ?? ""} onSubmit={(event) => void save(event)}>
        {!actuator && <label>ID perangkat<input name="id" required maxLength={40} pattern="[a-z0-9\-]+" placeholder="mist-02" /></label>}
        <label>Nama perangkat<input name="name" required maxLength={80} defaultValue={actuator?.name} /></label>
        <label>Latitude<input name="latitude" inputMode="decimal" required defaultValue={actuator?.latitude ?? ""} /></label>
        <label>Longitude<input name="longitude" inputMode="decimal" required defaultValue={actuator?.longitude ?? ""} /></label>
        {actuator && (
          <>
            <label>Aktivasi otomatis
              <select name="auto_metric" defaultValue={actuator.auto_metric ?? ""}>
                <option value="">Nonaktif</option>
                <option value="dust_ug_m3">Ambang debu optik</option>
                {pm25 && <option value="pm25_ug_m3">Ambang PM2.5 estimasi</option>}
              </select>
            </label>
            <label className="sprinkler-settings-switch"><input name="enabled" type="checkbox" defaultChecked={actuator.enabled} /> Izinkan kendali perangkat</label>
            <label className="sprinkler-settings-switch"><input name="espnow_auto" type="checkbox" defaultChecked={actuator.espnow_auto} /> Otomatis lewat ESP-NOW</label>
            <label>Durasi otomatis ESP-NOW
              <select name="espnow_duration_ms" defaultValue={actuator.espnow_duration_ms ?? 1800000}>
                <option value={1800000}>30 menit</option>
                <option value={2700000}>45 menit</option>
                <option value={3600000}>1 jam</option>
              </select>
            </label>
          </>
        )}
        <div className="sprinkler-actions">
          <button className="live-button" disabled={busy}>{busy ? "Menyimpan…" : "Simpan WATERSENSE"}</button>
          {message && <span role="status">{message}</span>}
        </div>
      </form>
      {actuator?.espnow_policy && (
        <div className="sprinkler-settings-picker">
          <button type="button" className="live-button secondary" onClick={async () => {
            try {
              const result = await api.get<{ actuators: Actuator[] }>(`/v1/actuators?node_id=${encodeURIComponent(nodeId)}`);
              const policy = result.actuators.find((item) => item.id === actuator.id)?.espnow_policy;
              if (!policy) throw new Error("Profil tidak tersedia.");
              await navigator.clipboard.writeText(`POLICY ${JSON.stringify(policy)}`);
              setMessage("Profil disalin. Tempel di Serial Monitor WATERSENSE dengan newline.");
            } catch {
              setMessage("Profil belum bisa disalin. Coba lagi.");
            }
          }}>Salin profil ESP-NOW untuk USB</button>
          <p className="sprinkler-readonly">
            {actuator.online && actuator.status.espnow_policy_rev === actuator.espnow_policy.revision
              ? "Profil terbaru tersimpan di perangkat."
              : "Sinkronkan lewat MQTT atau masukkan profil terbaru lewat USB."}
          </p>
        </div>
      )}
    </details>
  );
}
export function SprinklerControl({ nodeId }: { nodeId: string }) {
  const data = useLiveData<{ actuators: Actuator[]; can_manage: boolean; can_register: boolean; pm25_validated: boolean }>(
    `/v1/actuators?node_id=${encodeURIComponent(nodeId)}`,
    2000,
  );
  return (
    <section className="sprinkler-section" aria-labelledby="sprinkler-heading">
      <header>
        <div>
          <h2 id="sprinkler-heading">Kendali sprinkler</h2>
          <p>Aktifkan WATERSENSE pada area yang menjadi tanggung jawab Anda.</p>
        </div>
        <Droplets size={26} aria-hidden="true" />
      </header>
      {data.loading && !data.data ? (
        <p role="status">Memeriksa perangkat…</p>
      ) : data.error ? (
        <div role="alert">
          <p>{data.error}</p>
          <button className="live-button secondary" onClick={data.refresh}>
            Coba kembali
          </button>
        </div>
      ) : !data.data?.actuators.length ? (
        <div className="sprinkler-empty">
          <Droplets size={24} aria-hidden="true" />
          <div>
            <h3>Belum ada sprinkler di titik ini</h3>
            <p>
              Admin dapat mendaftarkan WATERSENSE pada lokasi yang dilayani. Tidak semua titik
              sensor memerlukan sprinkler.
            </p>
          </div>
        </div>
      ) : (
        <div className="sprinkler-list">
          {data.data.actuators.map((a) => (
            <SprinklerCard key={a.id} actuator={a} canManage={data.data!.can_manage} nodeId={nodeId} />
          ))}
        </div>
      )}
      {data.data?.can_register && (
        <SprinklerSettings key={nodeId} nodeId={nodeId} actuators={data.data.actuators} pm25={data.data.pm25_validated} />
      )}
    </section>
  );
}
