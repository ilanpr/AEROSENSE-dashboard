import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { API_CONFIG } from "@/lib/constants";

export interface PublicConfig {
  supabase_url: string;
  supabase_publishable_key: string;
  robot_id: string | null;
}
let configPromise: Promise<PublicConfig> | undefined;
let client: Promise<SupabaseClient> | undefined;
export function publicConfig() {
  if (!configPromise)
    configPromise = fetch(`${API_CONFIG.baseUrl}/v1/config`, {
      signal: AbortSignal.timeout(15000),
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Backend belum terhubung. Periksa alamat API dan proxy server.",
          );
        const config = (await r.json()) as PublicConfig;
        if (!config?.supabase_url || !config.supabase_publishable_key)
          throw new Error("Konfigurasi login belum tersedia.");
        return config;
      })
      .catch((error) => {
        configPromise = undefined;
        throw error;
      });
  return configPromise;
}
export function getSupabase() {
  if (!client)
    client = publicConfig()
      .then((c) => createClient(c.supabase_url, c.supabase_publishable_key))
      .catch((error) => {
        client = undefined;
        throw error;
      });
  return client;
}
