import { API_CONFIG } from "@/lib/constants";
import { getSupabase } from "./supabase";
import { DEMO_MODE } from "@/lib/demo-mode";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  if (DEMO_MODE) {
    const { demoRequest } = await import("@/demo/api");
    return await demoRequest(endpoint, options) as T;
  }
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (authenticated) {
    const { data, error } = await (await getSupabase()).auth.getSession();
    if (error || !data.session)
      throw new Error(
        "Masuk terlebih dahulu untuk mengakses data sensor dan AERO-BOT.",
      );
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.error ||
        body?.message ||
        `Layanan belum dapat diakses (${response.status}).`,
    );
  return body as T;
}
export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, data: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    apiRequest<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};
