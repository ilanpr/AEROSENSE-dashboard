/**
 * ============================================
 * AEROSENSE Dashboard — Application Constants
 * ============================================
 */

/** Application metadata */
export const APP_CONFIG = {
  name: "AEROSENSE",
  description: "Air Quality Monitoring Dashboard",
  version: "0.1.0",
} as const;

/** Route path constants for type-safe navigation */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  SENSOR_MAP: "/sensor-map",
  ANALYTICS: "/analytics",
  ESG_REPORTS: "/esg-reports",
  ALERTS: "/alerts",
  AEROBOT: "/aerobot",
  NODE_MONITORING: "/nodes",
  NODE_DETAIL: "/nodes/:id",
  SYSTEM: "/system",
  ENVIRONMENT: "/environment",
} as const;

export interface NavItemConfig {
  label: string;
  path: string;
  icon: string;
  badge?: string;
  badgeType?: "count" | "pill";
}

/** Navigation items for citizen-centric sidebar */
export const NAV_ITEMS: readonly NavItemConfig[] = [
  { label: "Hub lingkungan", path: ROUTES.ENVIRONMENT, icon: "Leaf" },
  {
    label: "Beranda",
    path: ROUTES.DASHBOARD,
    icon: "LayoutGrid",
  },
  {
    label: "Peta sensor",
    path: ROUTES.SENSOR_MAP,
    icon: "Map",
  },
  {
    label: "Analitik AI",
    path: ROUTES.ANALYTICS,
    icon: "LineChart",
  },
  {
    label: "Audit ESG",
    path: ROUTES.ESG_REPORTS,
    icon: "FileText",
  },
  {
    label: "Peringatan",
    path: ROUTES.ALERTS,
    icon: "Bell",
  },
  {
    label: "Tanya AERO-BOT",
    path: ROUTES.AEROBOT,
    icon: "MessageCircle",
    badge: "BARU",
    badgeType: "pill",
  },
  {
    label: "Monitoring node",
    path: ROUTES.NODE_MONITORING,
    icon: "Radio",
  },
] as const;

/** API configuration */
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10000,
} as const;
