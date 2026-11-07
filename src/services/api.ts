import { API_CONFIG } from "@/lib/constants";
import { getSupabase } from "./supabase";
import { DEMO_MODE } from "@/lib/demo-mode";
import { visibleSensorResponse } from "@/lib/sensor-display";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  authenticated = true,
  responseType: "json" | "blob" = "json",
): Promise<T> {
  const sensorRead =
    (!options.method || options.method === "GET") &&
    /^\/v1\/(?:public\/)?(?:dashboard|nodes|history|rules|alerts|esg\/report)(?:\?|$)/.test(endpoint);
  if (DEMO_MODE) {
    const { demoRequest } = await import("@/demo/api");
    const body = await demoRequest(endpoint, options);
    return (sensorRead
      ? visibleSensorResponse(body as Parameters<typeof visibleSensorResponse>[0])
      : body) as T;
  }
  const headers = new Headers(options.headers);
  const publicRead =
    (!options.method || options.method === "GET") &&
    /^\/v1\/(dashboard|nodes|history|rules|alerts|environment)(\?|$)/.test(endpoint);
  if (options.body) headers.set("Content-Type", "application/json");
  if (authenticated) {
    const session = await getSupabase()
      .then((client) => client.auth.getSession())
      .catch(() => null);
    if (session?.data.session && !session.error) {
      headers.set("Authorization", `Bearer ${session.data.session.access_token}`);
    } else if (publicRead) {
      endpoint = endpoint.replace("/v1/", "/v1/public/");
    } else {
      throw new Error("Masuk terlebih dahulu untuk menggunakan fitur ini.");
    }
  }
  let response: Response;
  try {
    response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("Layanan belum merespons tepat waktu. Silakan coba lagi.");
    throw error;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error || body?.message || `Layanan belum dapat diakses (${response.status}).`,
    );
  }
  if (responseType === "blob") return (await response.blob()) as T;
  const body = await response.json().catch(() => null);
  if (body === null) throw new Error("API belum mengembalikan data JSON. Periksa koneksi backend.");
  return (sensorRead ? visibleSensorResponse(body) : body) as T;
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
