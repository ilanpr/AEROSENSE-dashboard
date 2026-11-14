import { lazy, Suspense } from "react";
import { DataState } from "@/components/shared/DataState";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ROUTES } from "@/lib/constants";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

const LoginPage = lazy(() =>
  import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const LandingPage = lazy(() =>
  import("@/pages/landing/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const ManagementPage = lazy(() =>
  import("@/pages/management/ManagementPage").then((m) => ({ default: m.ManagementPage })),
);
const AuthConfirmPage = lazy(() =>
  import("@/pages/auth/AuthConfirmPage").then((m) => ({ default: m.AuthConfirmPage })),
);
const RegisterPage = lazy(() =>
  import("@/pages/auth/RegisterPage").then((m) => ({
    default: m.RegisterPage,
  })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const SensorMapPage = lazy(() =>
  import("@/pages/sensor-map/SensorMapPage").then((m) => ({
    default: m.SensorMapPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import("@/pages/analytics/AnalyticsPage").then((m) => ({
    default: m.AnalyticsPage,
  })),
);
const NodeMonitoringPage = lazy(() =>
  import("@/pages/node-monitoring/NodeMonitoringPage").then((m) => ({
    default: m.NodeMonitoringPage,
  })),
);
const NodeDetailPage = lazy(() =>
  import("@/pages/node-monitoring/NodeDetailPage").then((m) => ({
    default: m.NodeDetailPage,
  })),
);
const AlertsPage = lazy(() =>
  import("@/pages/alerts/AlertsPage").then((m) => ({ default: m.AlertsPage })),
);
const ESGReportsPage = lazy(() =>
  import("@/pages/esg-reports/ESGReportsPage").then((m) => ({
    default: m.ESGReportsPage,
  })),
);
const SystemPage = lazy(() =>
  import("@/pages/system/SystemPage").then((m) => ({ default: m.SystemPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  })),
);
const EnvironmentPage = lazy(() =>
  import("@/pages/environment/EnvironmentPage").then((m) => ({
    default: m.EnvironmentPage,
  })),
);
const RobotScreenPage = lazy(() =>
  import("@/pages/robot/RobotScreenPage").then((m) => ({ default: m.RobotScreenPage })),
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<DataState loading />}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />
          <Route path={ROUTES.HOME} element={<LandingPage />} />
          <Route path="/robot-screen" element={<RobotScreenPage />} />

          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.ENVIRONMENT} element={<EnvironmentPage />} />
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.SENSOR_MAP} element={<SensorMapPage />} />
            <Route path={ROUTES.ANALYTICS} element={<AnalyticsPage />} />
            <Route path={ROUTES.NODE_MONITORING} element={<NodeMonitoringPage />} />
            <Route path={ROUTES.NODE_DETAIL} element={<NodeDetailPage />} />
            <Route path={ROUTES.ALERTS} element={<AlertsPage />} />
            <Route path={ROUTES.ESG_REPORTS} element={<ESGReportsPage />} />
            <Route path={ROUTES.AEROBOT} element={null} />
            <Route path={ROUTES.SYSTEM} element={<SystemPage />} />
            <Route path={ROUTES.MANAGEMENT} element={<ManagementPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
