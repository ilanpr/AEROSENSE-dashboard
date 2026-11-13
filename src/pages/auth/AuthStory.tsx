import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AeroMascot } from "@/components/environment/AeroMascot";
import { ROUTES } from "@/lib/constants";

export function AuthStory() {
  return (
    <aside className="login-story">
      <Link to={ROUTES.HOME} className="login-brand" aria-label="AEROSENSE">
        <img src="/assets/brand/aerosense-mark.png" width="38" height="38" alt="" />
        <span>AERO<strong>SENSE</strong></span>
      </Link>
      <div className="login-story-copy">
        <p>Kenali kondisi di sekitar Anda.</p>
        <Link to={ROUTES.DASHBOARD} className="guest-entry">
          Lihat pemantauan <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <AeroMascot pose="welcome" className="login-scene" />
    </aside>
  );
}
