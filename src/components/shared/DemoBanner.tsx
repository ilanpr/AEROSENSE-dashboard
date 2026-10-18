import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function DemoBanner() {
  const {user}=useAuth();
  return <div className="demo-banner" role="note">
    <strong>DEMO · Surabaya · 16 node</strong>
    <span>Data simulasi untuk video</span>
    <Link to="/login">{user?.app_metadata.demo_role==="admin"?"Admin demo":user?"Warga demo":"Pilih akun demo"}</Link>
  </div>;
}
