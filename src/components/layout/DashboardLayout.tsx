import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AccessProvider } from "./AccessProvider";
import { DEMO_MODE } from "@/lib/demo-mode";
import { DemoBanner } from "@/components/shared/DemoBanner";

export function DashboardLayout() {
  return (
    <AccessProvider>
      <DashboardShell />
    </AccessProvider>
  );
}
function DashboardShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Scroll to top and close mobile menu on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={`app-shell flex min-h-screen bg-[#f3f8ff] text-[#11223D] ${DEMO_MODE ? "demo-shell" : ""}`}>
      {DEMO_MODE && <DemoBanner />}
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#0f2744]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 animate-[appear_0.2s_ease_both]">
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 p-5 sm:p-8 max-w-[1760px] w-full mx-auto animate-[appear_0.32s_ease_both]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
