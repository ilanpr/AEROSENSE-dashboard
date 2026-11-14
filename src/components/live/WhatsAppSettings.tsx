import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import { api } from "@/services/api";
import type { LiveNode } from "@/types/live.types";
import { WhatsAppEntry } from "./WhatsAppEntry";
export function WhatsAppSettings({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const nodes = useLiveData<{ nodes: LiveNode[] }>(user ? "/v1/dashboard" : null, 60000);
  const subscriptions = useLiveData<{
    subscriptions: { node_id: string; phone: string }[];
  }>(user ? "/v1/subscriptions" : null, 60000);
  const [selected, setSelected] = useState("");
  const [command, setCommand] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user || !nodes.data?.nodes.length) return null;
  const sensorNodes = nodes.data.nodes;
  const id = sensorNodes.find((node) => node.id === selected)?.id ?? sensorNodes[0].id;
  const activeSubscriptions = subscriptions.data?.subscriptions ?? [];
  return (
    <section className={embedded ? "wa-settings" : "live-panel wa-settings"}>
      {!embedded && <h2>Notifikasi WhatsApp</h2>}
      <div className="wa-settings-controls">
        <span className="wa-settings-label">Lokasi sensor</span>
        <MonitoringSelect
          label="Lokasi sensor"
          value={id}
          onValueChange={(value) => {
            setSelected(value);
            setCommand("");
          }}
          options={sensorNodes.map((n) => ({ value: n.id, label: n.name }))}
        />
        <button
          className="live-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const p = await api.post<{ command: string }>("/v1/whatsapp/pair", { node_id: id });
              setCommand(p.command);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Kode belum dapat dibuat.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Menyiapkan kode…" : "Buat kode penghubung"}
        </button>
      </div>
      {command && (
        <div className="wa-pair-actions">
          <WhatsAppEntry command={command} label="Hubungkan WhatsApp" />
          <details>
            <summary>Lihat kode manual · berlaku 10 menit</summary>
            <code>{command}</code>
          </details>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {subscriptions.error && <p role="alert">{subscriptions.error}</p>}
      {activeSubscriptions.length > 0 && (
        <div className="wa-subscription-list">
          <h3>Langganan aktif</h3>
          <ul>
            {activeSubscriptions.map(({ node_id, phone }) => (
              <li key={node_id + ":" + phone}>
                <strong>{sensorNodes.find((node) => node.id === node_id)?.name || node_id}</strong>
                <span>+{phone}</span>
              </li>
            ))}
          </ul>
          <p>Kirim <strong>BERHENTI</strong> di WhatsApp untuk berhenti berlangganan.</p>
        </div>
      )}
    </section>
  );
}
