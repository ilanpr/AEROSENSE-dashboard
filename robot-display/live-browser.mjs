import { spawn } from "node:child_process";

function installFaceBridge(allowed) {
  if (new URL(String(location)).origin !== allowed || window.__aerobotFaceBridge) return;
  window.__aerobotFaceBridge = true;
  const channel = new BroadcastChannel("aerosense-robot-face-v1");
  let chain = Promise.resolve();

  channel.onmessage = ({ data }) => {
    chain = chain
      .then(async () => {
        if (
          !data ||
          data.kind !== "aerosense-face" ||
          typeof data.userId !== "string" ||
          Math.abs(Date.now() - data.at) > 8000
        )
          return;

        const event = {
          action: data.action,
          text: data.text,
          emotion: data.emotion,
          userId: data.userId,
          at: data.at,
          monitorOnly: true,
        };
        if (data.audio instanceof Blob) {
          if (data.audio.size > 12000000) return;
          event.mime = data.audio.type;
          event.audioBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(data.audio);
          });
        }
        window.aerobotFaceEvent(JSON.stringify(event));
      })
      .catch(() => {});
  };
}

// The browser debugging transport is an inherited pipe, never an exposed TCP port.
export function launchLiveBrowser(
  browser,
  profile,
  faceUrl,
  onEvent,
  { chatUrl = "https://aerosense.me/aerobot", log = console.log } = {},
) {
  const allowed = new URL(chatUrl).origin;
  const child = spawn(
    browser,
    [
      `--app=${faceUrl}`,
      `--user-data-dir=${profile}`,
      "--remote-debugging-pipe",
      "--autoplay-policy=no-user-gesture-required",
      "--no-first-run",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"], windowsHide: true },
  );
  let serial = 0,
    buffer = "",
    ended = false,
    owner,
    closing = false;
  const pending = new Map(),
    attached = new Set(),
    seen = new Set();
  function command(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++serial,
        timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Browser command timed out"));
        }, 10000);
      pending.set(id, { resolve, reject, timer });
      child.stdio[3].write(
        JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0",
      );
    });
  }
  const injection = `(${installFaceBridge.toString()})(${JSON.stringify(allowed)})`;
  async function attach(info) {
    if (info.type !== "page" || !info.url.startsWith(allowed + "/") || attached.has(info.targetId))
      return;
    attached.add(info.targetId);
    try {
      const { sessionId } = await command("Target.attachToTarget", {
        targetId: info.targetId,
        flatten: true,
      });
      await command("Runtime.enable", {}, sessionId);
      await command("Page.enable", {}, sessionId);
      await command("Runtime.addBinding", { name: "aerobotFaceEvent" }, sessionId);
      await command("Page.addScriptToEvaluateOnNewDocument", { source: injection }, sessionId);
      const result = await command("Runtime.evaluate", { expression: injection }, sessionId);
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description || result.exceptionDetails.text,
        );
      log("[web] Connected to AEROSENSE chat.");
    } catch (error) {
      attached.delete(info.targetId);
      log("[web] " + error.message);
    }
  }
  async function event(message) {
    if (closing) return;
    if (message.method === "Target.targetCreated" || message.method === "Target.targetInfoChanged")
      void attach(message.params.targetInfo);
    if (
      message.sessionId &&
      ["Page.domContentEventFired", "Page.loadEventFired"].includes(message.method)
    )
      void command("Runtime.evaluate", { expression: injection }, message.sessionId).catch(
        () => {},
      );
    if (message.method !== "Runtime.bindingCalled" || message.params.name !== "aerobotFaceEvent")
      return;
    try {
      const e = JSON.parse(message.params.payload);
      if (
        !["thinking", "expression", "speak", "stop"].includes(e.action) ||
        typeof e.userId !== "string" ||
        !Number.isFinite(e.at) ||
        Math.abs(Date.now() - e.at) > 15000 ||
        (e.audioBase64?.length || 0) > 16000000
      )
        return;
      const check = await command(
        "Runtime.evaluate",
        {
          expression: "new URL(String(location)).origin",
          contextId: message.params.executionContextId,
          returnByValue: true,
        },
        message.sessionId,
      );
      if (check.result?.value !== allowed) return;
      if (owner === undefined) owner = e.userId;
      if (e.userId !== owner) return;
      const stamp = e.userId + ":" + e.at + ":" + e.action;
      if (seen.has(stamp)) return;
      seen.add(stamp);
      if (seen.size > 64) seen.delete(seen.values().next().value);
      onEvent({ ...e, text: String(e.text || "").slice(0, 8000), monitorOnly: true });
    } catch (error) {
      log("[web] Could not relay a playback event: " + error.message);
    }
  }
  child.stdio[4].on("data", (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf("\0")) >= 0) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      try {
        const m = JSON.parse(raw);
        if (m.id) {
          const p = pending.get(m.id);
          if (p) {
            clearTimeout(p.timer);
            pending.delete(m.id);
            if (m.error) p.reject(new Error(m.error.message));
            else p.resolve(m.result);
          }
        } else void event(m);
      } catch {}
    }
  });
  child.stdio[3].on("error", () => {});
  child.on("error", (error) => log("[browser] " + error.message));
  child.on("exit", () => {
    ended = true;
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Browser closed"));
    }
    pending.clear();
    log("[web] Browser closed.");
  });
  const ready = command("Target.setDiscoverTargets", { discover: true })
    .then(() => command("Target.createTarget", { url: chatUrl }))
    .catch((error) => log("[web] " + error.message));
  return {
    child,
    ready,
    command,
    close: () => {
      closing = true;
      if (!ended) {
        void command("Browser.close").catch(() => child.kill());
      }
    },
  };
}
