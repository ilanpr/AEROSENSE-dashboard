import { SensorWorkspace } from "@/components/live/SensorWorkspace";
import { useAccess } from "@/hooks/useAccess";
import { DataState } from "@/components/shared/DataState";
import { Link, Navigate } from "react-router-dom";
export function ESGReportsPage() {
  const access = useAccess();
  if (access.loading) return <DataState loading />;
  if (!access.signedIn) return <Navigate to="/login" replace />;
  if (!access.canAudit)
    return (
      <section>
        <DataState
          error={
            access.error || "Laporan lingkungan hanya tersedia untuk admin lokasi."
          }
        />
        <Link to="/dashboard" className="live-button secondary">
          Kembali ke beranda
        </Link>
      </section>
    );
  return <SensorWorkspace mode="report" />;
}
