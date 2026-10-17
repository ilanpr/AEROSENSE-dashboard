import { createContext, useContext } from "react";

export const AccessContext = createContext({
  canAudit: false,
  loading: true,
  signedIn: false,
  error: "",
});
export const useAccess = () => useContext(AccessContext);
