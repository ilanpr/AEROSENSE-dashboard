import { NearbyAlerts } from "@/components/live/NearbyAlerts";
import { WhatsAppSettings } from "@/components/live/WhatsAppSettings";
import { useAuth } from "@/hooks/useAuth";
import { WhatsAppEntry } from "@/components/live/WhatsAppEntry";
export function AlertsPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <NearbyAlerts />
      <section className="wa-alert-entry" aria-label="AEROSENSE di WhatsApp">
        <div><h2>Lanjutkan lewat WhatsApp</h2><p>Tanya AERO-BOT atau hubungkan notifikasi node.</p></div>
        <WhatsAppEntry />
      </section>
      {user && <details className="insight-disclosure"><summary>Atur langganan WhatsApp</summary><WhatsAppSettings /></details>}
    </div>
  );
}
