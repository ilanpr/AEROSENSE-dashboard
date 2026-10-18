import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import { api } from "@/services/api";
import { DataState } from "@/components/shared/DataState";
import { metricLabels, type LiveNode } from "@/types/live.types";
import { WhatsAppSettings } from "@/components/live/WhatsAppSettings";
interface Rule {
  id: string;
  metric: string;
  high: number;
  clear_below: number;
  unit: string;
  cooldown_seconds: number;
  enabled: boolean;
}
export function SystemPage() {
  const auth = useAuth(),
    navigate = useNavigate();
  const nodes = useLiveData<{ nodes: LiveNode[] }>(
    auth.user ? "/v1/dashboard" : null,
    60000,
  );
  const [selected, setSelected] = useState("");
  const node =
    nodes.data?.nodes.find((n) => n.id === selected) || nodes.data?.nodes[0];
  const rules = useLiveData<{ rules: Rule[] }>(
    node ? "/v1/rules?node_id=" + encodeURIComponent(node.id) : null,
    60000,
  );
  const [metric, setMetric] = useState("eco2_ppm");
  const [high, setHigh] = useState("");
  const [clear, setClear] = useState("");
  const [cooldown, setCooldown] = useState("1800");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <header className="live-heading">
        <div>
          <h1>Pengaturan</h1>
          <p>Akun, ambang peringatan, dan langganan WhatsApp.</p>
        </div>
      </header>
      {!auth.user ? (
        <DataState
          error={auth.error || "Masuk untuk mengatur akun dan perangkat."}
        />
      ) : (
        <>
          <section className="live-panel">
            <h2>Akun</h2>
            <p>{auth.user.email}</p>
            <button
              className="live-button secondary"
              onClick={async () => {
                try {
                  await auth.logout();
                  navigate("/login");
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : "Gagal keluar.");
                }
              }}
            >
              Keluar akun
            </button>
          </section>
          <section className="live-panel">
            <h2>Aturan peringatan</h2>
            {nodes.error ? (
              <DataState error={nodes.error} />
            ) : !node ? (
              <p>Belum ada node yang dapat dikelola.</p>
            ) : (
              <>
                <label>
                  Node
                  <MonitoringSelect label="Node untuk aturan" value={node.id} onValueChange={setSelected}
                    options={(nodes.data?.nodes || []).map(n=>({value:n.id,label:n.name}))} />
                </label>
                {rules.error && <p role="alert">{rules.error}</p>}
                <ul className="rule-list">
                  {rules.data?.rules.map((r) => (
                    <li key={r.id}>
                      <strong>{metricLabels[r.metric]?.[0] || r.metric}</strong>
                      <span>
                        Ambang {r.high} {r.unit} · Pulih di bawah{" "}
                        {r.clear_below} · {r.enabled ? "Aktif" : "Nonaktif"}
                      </span>
                    </li>
                  ))}
                </ul>
                {["admin", "operator"].includes(node.role) ? (
                  <form
                    className="rule-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setNotice("");
                      try {
                        await api.post("/v1/rules", {
                          node_id: node.id,
                          metric,
                          high: Number(high),
                          clear_below: Number(clear),
                          unit: metricLabels[metric][1],
                          cooldown_seconds: Number(cooldown),
                          enabled: true,
                        });
                        setNotice("Aturan disimpan.");
                        rules.refresh();
                      } catch (err) {
                        setNotice(
                          err instanceof Error
                            ? err.message
                            : "Aturan gagal disimpan.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Parameter
                      <MonitoringSelect label="Parameter aturan" value={metric} onValueChange={setMetric}
                        options={Object.entries(metricLabels).filter(([k])=>k!=="pm25_ug_m3"||node.pm25_validated).map(([value,[label]])=>({value,label}))} />
                    </label>
                    <label>
                      Ambang atas
                      <input
                        type="number"
                        step="any"
                        required
                        value={high}
                        onChange={(e) => setHigh(e.target.value)}
                      />
                    </label>
                    <label>
                      Batas pulih
                      <input
                        type="number"
                        step="any"
                        required
                        value={clear}
                        onChange={(e) => setClear(e.target.value)}
                      />
                    </label>
                    <label>
                      Jeda notifikasi (detik)
                      <input
                        type="number"
                        min="60"
                        max="86400"
                        required
                        value={cooldown}
                        onChange={(e) => setCooldown(e.target.value)}
                      />
                    </label>
                    <button className="live-button" disabled={busy}>
                      Simpan aturan
                    </button>
                  </form>
                ) : (
                  <p>
                    Akun Anda dapat melihat data. Pengubahan aturan memerlukan
                    peran operator atau admin.
                  </p>
                )}
              </>
            )}
          </section>
          <WhatsAppSettings />
        </>
      )}
      {notice && (
        <p className="live-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
