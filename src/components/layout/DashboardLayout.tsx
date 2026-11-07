import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AccessProvider } from "./AccessProvider";
import { DEMO_MODE } from "@/lib/demo-mode";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { X } from "lucide-react";
const AeroBotPage = lazy(() =>
  import("@/pages/aerobot/AeroBotPage").then((m) => ({ default: m.AeroBotPage })),
);

export function DashboardLayout() {
  return (
    <AccessProvider>
      <DashboardShell />
    </AccessProvider>
  );
}
function DashboardShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenu = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const onChat = location.pathname === "/aerobot";
  const [chatVisited, setChatVisited] = useState(onChat);
  useEffect(() => {
    if (onChat) setChatVisited(true);
  }, [onChat]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setMobileMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const dialog = mobileMenu.current;
    if (!dialog) return;
    if (!mobileMenuOpen) {
      if (dialog.open) {
        dialog.close();
        if (menuButton.current?.getClientRects().length) menuButton.current.focus();
      }
      return;
    }

    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileMenuOpen(false);
    };
    if (!dialog.open) dialog.showModal();
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [mobileMenuOpen]);

  return (
    <div
      className={`app-shell flex min-h-screen bg-[#f3f8ff] text-[#11223D] ${DEMO_MODE ? "demo-shell" : ""}`}
    >
      {DEMO_MODE && <DemoBanner />}

      <div className="hidden md:block">
        <Sidebar />
      </div>

      <dialog
        id="mobile-navigation"
        ref={mobileMenu}
        aria-label="Menu navigasi"
        className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent backdrop:bg-transparent"
        onCancel={(event) => {
          event.preventDefault();
          setMobileMenuOpen(false);
        }}
      >
        <div
          className="fixed inset-0 bg-[#0f2744]/40 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
        <div className="relative w-fit">
          <button
            type="button"
            aria-label="Tutup menu navigasi"
            className="absolute left-full top-4 z-40 ml-2 grid size-11 place-items-center rounded-xl bg-white text-[#25405f]"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <Sidebar onClose={() => setMobileMenuOpen(false)} />
        </div>
      </dialog>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          menuButton={menuButton}
          menuOpen={mobileMenuOpen}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 xl:p-8 max-w-[1760px] w-full mx-auto animate-[appear_0.32s_ease_both]">
          {chatVisited && (
            <div hidden={!onChat}>
              <Suspense fallback={null}>
                <AeroBotPage />
              </Suspense>
            </div>
          )}
          {!onChat && <Outlet />}
        </main>
      </div>
    </div>
  );
}
