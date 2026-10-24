import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/services/supabase";
import { authService } from "@/services/auth.service";
import { DEMO_MODE } from "@/lib/demo-mode";
import { getDemoUser, DEMO_AUTH_EVENT } from "@/demo/session";
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (DEMO_MODE) {
      const sync = () => { setUser(getDemoUser()); setLoading(false); };
      sync();
      window.addEventListener(DEMO_AUTH_EVENT, sync);
      return () => window.removeEventListener(DEMO_AUTH_EVENT, sync);
    }
    let active = true;
    let unsubscribe = () => {};
    getSupabase()
      .then(async (client) => {
        if (!active) return;
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          if (active) {
            setUser(session?.user ?? null);
            setLoading(false);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const session = await client.auth.getSession();
        if (active) {
          setUser(session.data.session?.user ?? null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return { user, isLoading, error, isAuthenticated: !!user, ...authService };
}
