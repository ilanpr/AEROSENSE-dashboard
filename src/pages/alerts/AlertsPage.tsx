import { NearbyAlerts } from "@/components/live/NearbyAlerts";
import { WhatsAppSettings } from "@/components/live/WhatsAppSettings";
import { useAuth } from "@/hooks/useAuth";
export function AlertsPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <NearbyAlerts />
      {user && <details className="insight-disclosure"><summary>Atur langganan WhatsApp</summary><WhatsAppSettings /></details>}
    </div>
  );
}
