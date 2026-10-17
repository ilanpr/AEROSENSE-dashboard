import { SensorOverview } from "@/components/live/SensorOverview";
import { EnvironmentPage } from "@/pages/environment/EnvironmentPage";
export function DashboardPage() {
  return (
    <div className="space-y-8">
      <SensorOverview />
      <EnvironmentPage compact />
    </div>
  );
}
