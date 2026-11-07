import { apiRequest } from "./api";
export interface ChatJob {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  result?: { text?: string; denied?: boolean; emotion?: string };
  error?: string;
}
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
  result(id: string, signal: AbortSignal) {
    return apiRequest<ChatJob>("/v1/jobs?id=" + encodeURIComponent(id), {
      signal,
    });
  },
};
