import type { ReactNode } from "react";
import { AccessContext, type AccessRole } from "@/hooks/useAccess";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";

interface AccessResponse { role?: AccessRole | null; can_audit_esg: boolean; can_view_model?: boolean; can_manage?: boolean }

// The API decides access; this only shapes the menu and pages. Every endpoint checks again.
export function AccessProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const access = useLiveData<AccessResponse>(
    auth.user ? "/v1/access?account=" + encodeURIComponent(auth.user.id) : null,
    60000,
  );
  const signedIn = !!auth.user;
  const data = signedIn ? access.data : undefined;
  return (
    <AccessContext.Provider
      value={{
        role: !signedIn ? "guest" : data?.role || "viewer",
        canAudit: data?.can_audit_esg === true,
        canViewModel: data?.can_view_model === true,
        canManage: data?.can_manage === true,
        loading: auth.isLoading || (signedIn && access.loading),
        signedIn,
        error: auth.error || access.error,
      }}
    >
      {children}
    </AccessContext.Provider>
  );
}
