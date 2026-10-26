import type { User } from "@supabase/supabase-js";

export const DEMO_ACCOUNTS = [
  { role: "viewer", label: "Warga", email: "warga@demo.aerosense.test", password: "WargaDemo2026!" },
  { role: "operator", label: "Pengelola", email: "pengelola@demo.aerosense.test", password: "PengelolaDemo2026!" },
  { role: "admin", label: "Admin", email: "admin@demo.aerosense.test", password: "AdminDemo2026!" },
] as const;
const key = "aerosense-film-demo-account";
export const DEMO_AUTH_EVENT = "aerosense-demo-auth";
export function demoUser(role: string): User {
  const account = DEMO_ACCOUNTS.find(a => a.role === role);
  if (!account) throw new Error("Akun demo tidak dikenal.");
  return {
    id: account.role === "admin" ? "demo-admin" : account.role === "operator" ? "demo-operator" : "demo-warga",
    aud: "authenticated", role: "authenticated", email: account.email,
    created_at: "2026-10-18T00:00:00Z",
    app_metadata: { demo_role: account.role }, user_metadata: { name: `${account.label} Demo` },
  };
}
export function getDemoUser(): User | null {
  if (typeof window === "undefined") return null;
  const role = window.sessionStorage.getItem(key);
  return role && DEMO_ACCOUNTS.some(a => a.role === role) ? demoUser(role) : null;
}
export function authenticateDemo(email: string, password: string) {
  const account = DEMO_ACCOUNTS.find(a => a.email === email.trim().toLowerCase() && a.password === password);
  if (!account) throw new Error("Gunakan email dan kata sandi akun demo yang tersedia.");
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(key, account.role);
    window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
  }
  return demoUser(account.role);
}
export function logoutDemo() {
  window.sessionStorage.removeItem(key);
  window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
}
