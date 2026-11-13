import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/hooks/useAccess";
import { useLocation, useNavigate } from "react-router-dom";
import { NAV_ITEMS, ROUTES } from "@/lib/constants";
import { Menu, ChevronRight, Bell } from "lucide-react";
import type { Ref } from "react";

interface TopbarProps {
  onMenuClick: () => void;
  menuButton: Ref<HTMLButtonElement>;
  menuOpen: boolean;
}

export function Topbar({ onMenuClick, menuButton, menuOpen }: TopbarProps) {
  const { user } = useAuth();
  const { canViewModel } = useAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const currentItem = NAV_ITEMS.find((item) => item.path === location.pathname);
  const currentLabel =
    location.pathname === ROUTES.ANALYTICS && !canViewModel
      ? "Riwayat udara"
      : currentItem?.label ??
        (location.pathname.startsWith("/nodes/")
          ? "Detail sensor"
          : location.pathname === ROUTES.SYSTEM
            ? "Pengaturan"
            : "Pemantauan");

  return (
    <header className="app-topbar h-[72px] flex items-center justify-between px-6 sm:px-9 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          ref={menuButton}
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          className="md:hidden w-8 h-8 rounded-lg bg-[#e8f3ff] text-[#0870f0] grid place-items-center hover:bg-[#d9ecff] transition-colors cursor-pointer"
        >
          <Menu className="w-4 h-4 stroke-[2]" />
        </button>

        <nav
          aria-label="Lokasi halaman"
          className="flex items-center gap-2 text-[#526d88] text-xs font-semibold"
        >
          <span className="hidden sm:inline">AEROSENSE</span>
          <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-[#526d88]" />
          <strong className="text-[#25405f] font-bold">{currentLabel}</strong>
        </nav>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.ALERTS)}
          aria-label="Lihat peringatan"
          className="relative w-8 h-8 rounded-lg text-[#59718e] hover:bg-[#f0f6fc] hover:text-[#086cfb] grid place-items-center transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
        </button>

        <Link className="account-link" to={user ? ROUTES.SYSTEM : ROUTES.LOGIN}>
          {user ? "Akun saya" : "Masuk"}
          <ChevronRight size={15} />
        </Link>
      </div>
    </header>
  );
}
