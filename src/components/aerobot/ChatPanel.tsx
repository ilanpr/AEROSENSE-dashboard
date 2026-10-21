import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUp, Ear, Loader2, RefreshCw, Mic, MicOff, Square, Volume2 } from "lucide-react";
import { chatService } from "@/services/chat.service";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import type { LiveNode } from "@/types/live.types";
import { useChatVoice } from "@/hooks/useChatVoice";
import { useHandsFreeVoice } from "@/hooks/useHandsFreeVoice";
import type { HandsFreePhase } from "@/lib/handsfree-engine";
import { DEMO_MODE } from "@/lib/demo-mode";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
}
const handsFreeLabels: Record<HandsFreePhase, [string, string]> = {
  off: ["Mode suara mati", "Aktifkan untuk bertanya tanpa menekan tombol."],
  starting: ["Menyiapkan mikrofon…", "Izinkan mikrofon jika browser meminta."],
  blocked: ["Ketuk layar atau tekan tombol apa saja", "Browser perlu satu sentuhan untuk menyalakan suara."],
  waiting: ["Ucapkan “Halo AERO-BOT”", "Lalu langsung sampaikan pertanyaan Anda."],
  listening: ["Mendengarkan…", "Silakan bicara. Pertanyaan terkirim otomatis saat Anda berhenti."],
  transcribing: ["Menyalin suara…", "AERO-BOT sedang memahami pertanyaan Anda."],
  thinking: ["Menyiapkan jawaban…", "AERO-BOT sedang memproses pertanyaan Anda."],
  speaking: ["Membacakan jawaban", "Tekan Esc atau tombol Hentikan suara untuk berhenti."],
};
const suggestions = [
  "Cuaca di titik robot hari ini?",
  "Cara mengurangi polusi?",
  "Kabar karhutla di Indonesia?",
];
export function ChatPanel() {
  const { user, error: authError } = useAuth();
  const userId = user?.id;
  const [params] = useSearchParams();
  const robotId = params.get("robot_id") || undefined;
  const nodes = useLiveData<{ nodes: LiveNode[] }>(
    user ? "/v1/dashboard" : null,
    60000,
  );
  const [nodeId, setNodeId] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Halo! Ada yang ingin ditanyakan soal lingkungan?",
    },
  ]);
  const [input, setInput] = useState(params.get("question") || "");
  const voiceJobs = useRef(new Map<string, "manual" | "handsfree">());
  const sendRef = useRef<(text: string, fromVoice?: boolean) => Promise<string | null>>(async () => null);
  const voice = useChatVoice(userId, text => {
    void sendRef.current(text, true).then(id => { if (id) voiceJobs.current.set(id, "manual"); else setInput(text); });
  });
  const handsFree = useHandsFreeVoice({
    userId,
    available: voice.configured && !DEMO_MODE,
    onQuestion: async text => {
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
      owner.current = user?.id;
    }
  }, [user?.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => {
    if (!pending || !userId) return;
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
          if (!job.result?.text)
            throw new Error(
              "Jawaban belum tersedia. Coba cek lagi sebentar.",
            );
          setMessages((prev) =>
            prev.some((m) => m.id === job.id)
              ? prev
              : [
                  ...prev,
                  { id: job.id, sender: "bot", text: job.result!.text! },
                ],
          );
          setPending(null);
          setBusy(false);
          if (spoken) {
            voiceJobs.current.delete(job.id);
            if (spoken === "handsfree") void handsFreeControls.speakAnswer(job.id, job.result!.text!);
            else void voiceSpeak.current(job.id);
          }
          return;
        }
        if (job.status === "failed") {
          setPending(null);
          if (spoken === "handsfree") { voiceJobs.current.delete(job.id); void handsFreeControls.announce("Maaf, pertanyaan belum dapat dijawab. Silakan coba lagi."); }
          throw new Error(
            job.error ||
              "Permintaan gagal diproses. Silakan kirim ulang pertanyaan.",
          );
        }
        if (Date.now() - started > 120000) {
          if (spoken === "handsfree") void handsFreeControls.announce("Jawaban masih diproses. Silakan tanyakan lagi sebentar lagi.");
          throw new Error(
            "Jawaban masih diproses. Tekan Cek jawaban untuk melanjutkan tanpa mengirim pertanyaan baru.",
          );
        }
        // Voice users hear nothing while waiting, so check their answers more often.
        timer = setTimeout(poll, spoken ? 700 : 2000);
      } catch (e) {
        if (!controller.signal.aborted) {
          setBusy(false);
          setError(
            e instanceof Error
              ? e.message
              : "Koneksi terputus. Cek jawaban lagi.",
          );
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
  // Returns the job id so voice questions can be answered aloud automatically.
  // Voice users cannot easily pick a sensor, so voice questions fall back to the first node.
  // The node gives Gemini the sensor readings and the public environment data (weather, air, fire, flood).
  const voiceNode = nodeId || nodes.data?.nodes?.[0]?.id || "";
  const voiceNodeName = nodes.data?.nodes?.find(n => n.id === voiceNode)?.name;
  async function send(text = input, fromVoice = false): Promise<string | null> {
    const targetNode = fromVoice && !robotId ? voiceNode : nodeId;
    if (!text.trim() || sending.current || pending || !user) return null;
    if (!fromVoice && (voice.recording || voice.transcribing)) return null;
    voice.stopSpeaker();
    sending.current = true;
    setBusy(true);
    setError("");
    const sender = user.id;
    const scope = JSON.stringify([sender, text.trim(), targetNode, robotId]);
    if (submission.current?.scope !== scope)
      submission.current = { scope, key: crypto.randomUUID() };
    try {
      const job = await chatService.send(
        text.trim(),
        submission.current!.key,
        targetNode,
        robotId,
      );
      if (!active.current || owner.current !== sender) return null;
      submission.current = null;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: "user", text: text.trim() },
      ]);
      setInput("");
      setPending(job.id);
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
    <section className="live-chat" aria-label="Percakapan AERO-BOT">
      <header>
        <img src="/assets/aerobot.svg" alt="" />
        <div>
          <strong>AERO-BOT</strong>
          <small>
            {robotId ? "Layar robot · " + robotId : "Asisten lingkungan"}
          </small>
        </div>
        {user ? <span className="live-tag">{busy ? "Memproses" : "Siap"}</span>
          : <Link className="live-tag" to="/login">Masuk untuk bertanya</Link>}
      </header>
      <label className="chat-scope">
        Sensor
        <MonitoringSelect label="Sumber sensor percakapan" value={nodeId || "__no_sensor__"}
          onValueChange={value=>setNodeId(value==="__no_sensor__"?"":value)} disabled={!!robotId || busy || !!pending}
          options={[{value:"__no_sensor__",label:"Tanpa sensor"},...(nodes.data?.nodes || []).map(n=>({value:n.id,label:n.name}))]} />
      </label>
      {nodes.error && <p className="live-notice">{nodes.error}</p>}
      <div className="live-messages" role="log" aria-live="polite">
        {messages.map((m) => (
          <div className={"live-message " + m.sender} key={m.id}>
            <div className="chat-message-content">
              {(m.sender === "bot" ? m.text.trim().split(/\n\s*\n/) : [m.text]).map((paragraph, index) => (
                <p key={index} className={paragraph.startsWith("Sumber:") ? "chat-message-sources" : undefined}>{paragraph}</p>
              ))}
            </div>
            {m.sender === "bot" && m.id !== "welcome" && voice.configured && (
              <button className="chat-listen" type="button" onClick={() => void voice.speak(m.id)} disabled={voice.recording || voice.transcribing}>
                {voice.speaking === m.id ? <Square size={14} /> : <Volume2 size={15} />}
                {voice.speaking === m.id ? "Hentikan suara" : "Dengarkan"}
              </button>
            )}
          </div>
        ))}
        {busy && (
          <p className="chat-progress">
            <Loader2 size={16} className="animate-spin" /> AERO-BOT sedang
            menyiapkan jawaban…
          </p>
        )}
        <div ref={end} />
      </div>
      {!user && authError && <p className="live-notice" role="alert">{authError}</p>}
      {error && (
        <div className="live-notice" role="alert">
          {error}
          {pending && (
            <button
              className="live-button secondary"
              onClick={() => setPollRun((n) => n + 1)}
            >
              <RefreshCw size={14} />
              Cek jawaban
            </button>
          )}
        </div>
      )}
      <div className="chat-suggestions">
        {suggestions.map((s) => (
          <button key={s} onClick={() => { setInput(s); composer.current?.focus(); }}>
            {s}
          </button>
        ))}
      </div>
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
          aria-describedby="chat-send-hint"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          disabled={!user || busy || !!pending || voice.recording || voice.transcribing}
          placeholder="Tanyakan tentang lingkungan…"
          autoComplete="off"
        />
        <button
          aria-label="Kirim pesan"
          title="Kirim pesan"
          disabled={!user || !input.trim() || busy || !!pending || voice.recording || voice.transcribing}
        >
          <ArrowUp size={18} />
        </button>
      </form>
      <p id="chat-send-hint" className="chat-note">{input.trim() && !busy && !pending ? "Pertanyaan belum dikirim. Tekan tombol panah atau Enter untuk mengirim." : "Ketik pertanyaan atau pilih saran, lalu tekan tombol panah untuk mengirim."}</p>
      {user && voice.configured && handsFree.supported && (
        <div className={`handsfree-card is-${handsFree.phase}`}>
          <button className="handsfree-toggle" type="button" aria-pressed={handsFree.active}
            onClick={() => handsFree.active ? handsFreeControls.disable() : handsFreeControls.enable()}>
            {handsFree.active ? <MicOff size={20} /> : <Ear size={20} />}
            {handsFree.active ? "Matikan mode suara" : "Aktifkan mode suara tanpa tombol"}
          </button>
          <div className="handsfree-status" role="status" aria-live="polite">
            <span className="handsfree-meter" aria-hidden="true" style={{ "--level": handsFree.level } as CSSProperties}><i /><i /><i /><i /><i /></span>
            <span>
              <strong>{handsFreeTitle}</strong>
              <small>{handsFree.notice || handsFreeHint}</small>
            </span>
          </div>
          {handsFree.active && !robotId && (
            <p className="chat-note">{voiceNodeName
              ? `Data sensor dan lingkungan diambil dari titik ${voiceNodeName}. Ubah lewat pilihan Sensor di atas.`
              : "Belum ada titik sensor, jadi AERO-BOT menjawab tanpa data lingkungan setempat."}</p>
          )}
          {handsFree.heard && handsFree.active && <p className="handsfree-heard">Terdengar: “{handsFree.heard}”</p>}
          {handsFree.phase === "speaking" && (
            <button className="chat-voice-button" type="button" onClick={() => handsFreeControls.stopSpeaking()}>
              <Square size={16} />Hentikan suara
            </button>
          )}
          {handsFree.phase === "blocked" && (
            <button className="chat-voice-button" type="button" onClick={() => handsFreeControls.resume()}>
              <Volume2 size={16} />Nyalakan suara
            </button>
          )}
          {handsFree.error && <p className="live-notice" role="alert">{handsFree.error}</p>}
          <p className="chat-note">
            {handsFree.engine === "browser"
              ? "Mikrofon tetap menyala selama mode ini aktif. Kata “Halo AERO-BOT” dikenali oleh pengenal suara browser; hanya rekaman pertanyaan Anda yang dikirim untuk diproses AERO-BOT. Rekaman tidak disimpan AEROSENSE."
              : "Mikrofon tetap menyala selama mode ini aktif. Setiap ucapan dikirim untuk diproses AERO-BOT agar mengenali “Halo AERO-BOT”. Rekaman tidak disimpan AEROSENSE."}
          </p>
        </div>
      )}
      <div className="chat-voice-toolbar">
        <button className={`chat-voice-button ${voice.recording ? "is-recording" : ""}`} type="button"
          onClick={() => void voice.toggleRecording()}
          disabled={!user || !voice.configured || !voice.supported || voice.transcribing || busy || !!pending || handsFree.active}
          aria-pressed={voice.recording}>
          {voice.recording ? <Square size={16} /> : voice.transcribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
          {voice.recording ? "Selesai rekam" : voice.transcribing ? "Menyalin suara…" : "Rekam pertanyaan"}
        </button>
        <button className="chat-voice-button" type="button" disabled={!user || !voice.configured || voice.recording || voice.transcribing || handsFree.active}
          onClick={() => void voice.speak()}>
          <Volume2 size={16} />{voice.speaking === "test" ? "Hentikan tes" : "Tes speaker"}
        </button>
        <span role="status">{voice.recording ? "Merekam · maksimal 20 detik" : voice.transcribing ? "AERO-BOT sedang menyalin rekaman" : handsFree.active ? "Mode suara tanpa tombol sedang aktif" : "Suara AERO-BOT · mic dan speaker perangkat ini"}</span>
      </div>
      {voice.error && <p className="live-notice" role="alert">{voice.error}</p>}
      {user && !voice.configured && !voice.error && <p className="chat-note">{DEMO_MODE ? "Uji suara tersedia pada web yang terhubung ke backend produksi." : "Suara belum diaktifkan pengelola."}</p>}
      {voice.configured && !voice.supported && <p className="chat-note">Untuk merekam, buka situs HTTPS ini di Chrome atau Edge dan izinkan mikrofon.</p>}

      {voice.configured && !handsFree.active && <p className="chat-note">Rekam pertanyaan lalu tekan Selesai rekam: pertanyaan terkirim dan jawabannya dibacakan otomatis. Rekaman dikirim untuk diproses AERO-BOT menjadi teks dan tidak disimpan AEROSENSE.</p>}
    </section>
  );
}
