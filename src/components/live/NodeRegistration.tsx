import { useState, type FormEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { api } from "@/services/api";
import "./node-registration.css";

type Registration = {
  locations: { id: string; name: string; can_publish: boolean }[];
  gateways: string[];
};

function RegistrationChoice({
  name,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="node-registration-choice">
      <legend>{label}</legend>
      <p>{hint}</p>
      {options.length === 1 ? (
        <strong className="node-registration-choice-value">{options[0].name}</strong>
      ) : (
        options.map((option) => (
          <label className="node-registration-option" key={option.id}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              required
            />
            {option.name}
          </label>
        ))
      )}
    </fieldset>
  );
}

export function NodeRegistration({ onCreated }: { onCreated: (id: string) => void }) {
  const registration = useLiveData<Registration>("/v1/nodes/registration", 60000);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [location, setLocation] = useState("");
  const [gateway, setGateway] = useState("");
  const locations = registration.data?.locations || [];
  const gateways = registration.data?.gateways || [];
  const locationId = locations.length === 1
    ? locations[0].id
    : locations.find((option) => option.id === location)?.id || "";
  const gatewayId = gateways.length === 1 ? gateways[0] : gateways.includes(gateway) ? gateway : "";
  const canPublish = locations.find((l) => l.id === locationId)?.can_publish;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !locationId || !gatewayId) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { node } = await api.post<{ node: { id: string; name: string } }>("/v1/nodes", {
        id: String(fields.get("id")).trim(),
        name: String(fields.get("name")).trim(),
        latitude: Number(fields.get("latitude")),
        longitude: Number(fields.get("longitude")),
        location_id: locationId,
        gateway_id: gatewayId,
        public_read: canPublish === true && fields.get("public_read") === "on",
      });
      form.reset();
      setOpen(false);
      setNotice(`${node.name} berhasil ditambahkan. Menunggu pembacaan dari gateway.`);
      onCreated(node.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Node belum dapat ditambahkan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="node-registration">
      <button
        className="btn-primary"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Plus size={17} /> Tambah node
      </button>
      {notice && <p role="status">{notice}</p>}
      {open && (
        <form onSubmit={submit} className="node-registration-form">
          <div>
            <h3>Tambah node sensor</h3>
            <p>Daftarkan perangkat pada lokasi yang Anda kelola.</p>
          </div>
          {registration.error && <p role="alert">{registration.error}</p>}
          <div className="node-registration-fields">
            <label>
              Nama node
              <input
                name="name"
                required
                maxLength={100}
                placeholder="Contoh: Sensor Gerbang Timur"
              />
            </label>
            <label>
              ID perangkat
              <input
                name="id"
                required
                pattern="[a-zA-Z0-9_\-]{1,40}"
                maxLength={40}
                placeholder="Sesuai ID pada firmware"
              />
            </label>
            <label>
              Latitude
              <input
                name="latitude"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                placeholder="-7.28"
              />
            </label>
            <label>
              Longitude
              <input
                name="longitude"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
                placeholder="112.79"
              />
            </label>
          </div>
          <fieldset className="node-registration-routing" disabled={busy}>
            <legend>Akses dan pengiriman data</legend>
            {registration.loading && !registration.data && <p role="status">Memuat lokasi dan gateway…</p>}
            {registration.data && (
              <div className="node-registration-choices">
                <RegistrationChoice
                  name="location"
                  label="Lokasi penugasan"
                  hint={locations.length
                    ? "Menentukan siapa yang dapat mengelola node ini."
                    : "Belum ada lokasi yang ditugaskan ke akun Anda."}
                  options={locations}
                  value={locationId}
                  onChange={setLocation}
                />
                <RegistrationChoice
                  name="gateway"
                  label="Gateway"
                  hint={gateways.length
                    ? "Perangkat yang menerima kiriman data dari node ini."
                    : "Belum ada gateway terdaftar. Hubungi admin AEROSENSE."}
                  options={gateways.map((id) => ({ id, name: id }))}
                  value={gatewayId}
                  onChange={setGateway}
                />
              </div>
            )}
          </fieldset>
          {canPublish && (
            <label className="node-registration-public">
              <input key={locationId} name="public_read" type="checkbox" /> Tampilkan lokasi dan
              pembacaan untuk publik
            </label>
          )}
          <p>
            ID harus sama dengan perangkat yang mengirim data. Pendaftaran tidak membuat pembacaan
            sensor.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="node-registration-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || !gatewayId || !locationId}
            >
              {busy && <Loader2 size={16} className="animate-spin" />}{" "}
              {busy ? "Menyimpan…" : "Simpan node"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
