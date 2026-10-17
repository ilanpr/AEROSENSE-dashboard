import type { ReactNode } from "react";
import { AccessContext } from "@/hooks/useAccess";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
export function AccessProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const access = useLiveData<{ can_audit_esg: boolean }>(
    auth.user ? "/v1/access?account=" + encodeURIComponent(auth.user.id) : null,
    60000,
  );
  return (
    <AccessContext.Provider
      value={{
        canAudit: !!auth.user && access.data?.can_audit_esg === true,
        loading: auth.isLoading || (!!auth.user && access.loading),
        signedIn: !!auth.user,
        error: auth.error || access.error,
      }}
    >
      {children}
    </AccessContext.Provider>
  );
}
