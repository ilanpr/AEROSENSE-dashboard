import { API_CONFIG } from "@/lib/constants";
import { getSupabase } from "./supabase";
import { DEMO_MODE } from "@/lib/demo-mode";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authenticated = true,
  responseType: "json" | "blob" = "json",
): Promise<T> {
  if (DEMO_MODE) {
    const { demoRequest } = await import("@/demo/api");
    return await demoRequest(endpoint, options) as T;
  }
  const headers = new Headers(options.headers);
  const publicRead = (!options.method || options.method === "GET") &&
    /^\/v1\/(dashboard|nodes|history|rules|alerts|environment)(\?|$)/.test(endpoint);
  if (options.body) headers.set("Content-Type", "application/json");
  if (authenticated) {
    const session = await getSupabase().then(client => client.auth.getSession()).catch(() => null);
    if (session?.data.session && !session.error) {
      headers.set("Authorization", `Bearer ${session.data.session.access_token}`);
    } else if (publicRead) {
      endpoint = endpoint.replace("/v1/", "/v1/public/");
    } else {
      throw new Error(
        "Masuk terlebih dahulu untuk menggunakan fitur ini.",
      );
    }
  }
  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error ||
        body?.message ||
        `Layanan belum dapat diakses (${response.status}).`,
    );
  }
  if (responseType === "blob") return await response.blob() as T;
  const body = await response.json().catch(() => null);
  if (body === null) throw new Error("API belum mengembalikan data JSON. Periksa koneksi backend.");
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
