import { apiRequest } from "./api";
export interface ChatJob {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  result?: { text?: string; denied?: boolean; emotion?: string };
  error?: string;
  token?: string;
}
// Visitors without an account read their answer back with the token the server gave for that question.
const guestTokens = new Map<string, string>();
export const chatService = {
  send(text: string, key: string, nodeId?: string, robotId?: string, voice = false) {
    return apiRequest<ChatJob>(robotId ? "/v1/robot/touch" : "/v1/chat", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(
        robotId
          ? { text, robot_id: robotId, voice }
          : { text, node_id: nodeId || undefined, voice },
      ),
    });
  },
  async sendGuest(text: string, nodeId: string) {
    const job = await apiRequest<ChatJob>(
      "/v1/guest/chat",
      { method: "POST", body: JSON.stringify({ text, node_id: nodeId }) },
      false,
    );
    if (job.token) guestTokens.set(job.id, job.token);
    return job;
  },
  result(id: string, signal: AbortSignal) {
    const token = guestTokens.get(id);
    return token
      ? apiRequest<ChatJob>(
          "/v1/guest/jobs?id=" + encodeURIComponent(id) + "&token=" + encodeURIComponent(token),
          { signal },
          false,
        )
      : apiRequest<ChatJob>("/v1/jobs?id=" + encodeURIComponent(id), { signal });
  },
};
