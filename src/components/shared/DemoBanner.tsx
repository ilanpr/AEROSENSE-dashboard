import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function DemoBanner() {
  const {user}=useAuth();
  return <div className="demo-banner" role="note">
    <strong>Surabaya · 16 titik pemantauan</strong>
    <span>Data simulasi · informasi wilayah dari sumber publik</span>
    <Link to="/login">{user?.app_metadata.demo_role==="admin"?"Administrator":user?.app_metadata.demo_role==="operator"?"Akun pengelola":user?"Akun warga":"Masuk"}</Link>
  </div>;
}
