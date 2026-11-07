import { apiRequest } from "@/services/api";
import { clockOffset, envelopeFor } from "../../robot-display/screen/timeline.js";

let channel: BroadcastChannel | undefined;
let cloudOwner: string | undefined;
let cloudRobot = "robot-1";
let cloudConnected = false;
let checkedAt = 0;
let queue = Promise.resolve();

export function configureRobotFace(
  userId: string | undefined,
  enabled: boolean,
  robot = "robot-1",
) {
  cloudOwner = enabled ? userId : undefined;
  cloudRobot = robot;
  cloudConnected = false;
  checkedAt = 0;
}
export function publishRobotFace(
  userId: string | undefined,
  event: {
    action: "speak" | "stop" | "thinking" | "expression";
    text?: string;
    audio?: Blob;
    emotion?: string;
  },
  remote = true,
) {
  if (!userId) return;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel ??= new BroadcastChannel("aerosense-robot-face-v1");
      channel.postMessage({
        ...event,
        userId,
        at: Date.now(),
        kind: "aerosense-face",
        monitorOnly: true,
      });
    }
  } catch {
    /* An unavailable companion window must never interrupt chat or speech. */
  }
  if (cloudOwner !== userId || !remote) return;
  const robot = cloudRobot;
  queue = queue
    .then(async () => {
      if (cloudOwner !== userId || cloudRobot !== robot) return;
      if (Date.now() - checkedAt > 5000) {
        const status = await apiRequest<{ connected: boolean }>(
          "/v1/robot-face/status?robot_id=" + robot,
          { signal: AbortSignal.timeout(1500) },
        );
        cloudConnected = status.connected;
        checkedAt = Date.now();
      }
      if (!cloudConnected || cloudOwner !== userId) return;
      let audioBase64: string | undefined;
      if (event.audio) {
        if (event.audio.size > 1048576) return;
        audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(event.audio!);
        });
      }
      if (cloudOwner !== userId) return;
      await apiRequest("/v1/robot-face/events?robot_id=" + robot, {
        method: "POST",
        signal: AbortSignal.timeout(1500),
        body: JSON.stringify({
          owner_id: userId,
          action: event.action,
          text: event.text,
          emotion: event.emotion,
          audioBase64,
        }),
      });
    })
    .catch(() => {});
}

export async function prepareRobotFaceSpeech(
  userId: string | undefined,
  blob: Blob,
  text: string,
  signal: AbortSignal,
  emotion?: string,
) {
  if (!userId || cloudOwner !== userId) return;
  const robot = cloudRobot;
  let timer: ReturnType<typeof setTimeout>;
  const ready = await Promise.race([
    queue.then(() => true),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), 1500);
    }),
  ]);
  clearTimeout(timer!);
  if (!ready) return;
  if (signal.aborted || cloudOwner !== userId || robot !== cloudRobot) return;
  const statusRequest =
    Date.now() - checkedAt < 5000
      ? Promise.resolve({ connected: cloudConnected })
      : apiRequest<{ connected: boolean }>("/v1/robot-face/status?robot_id=" + robot, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]),
        }).catch(() => null);
  let buffer: AudioBuffer;
  try {
    const context = new OfflineAudioContext(1, 1, 24000);
    const [status, decoded] = await Promise.all([
      statusRequest,
      blob.arrayBuffer().then((data) => context.decodeAudioData(data)),
    ]);
    if (!status?.connected || cloudOwner !== userId || robot !== cloudRobot) return;
    cloudConnected = status.connected;
    checkedAt = Date.now();
    buffer = decoded;
  } catch {
    return;
  }
  if (signal.aborted) return;
  const envelope = envelopeFor(buffer.getChannelData(0), buffer.sampleRate);
  const sent = Date.now();
  const timing = await apiRequest<{
    screens: number;
    start_at?: number;
    received_at: number;
    server_time: number;
  }>("/v1/robot-face/events?robot_id=" + robot, {
    method: "POST",
    body: JSON.stringify({ owner_id: userId, action: "speak", text, envelope, emotion }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]),
  }).catch(() => null);
  const received = Date.now();
  if (!timing?.screens || !timing.start_at || signal.aborted) return;
  const offset = clockOffset(sent, received, timing.received_at, timing.server_time);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(done, Math.max(0, timing.start_at! - offset - Date.now()));
    function done() {
      signal.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Playback cancelled", "AbortError"));
    }
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
