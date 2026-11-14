import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  CloudRain,
  CloudSun,
  Ear,
  Footprints,
  Leaf,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  RefreshCw,
  Square,
  Volume2,
} from "lucide-react";
import { chatService } from "@/services/chat.service";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import type { LiveNode } from "@/types/live.types";
import { useChatVoice } from "@/hooks/useChatVoice";
import { useHandsFreeVoice } from "@/hooks/useHandsFreeVoice";
import type { HandsFreePhase } from "@/lib/handsfree-engine";
import { DEMO_MODE } from "@/lib/demo-mode";
import { configureRobotFace, publishRobotFace } from "@/lib/robot-face-bus";
import { useAccess } from "@/hooks/useAccess";
import { ROBOT_SLOTS, useRobotSlot } from "@/hooks/useRobotSlot";
import { detectWakePhrase } from "@/lib/handsfree";
import { startProcessingSound } from "@/lib/processing-sound";
import { distanceKm, distanceLabel, validPoint, type GeoPoint } from "@/lib/nearby-nodes";
import { WhatsAppEntry } from "@/components/live/WhatsAppEntry";

const CHAT_LOCATION_RADIUS_KM = 5;

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  emotion?: string;
}
const handsFreeLabels: Record<HandsFreePhase, [string, string]> = {
  off: ["Mode suara mati", "Aktifkan untuk bertanya tanpa menekan tombol."],
  starting: ["Menyiapkan mode suara…", "Izinkan mikrofon jika browser meminta."],
  blocked: [
    "Ketuk layar atau tekan tombol apa saja",
    "Browser perlu satu sentuhan untuk menyalakan suara.",
  ],
  waiting: ["Ucapkan “Halo AERO-BOT”", "Lalu langsung sampaikan pertanyaan Anda."],
  listening: ["Mendengarkan…", "Silakan bicara. Pertanyaan terkirim otomatis saat Anda berhenti."],
  transcribing: ["Menyalin suara…", "AERO-BOT sedang memahami pertanyaan Anda."],
  thinking: ["Menyiapkan jawaban…", "AERO-BOT sedang memproses pertanyaan Anda."],
  speaking: ["Membacakan jawaban", "Tekan Esc atau tombol Hentikan suara untuk berhenti."],
};
const suggestions = [
  { icon: CloudSun, text: "Bagaimana cuaca di sekitarku hari ini?" },
  { icon: CloudRain, text: "Apakah nanti akan hujan?" },
  { icon: Footprints, text: "Aman tidak olahraga di luar sekarang?" },
  { icon: Leaf, text: "Bagaimana cara mengurangi polusi?" },
];
export function ChatPanel() {
  const { user, isLoading, error: authError } = useAuth();
  const userId = user?.id;
  const [slot, setSlot] = useRobotSlot(userId);
  const onChat = useLocation().pathname === "/aerobot";
  const { canManage } = useAccess();
  useEffect(() => {
    configureRobotFace(userId, canManage, slot);
    return () => configureRobotFace(undefined, false);
  }, [userId, canManage, slot]);
  const [params] = useSearchParams();
  const [robotParam, setRobotId] = useState<string | undefined>(
    params.get("robot_id") || undefined,
  );
  useEffect(() => {
    if (onChat) setRobotId(params.get("robot_id") || undefined);
  }, [onChat, params]);
  // Visitors without an account chat about published nodes only; robots and voice need an account.
  const robotId = user ? robotParam : undefined;
  const viewer = userId ?? "guest";
  const nodes = useLiveData<{ nodes: LiveNode[] }>(
    isLoading ? null : user ? "/v1/dashboard" : "/v1/dashboard?guest=1",
    60000,
  );
  const [nodeId, setNodeId] = useState("");
  const [devicePoint, setDevicePoint] = useState<{ owner: string; point: GeoPoint } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "unavailable">("idle");
  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationStatus(validPoint(coords) ? "idle" : "unavailable");
        if (validPoint(coords)) {
          setDevicePoint({
            owner: viewer,
            point: { latitude: coords.latitude, longitude: coords.longitude },
          });
          setNodeId("");
        }
      },
      () => setLocationStatus("unavailable"),
      { timeout: 10000, maximumAge: 60000 },
    );
  }, [viewer]);
  useEffect(() => {
    if (!onChat || robotId || !navigator.permissions || !navigator.geolocation) return;
    let active = true;
    void navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (active && permission.state === "granted") locate();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, onChat, robotId, locate]);
  const availableNodes = nodes.data?.nodes || [];
  const point = devicePoint?.owner === viewer ? devicePoint?.point : undefined;
  const nearest =
    point &&
    availableNodes
      .filter(validPoint)
      .map((node) => ({ node, distance: distanceKm(point, node) }))
      .filter(({ distance }) => distance <= CHAT_LOCATION_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance)[0];
  const manual = availableNodes.find((node) => node.id === nodeId);
  const contextNode =
    manual || (point ? nearest?.node : availableNodes.length === 1 ? availableNodes[0] : undefined);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Halo! Ada yang ingin ditanyakan soal lingkungan?",
    },
  ]);
  const [input, setInput] = useState(params.get("question") || "");
  useEffect(() => {
    if (onChat && params.get("question")) setInput(params.get("question")!);
  }, [onChat, params]);
  const voiceJobs = useRef(new Map<string, "manual" | "handsfree">());
  const sendRef = useRef<(text: string, fromVoice?: boolean) => Promise<string | null>>(
    async () => null,
  );
  const voice = useChatVoice(userId, (text) => {
    const wake = detectWakePhrase(text, true);
    if (!wake.matched || !wake.remainder.trim()) {
      setError("Awali pertanyaan suara dengan Halo AERO-BOT.");
      return;
    }
    void sendRef.current(wake.remainder, true).then((id) => {
      if (id) voiceJobs.current.set(id, "manual");
      else setInput(text);
    });
  });
  const handsFree = useHandsFreeVoice({
    userId,
    available: voice.configured && !DEMO_MODE,
    onQuestion: async (text) => {
      const id = await sendRef.current(text, true);
      if (id) voiceJobs.current.set(id, "handsfree");
      return !!id;
    },
  });
  const handsFreeControls = handsFree.controls;
  const voiceSpeak = useRef(voice.speak);
  voiceSpeak.current = voice.speak;
  const voiceStop = useRef(voice.stopSpeaker);
  voiceStop.current = voice.stopSpeaker;
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if ((busy || voice.preparingSpeech) && !handsFree.active) return startProcessingSound();
  }, [busy, voice.preparingSpeech, handsFree.active]);
  const [error, setError] = useState("");
  const [pollRun, setPollRun] = useState(0);
  const sending = useRef(false);
  const submission = useRef<{ scope: string; key: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const owner = useRef<string | undefined>(undefined);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (owner.current !== user?.id) {
      setMessages([
        {
          id: "welcome",
          sender: "bot",
          text: "Halo! Ada yang ingin ditanyakan soal lingkungan?",
        },
      ]);
      setPending(null);
      setBusy(false);
      setError("");
      setNodeId("");
      setDevicePoint(null);
      setLocationStatus("idle");
      owner.current = user?.id;
    }
  }, [user?.id]);
  useEffect(() => {
    if (onChat) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy, onChat]);
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    setBusy(true);
    setError("");
    async function poll() {
      try {
        const job = await chatService.result(pending!, controller.signal);
        if (controller.signal.aborted) return;
        const spoken = voiceJobs.current.get(job.id);
        if (job.status === "done") {
          if (!job.result?.text) throw new Error("Jawaban belum tersedia. Coba cek lagi sebentar.");
          setMessages((prev) =>
            prev.some((m) => m.id === job.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: job.id,
                    sender: "bot",
                    text: job.result!.text!,
                    emotion: job.result!.emotion,
                  },
                ],
          );
          setPending(null);
          setBusy(false);
          publishRobotFace(userId, {
            action: "expression",
            text: job.result.text,
            emotion: job.result.emotion,
          });
          if (spoken) {
            voiceJobs.current.delete(job.id);
            if (spoken === "handsfree")
              void handsFreeControls.speakAnswer(job.id, job.result!.text!, job.result!.emotion);
            else void voiceSpeak.current(job.id, job.result!.text!, job.result!.emotion);
          }
          return;
        }
        if (job.status === "failed") {
          setPending(null);
          if (spoken === "handsfree") {
            voiceJobs.current.delete(job.id);
            void handsFreeControls.announce(
              "Maaf, pertanyaan belum dapat dijawab. Silakan coba lagi.",
            );
          }
          throw new Error(
            job.error || "Permintaan gagal diproses. Silakan kirim ulang pertanyaan.",
          );
        }
        if (Date.now() - started > 120000) {
          if (spoken === "handsfree")
            void handsFreeControls.announce(
              "Jawaban masih diproses. Silakan tanyakan lagi sebentar lagi.",
            );
          throw new Error(
            "Jawaban masih diproses. Tekan Cek jawaban untuk melanjutkan tanpa mengirim pertanyaan baru.",
          );
        }
        // Check often: an answer ready on the server should appear at once, typed or spoken.
        timer = setTimeout(poll, 700);
      } catch (e) {
        if (!controller.signal.aborted) {
          setBusy(false);
          setError(e instanceof Error ? e.message : "Koneksi terputus. Cek jawaban lagi.");
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pending, userId, pollRun, handsFreeControls]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      handsFreeControls.stopSpeaking();
      voiceStop.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handsFreeControls]);
  async function send(text = input, fromVoice = false): Promise<string | null> {
    // A guest question needs a published node; without a location, use the first one.
    const targetNode = robotId
      ? undefined
      : (contextNode?.id ?? (user ? undefined : availableNodes[0]?.id));
    if (!text.trim() || sending.current || pending || isLoading) return null;
    if (!user && !targetNode) {
      setError("Belum ada titik pemantauan publik untuk dijadikan acuan.");
      return null;
    }
    if (!fromVoice && (voice.recording || voice.transcribing)) return null;
    voice.stopSpeaker();
    sending.current = true;
    setBusy(true);
    setError("");
    const sender = user?.id;
    const scope = JSON.stringify([sender, text.trim(), targetNode, robotId]);
    if (submission.current?.scope !== scope)
      submission.current = { scope, key: crypto.randomUUID() };
    try {
      const job = user
        ? await chatService.send(
            text.trim(),
            submission.current!.key,
            targetNode,
            robotId,
            fromVoice,
          )
        : await chatService.sendGuest(text.trim(), targetNode!);
      if (!active.current || owner.current !== sender) return null;
      submission.current = null;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: "user", text: text.trim() },
      ]);
      setInput("");
      setPending(job.id);
      publishRobotFace(sender, { action: "thinking" });
      return job.id;
    } catch (e) {
      if (active.current) {
        setError(e instanceof Error ? e.message : "Pesan belum terkirim.");
        setBusy(false);
      }
      return null;
    } finally {
      sending.current = false;
    }
  }
  sendRef.current = send;
  const [handsFreeTitle, handsFreeHint] = handsFreeLabels[handsFree.phase];
  return (
    <>
      <section className="live-chat" aria-label="Percakapan AERO-BOT">
        <header>
          <img
            src={busy ? "/assets/aerobot/falcon/watch.webp" : "/assets/aerobot/falcon/talk.webp"}
            alt=""
          />
          <div>
            <strong>AERO-BOT</strong>
            <small>{robotId ? "Layar robot · " + robotId : "Asisten lingkungan"}</small>
          </div>
          <span className="live-tag">{busy ? "Memproses" : "Siap"}</span>
        </header>
        {!user && !isLoading && (
          <div className="chat-guest">
            <p>
              Bertanya tanpa akun, langsung saja. <Link to="/login">Masuk</Link> untuk mode suara
              dan riwayat titik pantau Anda.
            </p>
            <WhatsAppEntry />
          </div>
        )}
        {authError && (
          <p className="live-notice" role="alert">
            {authError}
          </p>
        )}
        {canManage && (
          <label className="chat-scope">
            Layar robot
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              disabled={busy || !!pending || !!voice.speaking || handsFree.phase === "speaking"}
            >
              {ROBOT_SLOTS.map((id, i) => (
                <option key={id} value={id}>
                  Robot {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
        {!robotId && availableNodes.length > 0 && (
          <div className="chat-scope">
            <span aria-live="polite">
              <MapPin size={14} aria-hidden="true" />
              {locationStatus === "locating"
                ? "Mencari titik terdekat…"
                : contextNode
                  ? `Acuan: ${contextNode.name}${!manual && nearest ? ` · ${distanceLabel(nearest.distance)}` : ""}`
                  : point
                    ? "Tidak ada node dalam 5 km"
                    : "Tanpa acuan lokasi"}
              {locationStatus === "unavailable" && " · Lokasi perangkat tidak tersedia"}
            </span>
            {typeof navigator !== "undefined" && navigator.geolocation && (
              <button
                type="button"
                className="font-semibold text-[#0059b9] underline underline-offset-2"
                disabled={busy || !!pending || locationStatus === "locating"}
                onClick={locate}
              >
                {point ? "Perbarui lokasi" : "Gunakan lokasi saya"}
              </button>
            )}
            {availableNodes.length > 1 && (
              <details className="w-full">
                <summary className="cursor-pointer">Pilih titik lain</summary>
                <MonitoringSelect
                  label="Acuan percakapan"
                  value={nodeId || "__auto__"}
                  onValueChange={(value) => setNodeId(value === "__auto__" ? "" : value)}
                  disabled={busy || !!pending || locationStatus === "locating"}
                  options={[
                    { value: "__auto__", label: "Otomatis" },
                    ...availableNodes.map((n) => ({ value: n.id, label: n.name })),
                  ]}
                />
              </details>
            )}
          </div>
        )}
        {nodes.error && <p className="live-notice">{nodes.error}</p>}
        <div className="live-messages" role="log" aria-live="polite">
          {messages.length === 1 && !busy && (
            <div className="chat-welcome">
              <img src="/assets/aerobot/falcon/welcome.webp" alt="" />
              <h2>Hai, aku AERO-BOT!</h2>
              <p>
                Tanya soal udara dan cuaca di sekitarmu.
              </p>
              <div className="chat-suggestions">
                {suggestions.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    type="button"
                    disabled={busy || !!pending || isLoading}
                    onClick={() => void send(text)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.slice(messages.length === 1 && !busy ? 1 : 0).map((m) => (
            <div className={"live-message " + m.sender} key={m.id}>
              <div className="chat-message-content">
                {(m.sender === "bot" ? m.text.trim().split(/\n\s*\n/) : [m.text]).map(
                  (paragraph, index) => (
                    <p
                      key={index}
                      className={
                        paragraph.startsWith("Sumber:") ? "chat-message-sources" : undefined
                      }
                    >
                      {paragraph}
                    </p>
                  ),
                )}
              </div>
              {m.sender === "bot" && m.id !== "welcome" && voice.configured && (
                <button
                  className="chat-listen"
                  type="button"
                  onClick={() => void voice.speak(m.id, m.text, m.emotion)}
                  disabled={voice.recording || voice.transcribing}
                >
                  {voice.speaking === m.id && voice.preparingSpeech ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : voice.speaking === m.id ? (
                    <Square size={14} />
                  ) : (
                    <Volume2 size={15} />
                  )}
                  {voice.speaking === m.id
                    ? voice.preparingSpeech
                      ? "Menyiapkan suara…"
                      : "Hentikan suara"
                    : "Dengarkan"}
                </button>
              )}
            </div>
          ))}
          {busy && (
            <p className="chat-progress">
              <Loader2 size={16} className="animate-spin" /> AERO-BOT sedang menyiapkan jawaban…
            </p>
          )}
          <div ref={end} />
        </div>
        {error && (
          <div className="live-notice" role="alert">
            {error}
            {pending && (
              <button className="live-button secondary" onClick={() => setPollRun((n) => n + 1)}>
                <RefreshCw size={14} />
                Cek jawaban
              </button>
            )}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="chatInput">
            Pertanyaan lingkungan
          </label>
          <input
            id="chatInput"
            ref={composer}
            aria-describedby={
              voice.recording || voice.transcribing ? "chat-recording-status" : undefined
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            disabled={isLoading || busy || !!pending || voice.recording || voice.transcribing}
            placeholder="Tanyakan tentang lingkungan…"
            autoComplete="off"
          />
          {voice.configured && (
            <button
              className={`chat-composer-mic ${voice.recording ? "is-recording" : ""}`}
              type="button"
              onClick={() => void voice.toggleRecording()}
              disabled={
                !user ||
                !voice.configured ||
                !voice.supported ||
                voice.transcribing ||
                busy ||
                !!pending ||
                handsFree.active
              }
              aria-label={voice.recording ? "Selesai rekam dan kirim" : "Rekam pertanyaan"}
              title={voice.recording ? "Selesai rekam dan kirim" : "Rekam pertanyaan"}
              aria-pressed={voice.recording}
            >
              {voice.recording ? (
                <Square size={18} />
              ) : voice.transcribing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Mic size={18} />
              )}
            </button>
          )}
          <button
            aria-label="Kirim pesan"
            title="Kirim pesan"
            disabled={
              isLoading ||
              !input.trim() ||
              busy ||
              !!pending ||
              voice.recording ||
              voice.transcribing
            }
          >
            <ArrowUp size={18} />
          </button>
        </form>
        {(voice.recording || voice.transcribing) && (
          <p id="chat-recording-status" className="chat-note" role="status">
            {voice.recording
              ? "Merekam… Tekan tombol berhenti untuk mengirim."
              : "AERO-BOT sedang memahami rekaman…"}
          </p>
        )}
        {user && voice.configured && handsFree.supported && (
          <div className={`handsfree-card is-${handsFree.phase}`}>
            <button
              className="handsfree-toggle"
              type="button"
              aria-pressed={handsFree.active}
              onClick={() =>
                handsFree.active ? handsFreeControls.disable() : handsFreeControls.enable()
              }
            >
              {handsFree.active ? <MicOff size={20} /> : <Ear size={20} />}
              {handsFree.active ? "Matikan mode suara" : "Aktifkan mode suara"}
            </button>
            {handsFree.active && (
              <div className="handsfree-status" role="status" aria-live="polite">
                <span
                  className="handsfree-meter"
                  aria-hidden="true"
                  style={{ "--level": handsFree.level } as CSSProperties}
                >
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{handsFreeTitle}</strong>
                  <small>{handsFree.notice || handsFreeHint}</small>
                </span>
              </div>
            )}
            {handsFree.heard && handsFree.active && (
              <p className="handsfree-heard">Terdengar: “{handsFree.heard}”</p>
            )}
            {handsFree.phase === "speaking" && (
              <button
                className="chat-voice-button"
                type="button"
                onClick={() => handsFreeControls.stopSpeaking()}
              >
                <Square size={16} />
                Hentikan suara
              </button>
            )}
            {handsFree.phase === "blocked" && (
              <button
                className="chat-voice-button"
                type="button"
                onClick={() => handsFreeControls.resume()}
              >
                <Volume2 size={16} />
                Nyalakan suara
              </button>
            )}
            {handsFree.error && (
              <p className="live-notice" role="alert">
                {handsFree.error}
              </p>
            )}
            {handsFree.active && (
              <details className="chat-voice-privacy">
                <summary>Privasi mikrofon</summary>
                <p>
                  Mikrofon aktif selama mode suara menyala. Potongan ucapan, termasuk sebelum
                  panggilan, dikirim ke Gemini untuk transkripsi. Chat hanya memproses pertanyaan
                  setelah “Halo AERO-BOT”. Rekaman tidak disimpan AEROSENSE.
                </p>
              </details>
            )}
          </div>
        )}
        {voice.error && (
          <p className="live-notice" role="alert">
            {voice.error}
          </p>
        )}
        {voice.configured && !voice.supported && (
          <p className="chat-note">
            Untuk merekam, buka situs HTTPS ini di Chrome atau Edge dan izinkan mikrofon.
          </p>
        )}
      </section>
      {!onChat &&
        (handsFree.active || voice.speaking) &&
        createPortal(
          <div className="robot-voice-session" role="status">
            <Link to="/aerobot">
              {slot.replace("robot-", "Robot ")} · {handsFreeTitle}
            </Link>
            <button
              onClick={() => {
                handsFreeControls.disable();
                voice.stopSpeaker();
              }}
            >
              Matikan suara
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
