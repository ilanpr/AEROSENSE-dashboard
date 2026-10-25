import { NavLink } from "react-router-dom";
import { NAV_ITEMS, ROUTES } from "@/lib/constants";
import { ROLE_LABELS, useAccess } from "@/hooks/useAccess";
import { useAuth } from "@/hooks/useAuth";
import { LayoutGrid, Map, LineChart, FileText, Bell, MessageCircle, Radio, Leaf, ArrowUpRight, Settings, UserRound } from "lucide-react";
const ICONS: Record<string, React.ElementType> = { LayoutGrid, Map, LineChart, FileText, Bell, MessageCircle, Radio, Leaf };

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { canAudit, canViewModel, role } = useAccess();
  const { user } = useAuth();
  return <aside className="app-sidebar">
    <NavLink to={ROUTES.DASHBOARD} onClick={onClose} className="app-brand" aria-label="AEROSENSE — Beranda">
      <img className="brand-emblem" src="/assets/brand/aerosense-mark.png" width="38" height="38" alt="" />
      <span>AERO<strong>SENSE</strong><small>Pantau lingkungan sekitar.</small></span>
    </NavLink>
    <div className="sidebar-intro"><span className="sidebar-signal" /><span>Pemantauan lingkungan</span></div>
    <nav className="app-navigation" aria-label="Navigasi utama">
      {NAV_ITEMS.filter(item => item.path !== ROUTES.ESG_REPORTS || canAudit).map(item => {
        const Icon = ICONS[item.icon] || LayoutGrid;
        // Guests and warga see a simple history; operators, admins and auditors also see the model.
        const label = item.path === ROUTES.ANALYTICS && !canViewModel ? "Riwayat udara" : item.label;
        return <NavLink key={item.path} to={item.path} onClick={onClose} className={({isActive}) => isActive ? "nav-entry active" : "nav-entry"}>
          <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
        </NavLink>;
      })}
    </nav>
    <div className="sidebar-account">
      <span className="account-avatar"><UserRound size={20} /></span>
      <div><strong>{ROLE_LABELS[role]}</strong><small>{user ? user.email : "Akses pemantauan publik"}</small></div>
      <NavLink to={user ? ROUTES.SYSTEM : ROUTES.LOGIN} onClick={onClose} aria-label={user ? "Pengaturan akun" : "Masuk"} className="account-action">
        {user ? <Settings size={18} /> : <ArrowUpRight size={18} />}
      </NavLink>
    </div>
  </aside>;
}
