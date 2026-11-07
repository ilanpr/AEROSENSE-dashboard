import { ChevronDown } from "lucide-react";
import { NearbyAlerts } from "@/components/live/NearbyAlerts";
import { WhatsAppSettings } from "@/components/live/WhatsAppSettings";
import { useAuth } from "@/hooks/useAuth";
import { WhatsAppEntry } from "@/components/live/WhatsAppEntry";
export function AlertsPage() {
  const { user } = useAuth();
  return (
    <div className="app-section-stack">
      <NearbyAlerts />
      <section className="wa-alert-entry" aria-label="AEROSENSE di WhatsApp">
        <div>
          <h2>Lanjutkan lewat WhatsApp</h2>
          <p>Langganan peringatan atau tanya AERO-BOT.</p>
        </div>
        <WhatsAppEntry />
      </section>
      {user && (
        <details className="insight-disclosure">
          <summary>
            <span>Atur langganan WhatsApp</span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <WhatsAppSettings />
        </details>
      )}
    </div>
  );
}
