import { SensorOverview } from "@/components/live/SensorOverview";
import { EnvironmentPage } from "@/pages/environment/EnvironmentPage";
export function DashboardPage() {
  return (
    <div className="app-section-stack">
      <SensorOverview />
      <EnvironmentPage compact />
    </div>
  );
}
