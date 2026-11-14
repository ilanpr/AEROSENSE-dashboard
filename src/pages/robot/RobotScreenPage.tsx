import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import { getSupabase } from "@/services/supabase";
import { API_CONFIG } from "@/lib/constants";
import { robotFaceDocument } from "@/lib/robot-face-document";
import { apiRequest } from "@/services/api";
import { clockOffset } from "../../../robot-display/screen/timeline.js";
import { ROBOT_SLOTS, useRobotSlot } from "@/hooks/useRobotSlot";

interface FaceWindow extends Window {
  aerobotDisplay?: {
    receive: (event: unknown) => void;
    unlockAudio: () => Promise<void>;
  };
}
const document = robotFaceDocument();

export function RobotScreenPage() {
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  const [robot, setRobot] = useRobotSlot(userId);
  const access = useLiveData<{ can_manage: boolean }>(user ? "/v1/access" : null, 60000);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const settings = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow && event.data?.type === "aerobot-settings")
        setActive(false);
    };
    const fullscreen = () => {
      if (!window.document.fullscreenElement) setActive(false);
    };
    window.addEventListener("message", settings);
    window.document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("message", settings);
      window.document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, []);
  useEffect(() => {
    const previous = window.document.title;
    window.document.title = "AERO-BOT · " + robot.replace("robot-", "Robot ");
    return () => {
      window.document.title = previous;
    };
  }, [robot]);

  useEffect(() => {
    if (!active || !userId || !access.data?.can_manage) return;
    const controller = new AbortController();
    const screen = () => (frame.current?.contentWindow as FaceWindow | null)?.aerobotDisplay;
    let reconnect: ReturnType<typeof setTimeout>;
    async function connect() {
      try {
        const sent = Date.now();
        const clock = await apiRequest<{ received_at: number; server_time: number }>(
          "/v1/robot-face/status?robot_id=" + robot,
          { signal: controller.signal },
        );
        const offset = clockOffset(sent, Date.now(), clock.received_at, clock.server_time);
        const { data, error } = await (await getSupabase()).auth.getSession();
        if (error || !data.session) throw new Error("Masuk kembali untuk menyambungkan layar.");
        const response = await fetch(
          `${API_CONFIG.baseUrl}/v1/robot-face/events?robot_id=${robot}`,
          {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body) {
          if ([401, 403].includes(response.status)) {
            setNotice("Akses layar tidak tersedia untuk akun ini.");
            return;
          }
          throw new Error("Layar belum tersambung.");
        }
        setNotice("");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const packet = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (packet.startsWith("data: ")) {
              const event = JSON.parse(packet.slice(6));
              if (Number.isFinite(event.start_at)) event.localStartAt = event.start_at - offset;
              screen()?.receive(event);
            }
          }
          if (buffer.length > 1600000) throw new Error("Paket layar terlalu besar.");
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (!controller.signal.aborted) {
        screen()?.receive({ action: "stop" });
        setNotice("Menyambungkan kembali…");
        reconnect = setTimeout(() => void connect(), 1500);
      }
    }
    void connect();
    return () => {
      controller.abort();
      clearTimeout(reconnect);
      screen()?.receive({ action: "stop" });
    };
  }, [active, userId, access.data?.can_manage, robot]);

  useEffect(() => {
    const manifest = window.document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/robot-screen.webmanifest";
    window.document.head.appendChild(manifest);
    const meta = window.document.createElement("meta");
    meta.name = "apple-mobile-web-app-capable";
    meta.content = "yes";
    window.document.head.appendChild(meta);
    const icon = window.document.createElement("link");
    icon.rel = "apple-touch-icon";
    icon.href = "/assets/brand/aerosense-touch-icon.png";
    window.document.head.appendChild(icon);
    return () => {
      manifest.remove();
      meta.remove();
      icon.remove();
    };
  }, []);

  if (isLoading || (user && access.loading)) return <p role="status">Menyiapkan layar…</p>;
  if (!user) return <Navigate to="/login?next=/robot-screen" replace />;
  if (access.error || !access.data?.can_manage)
    return <p role="alert">Layar robot hanya tersedia untuk pengelola kawasan dan admin.</p>;

  return (
    <main style={{ position: "fixed", inset: 0, background: "#edf0ff" }}>
      <iframe
        ref={frame}
        title="Wajah AERO-BOT"
        srcDoc={document}
        allow="autoplay; fullscreen"
        onLoad={() => setReady(true)}
        style={{ border: 0, width: "100%", height: "100%" }}
      />
      {!active && (
        <div className="robot-screen-controls">
          <label>
            Pilih robot
            <select value={robot} onChange={(e) => setRobot(e.target.value)}>
              {ROBOT_SLOTS.map((id, i) => (
                <option key={id} value={id}>
                  Robot {i + 1}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!ready}
            onClick={() => {
              const screen = (frame.current?.contentWindow as FaceWindow | null)?.aerobotDisplay;
              if (!screen) return;
              void window.document.documentElement.requestFullscreen?.().catch(() => {});
              void screen
                .unlockAudio()
                .then(() => setActive(true))
                .catch(() => setNotice("Ketuk kembali untuk mengaktifkan wajah."));
            }}
            className="login-submit"
          >
            Aktifkan wajah
          </button>
        </div>
      )}
      {notice && (
        <p
          role="status"
          style={{
            position: "absolute",
            bottom: 12,
            left: 16,
            right: 16,
            textAlign: "center",
            color: "#234763",
          }}
        >
          {notice}
        </p>
      )}
    </main>
  );
}
