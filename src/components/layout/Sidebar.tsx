import { NavLink, useNavigate } from "react-router-dom";
import { NAV_ITEMS, ROUTES } from "@/lib/constants";
import { useAccess } from "@/hooks/useAccess";
import {
  LayoutGrid,
  Map,
  LineChart,
  FileText,
  Bell,
  MessageCircle,
  Radio,
  ChevronRight,
  MoreHorizontal,
  Leaf,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Leaf,
  LayoutGrid,
  Map,
  LineChart,
  FileText,
  Bell,
  MessageCircle,
  Radio,
};

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { canAudit } = useAccess();

  return (
    <aside className="w-[242px] shrink-0 bg-white border-r border-[#e8eff8] flex flex-col h-screen sticky top-0 z-30 select-none overflow-hidden">
      {/* Brand & Workspace Header (Pinned at top) */}
      <div className="p-[20px_16px_12px] shrink-0">
        {/* Brand logo & tagline */}
        <NavLink
          to={ROUTES.DASHBOARD}
          onClick={onClose}
          className="flex items-center gap-2.5 mx-1 mb-4 text-inherit no-underline"
        >
          <span
            className="w-10 h-10 shrink-0 rounded-full bg-[#f1f7fd] shadow-[0_7px_18px_rgba(27,117,220,0.17)] bg-no-repeat bg-[length:74px_66px] bg-[-19px_-3px]"
            style={{ backgroundImage: `url('/assets/aerosense-logo.svg')` }}
            aria-hidden="true"
          />
          <div className="leading-tight">
            <span className="text-base font-black tracking-[-0.9px] text-[#59aae8]">
              AERO<span className="text-[#277afa]">SENSE</span>
              <sup className="text-[8px] font-bold text-[#59aae8] ml-0.5">
                ™
              </sup>
            </span>
            <small className="block text-[7.5px] font-semibold text-[#537496] tracking-[0.3px] uppercase mt-0.5">
              Pantau Udara, Lindungi Warga
            </small>
          </div>
        </NavLink>

        {/* Workspace Picker */}
        <div className="border border-[#e5eef8] p-2 rounded-[13px] flex items-center gap-2.5 bg-[#fbfdff] shadow-2xs">
          <span className="h-8 w-8 shrink-0 rounded-[9px] bg-[#dceeff] text-[#0674ec] grid place-items-center font-black text-xs">
            A
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[11px] text-[#1b3154] font-bold truncate">
              AEROSENSE
            </strong>
            <small className="block text-[9.5px] text-[#8b9ab0] truncate">
              Sensor dan hub lingkungan
            </small>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#9aacbf] shrink-0" />
        </div>
      </div>

      {/* Main navigation */}
      <div className="flex-1 overflow-y-auto px-3.5 py-1.5 sidebar-scroll min-h-0">
        <div>
          {/* Navigation Caption */}
          <p className="text-[9.5px] tracking-[1.6px] font-extrabold text-[#a4b1c5] mb-2 ml-2">
            RUANG KERJA
          </p>

          {/* Main Navigation */}
          <nav className="space-y-0.5">
            {NAV_ITEMS.filter(
              (item) => item.path !== ROUTES.ESG_REPORTS || canAudit,
            ).map((item) => {
              const Icon = ICON_MAP[item.icon] || LayoutGrid;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `h-10 w-full rounded-xl flex items-center gap-2.5 px-3 text-xs transition-all duration-200 ${
                      isActive
                        ? "bg-[#e7f2ff] text-[#0569ed] font-extrabold shadow-2xs"
                        : "text-[#687b95] font-semibold hover:bg-[#f2f8ff] hover:text-[#056afa] hover:translate-x-0.5"
                    }`
                  }
                >
                  <Icon className="w-[16px] h-[16px] shrink-0 stroke-[2]" />
                  <span className="truncate">{item.label}</span>

                  {item.badge && item.badgeType === "count" && (
                    <span className="ml-auto rounded-lg px-2 py-0.5 bg-[#fff0ec] text-[#ef704f] text-[9.5px] font-black">
                      {item.badge}
                    </span>
                  )}
                  {item.badge && item.badgeType === "pill" && (
                    <span className="ml-auto text-[8px] tracking-[0.5px] bg-[#e9f7ff] text-[#008bd0] px-1.5 py-0.5 rounded-md font-extrabold">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

      </div>

      {/* User profile (Pinned at bottom, never cut off) */}
      <div className="shrink-0 border-t border-[#e5eef8] p-3 px-3.5 bg-white">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-[#d9ecff] border-2 border-white text-[#0470ed] text-[10px] font-black grid place-items-center shadow-2xs shrink-0">
            AS
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[11px] text-[#1b3154] font-bold truncate">
              Tim AEROSENSE
            </strong>
            <small className="block text-[9.5px] text-[#8b9ab0] truncate">
              Pemantauan lingkungan
            </small>
          </div>
          <button
            type="button"
            onClick={() => {
              navigate(ROUTES.SYSTEM);
              onClose?.();
            }}
            title="Buka Pengaturan Sistem"
            className="p-1.5 rounded-lg text-[#8c9cb0] hover:text-[#086cfb] hover:bg-[#f2f8ff] transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
