import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { NAV_ITEMS, ROUTES } from "@/lib/constants";
import { Menu, ChevronRight, Bell } from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Find active nav item or fallback label
  const currentItem = NAV_ITEMS.find((item) => item.path === location.pathname);
  const currentLabel = currentItem
    ? currentItem.label
    : location.pathname.startsWith("/nodes/")
      ? "Detail node"
      : location.pathname === ROUTES.SYSTEM
        ? "Pengaturan"
        : "Workspace";

  return (
    <header className="app-topbar h-[72px] bg-white/90 border-b border-[#e9f0f8] flex items-center justify-between px-6 sm:px-9 sticky top-0 z-20 backdrop-blur-md">
      {/* Left: Mobile hamburger & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
          className="md:hidden w-8 h-8 rounded-lg bg-[#e8f3ff] text-[#0870f0] grid place-items-center hover:bg-[#d9ecff] transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4 stroke-[2]" />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-[#97a7bb] text-xs font-semibold"
        >
          <span className="hidden sm:inline">AEROSENSE</span>
          <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-[#97a7bb]" />
          <strong className="text-[#25405f] font-bold">{currentLabel}</strong>
        </nav>
      </div>

      {/* Right: Actions & Badges */}
      <div className="flex items-center gap-3 sm:gap-4">

        {/* Quick alerts button with notification indicator */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.ALERTS)}
          aria-label="Lihat peringatan"
          className="relative w-8 h-8 rounded-lg text-[#59718e] hover:bg-[#f0f6fc] hover:text-[#086cfb] grid place-items-center transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
        </button>

        <Link className="account-link" to={user ? ROUTES.SYSTEM : ROUTES.LOGIN}>
          {user ? "Akun saya" : "Masuk"}<ChevronRight size={15} />
        </Link>
      </div>
    </header>
  );
}
