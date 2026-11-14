import { NavLink } from "react-router-dom";
import { NAV_ITEMS, ROUTES } from "@/lib/constants";
import { ROLE_LABELS, useAccess } from "@/hooks/useAccess";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutGrid,
  Map,
  LineChart,
  FileText,
  Bell,
  MessageCircle,
  Radio,
  Leaf,
  ArrowUpRight,
  Settings,
  Settings2,
  UserRound,
} from "lucide-react";
const ICONS: Record<string, React.ElementType> = {
  LayoutGrid,
  Map,
  LineChart,
  FileText,
  Bell,
  MessageCircle,
  Radio,
  Leaf,
  Settings2,
};

const groups = [
  {
    label: "Pantau",
    paths: [ROUTES.DASHBOARD, ROUTES.ENVIRONMENT, ROUTES.SENSOR_MAP, ROUTES.ALERTS],
  },
  {
    label: "Jelajahi",
    paths: [ROUTES.ANALYTICS, ROUTES.AEROBOT],
  },
  {
    label: "Perangkat & laporan",
    paths: [ROUTES.NODE_MONITORING, ROUTES.MANAGEMENT, ROUTES.ESG_REPORTS],
  },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { canAudit, canViewModel, canManage, role } = useAccess();
  const { user } = useAuth();
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (item.path !== ROUTES.ESG_REPORTS || canAudit) &&
      (item.path !== ROUTES.MANAGEMENT || canManage),
  );
  return (
    <aside className="app-sidebar">
      <NavLink
        to={ROUTES.DASHBOARD}
        onClick={onClose}
        className="app-brand"
        aria-label="AEROSENSE — Beranda"
      >
        <img
          className="brand-emblem"
          src="/assets/brand/aerosense-mark.png"
          width="38"
          height="38"
          alt=""
        />
        <span>
          AERO<strong>SENSE</strong>
          <small>Pantau lingkungan sekitar.</small>
        </span>
      </NavLink>
      <nav className="app-navigation" aria-label="Navigasi utama">
        {groups.map(({ label, paths }) => {
          const items = paths.flatMap((path) => visibleItems.filter((item) => item.path === path));
          if (!items.length) return null;
          return (
            <div className="nav-group" role="group" aria-label={label} key={label}>
              <p>{label}</p>
              {items.map((item) => {
                const Icon = ICONS[item.icon] || LayoutGrid;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => (isActive ? "nav-entry active" : "nav-entry")}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span>{item.path === ROUTES.ANALYTICS && !canViewModel ? "Riwayat udara" : item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-account">
        <span className="account-avatar">
          <UserRound size={20} />
        </span>
        <div>
          <strong>{ROLE_LABELS[role]}</strong>
          <small>{user ? user.email : "Akses pemantauan publik"}</small>
        </div>
        <NavLink
          to={user ? ROUTES.SYSTEM : ROUTES.LOGIN}
          onClick={onClose}
          aria-label={user ? "Pengaturan akun" : "Masuk"}
          className="account-action"
        >
          {user ? <Settings size={18} /> : <ArrowUpRight size={18} />}
        </NavLink>
      </div>
    </aside>
  );
}
