import { getSupabase } from "./supabase";
import { DEMO_MODE } from "@/lib/demo-mode";
export const authService = {
  async login(email: string, password: string) {
    if (DEMO_MODE) {
      (await import("@/demo/session")).authenticateDemo(email,password);
      return;
    }
    const { error } = await (
      await getSupabase()
    ).auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async register(name: string, email: string, password: string) {
    if (DEMO_MODE) throw new Error("Gunakan akun warga atau admin demo yang disediakan.");
    const { data, error } = await (
      await getSupabase()
    ).auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw error;
    return !!data.session;
  },
  async logout() {
    if (DEMO_MODE) return (await import("@/demo/session")).logoutDemo();
    const { error } = await (await getSupabase()).auth.signOut();
    if (error) throw error;
  },
};
