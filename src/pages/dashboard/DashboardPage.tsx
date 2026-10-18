import { SensorOverview } from "@/components/live/SensorOverview";
import { EnvironmentPage } from "@/pages/environment/EnvironmentPage";
import { MonitoringScope } from "@/components/live/MonitoringScope";
export function DashboardPage() {
  return (
    <div className="space-y-8">
      <SensorOverview />
      <EnvironmentPage compact />
      <MonitoringScope />
    </div>
  );
}
