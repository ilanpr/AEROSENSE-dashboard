import { createContext, useContext } from "react";

export type AccessRole = "guest" | "viewer" | "operator" | "auditor" | "admin";

export const AccessContext = createContext({
  role: "guest" as AccessRole,
  canAudit: false,      // ESG report: admin, auditor
  canViewModel: false,  // raw inputs, GRU details, history export: operator, admin, auditor
  canManage: false,     // thresholds, alert review, robot settings: operator, admin
  loading: true,
  signedIn: false,
  error: "",
});
export const useAccess = () => useContext(AccessContext);

export const ROLE_LABELS: Record<AccessRole, string> = {
  guest: "Tamu",
  viewer: "Warga",
  operator: "Pengelola kawasan",
  auditor: "Auditor",
  admin: "Admin",
};
