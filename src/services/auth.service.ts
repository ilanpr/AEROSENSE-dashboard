import { getSupabase } from "./supabase";
import { DEMO_MODE } from "@/lib/demo-mode";
export interface SignUpProfile {
  organization?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  requested_role?: "operator" | "auditor" | "admin";
  note?: string;
}
// Supabase answers in English; users read Indonesian.
export function authMessage(message: string) {
  if (/email not confirmed/i.test(message)) return "Email belum dikonfirmasi. Buka tautan konfirmasi di email Anda.";
  if (/invalid login credentials/i.test(message)) return "Email atau kata sandi salah.";
  if (/already registered|already been registered/i.test(message)) return "Email ini sudah terdaftar. Silakan masuk.";
  if (/password should be at least/i.test(message)) return "Kata sandi minimal 8 karakter.";
  if (/rate limit|too many/i.test(message)) return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
  return message;
}
export const authService = {
  async login(email: string, password: string) {
    if (DEMO_MODE) {
      (await import("@/demo/session")).authenticateDemo(email, password);
      return;
    }
    const { error } = await (await getSupabase()).auth.signInWithPassword({ email, password });
    if (error) throw new Error(authMessage(error.message));
  },
  // The profile rides in user_metadata until the first signed-in visit, when the API stores it (GET /v1/me).
  async register(name: string, email: string, password: string, profile: SignUpProfile = {}) {
    if (DEMO_MODE) throw new Error("Gunakan akun warga atau admin demo yang disediakan.");
    const { data, error } = await (await getSupabase()).auth.signUp({
      email,
      password,
      options: {
        data: { name, profile },
        emailRedirectTo: window.location.origin + "/auth/confirm",
      },
    });
    if (error) throw new Error(authMessage(error.message));
    return !!data.session;
  },
  async logout() {
    if (DEMO_MODE) return (await import("@/demo/session")).logoutDemo();
    const { error } = await (await getSupabase()).auth.signOut();
    if (error) throw error;
  },
};
