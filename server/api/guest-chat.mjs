// AERO-BOT chat for visitors without an account. Only published (public_read) nodes, no voice, no robot.
// The job has no owner; the visitor reads its answer back with a one-time token whose hash sits in the job.
import { randomBytes, randomUUID } from "node:crypto";
import { cleanText, sha, equal } from "./core.mjs";

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export const publicNode = (n) => n?.public_read === true && n?.enabled === true;

export function guestChatRoutes({ one, filter, enqueue, rawBody, send, rate }) {
  const ip = (req) =>
    String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  return async (req, res, url) => {
    if (url.pathname === "/v1/guest/chat" && req.method === "POST") {
      rate("guest-chat:" + ip(req), 6);
      const p = JSON.parse(await rawBody(req, 10000));
      if (typeof p.node_id !== "string" || !p.node_id) throw fail("Pilih titik pemantauan.");
      const node = await one("ae_nodes", "id=eq." + filter(p.node_id) + "&select=id,public_read,enabled");
      if (!publicNode(node)) throw fail("Titik pemantauan ini tidak publik.", 403);
      const token = randomBytes(24).toString("hex");
      const j = await enqueue("web_chat", "guest:" + randomUUID(), {
        text: cleanText(p.text),
        node_ids: [node.id],
        voice: false,
        guest_token: sha(token),
      });
      send(res, 202, { id: j.id, status: j.status, token });
      return true;
    }
    if (url.pathname === "/v1/guest/jobs" && req.method === "GET") {
      rate("guest-jobs:" + ip(req), 120);
      const id = url.searchParams.get("id") || "";
      const token = url.searchParams.get("token") || "";
      const j = /^[0-9a-f-]{36}$/i.test(id)
        ? await one("ae_jobs", "id=eq." + filter(id) + "&kind=eq.web_chat&owner_id=is.null")
        : null;
      if (!j?.body?.guest_token || !token || !equal(sha(token), j.body.guest_token))
        throw fail("Not found", 404);
      send(res, 200, {
        id: j.id,
        status: j.status,
        result: j.result,
        error: j.status === "failed" ? "Permintaan belum dapat diproses" : null,
      });
      return true;
    }
    return false;
  };
}
