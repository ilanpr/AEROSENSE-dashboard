import { useState } from "react";
import { useLiveData } from "@/hooks/useLiveData";
import { api } from "@/services/api";

type Request = {
  id: string;
  requested_role: string;
  note: string | null;
  created_at: string;
  applicant: { name?: string; email?: string; phone?: string; organization?: string; address?: string };
};
type Queue = { requests: Request[]; locations: { id: string; nodes: string[] }[] };
const ROLES = [
  ["viewer", "Warga"],
  ["operator", "Pengelola kawasan"],
  ["auditor", "Auditor / peneliti"],
  ["admin", "Admin lokasi"],
] as const;

// AEROSENSE team only (the API returns 403 to everyone else, and the panel then hides).
export function RoleRequestsPanel() {
  const queue = useLiveData<Queue>("/v1/role-requests", 60000);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  if (queue.error || !queue.data) return null;
  async function review(r: Request, form: HTMLFormElement, action: "approve" | "reject") {
    const f = new FormData(form);
    setBusy(r.id);
    setMsg("");
    try {
      await api.post("/v1/role-requests/" + r.id, {
        action,
        location_id: String(f.get("location") || "").trim(),
        role: f.get("role"),
        note: f.get("note"),
      });
      setMsg(action === "approve" ? "Peran disetujui." : "Permintaan ditolak.");
      queue.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Belum tersimpan.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="management-rules role-requests" aria-labelledby="role-requests-title">
      <h2 id="role-requests-title">Verifikasi peran</h2>
      {msg && <p role="status">{msg}</p>}
      {!queue.data.requests.length ? (
        <p>Tidak ada permintaan peran yang menunggu.</p>
      ) : (
        queue.data.requests.map((r) => (
          <form key={r.id} className="role-request" onSubmit={(e) => e.preventDefault()}>
            <dl>
              <dt>Pemohon</dt>
              <dd>{r.applicant.name || "Tanpa nama"} · {r.applicant.email}</dd>
              {r.applicant.organization && (<><dt>Instansi</dt><dd>{r.applicant.organization}</dd></>)}
              {r.applicant.phone && (<><dt>Telepon</dt><dd>+{r.applicant.phone}</dd></>)}
              {r.applicant.address && (<><dt>Alamat</dt><dd>{r.applicant.address}</dd></>)}
              <dt>Diminta</dt>
              <dd>{ROLES.find(([v]) => v === r.requested_role)?.[1]} · {new Date(r.created_at).toLocaleString("id-ID")}</dd>
              {r.note && (<><dt>Keterangan</dt><dd>{r.note}</dd></>)}
            </dl>
            <label>
              Lokasi
              <input name="location" list="role-locations" required pattern="[a-zA-Z0-9_-]{2,40}" placeholder="ID lokasi" />
            </label>
            <label>
              Peran yang diberikan
              <select name="role" defaultValue={r.requested_role}>
                {ROLES.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </select>
            </label>
            <label>
              Catatan untuk pemohon
              <input name="note" maxLength={500} />
            </label>
            <div className="role-request-actions">
              <button type="button" className="live-button" disabled={busy === r.id}
                onClick={(e) => { const f = e.currentTarget.form!; if (f.reportValidity()) void review(r, f, "approve"); }}>
                Setujui
              </button>
              <button type="button" className="live-button secondary" disabled={busy === r.id}
                onClick={(e) => void review(r, e.currentTarget.form!, "reject")}>
                Tolak
              </button>
            </div>
          </form>
        ))
      )}
      <datalist id="role-locations">
        {queue.data.locations.map((l) => (
          <option key={l.id} value={l.id}>{l.nodes.join(", ")}</option>
        ))}
      </datalist>
    </section>
  );
}
