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
  transcribing: ["Menyalin suara…", "Gemini sedang membaca pertanyaan Anda."],
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
        timer = setTimeout(poll, 2000);
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
  async function send(text = input, fromVoice = false): Promise<string | null> {
    if (!text.trim() || sending.current || pending || !user) return null;
    if (!fromVoice && (voice.recording || voice.transcribing)) return null;
    voice.stopSpeaker();
    sending.current = true;
    setBusy(true);
    setError("");
    const sender = user.id;
    const scope = JSON.stringify([sender, text.trim(), nodeId, robotId]);
    if (submission.current?.scope !== scope)
      submission.current = { scope, key: crypto.randomUUID() };
    try {
      const job = await chatService.send(
        text.trim(),
        submission.current!.key,
        nodeId,
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
            {m.text}
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
          <button key={s} onClick={() => setInput(s)}>
            {s}
          </button>
        ))}
      </div>
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
              ? "Mikrofon tetap menyala selama mode ini aktif. Kata “Halo AERO-BOT” dikenali oleh pengenal suara browser; hanya pertanyaan Anda yang dikirim ke Gemini. Rekaman tidak disimpan AEROSENSE."
              : "Mikrofon tetap menyala selama mode ini aktif. Setiap ucapan dikirim ke Gemini untuk mengenali “Halo AERO-BOT”. Rekaman tidak disimpan AEROSENSE."}
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
        <span role="status">{voice.recording ? "Merekam · maksimal 20 detik" : voice.transcribing ? "Gemini sedang menyalin rekaman" : handsFree.active ? "Mode suara tanpa tombol sedang aktif" : "Suara Gemini · mic dan speaker perangkat ini"}</span>
      </div>
      {voice.error && <p className="live-notice" role="alert">{voice.error}</p>}
      {user && !voice.configured && !voice.error && <p className="chat-note">{DEMO_MODE ? "Uji suara tersedia pada web yang terhubung ke backend produksi." : "Suara belum diaktifkan pengelola."}</p>}
      {voice.configured && !voice.supported && <p className="chat-note">Untuk merekam, buka situs HTTPS ini di Chrome atau Edge dan izinkan mikrofon.</p>}
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          disabled={!user || busy || !!pending || voice.recording || voice.transcribing}
          placeholder="Tanyakan tentang lingkungan…"
          autoComplete="off"
        />
        <button
          aria-label="Kirim pesan"
          disabled={!user || !input.trim() || busy || !!pending || voice.recording || voice.transcribing}
        >
          <ArrowUp size={18} />
        </button>
      </form>
      {voice.configured && !handsFree.active && <p className="chat-note">Rekam pertanyaan lalu tekan Selesai rekam: pertanyaan terkirim dan jawabannya dibacakan otomatis. Rekaman dikirim ke Gemini untuk transkripsi dan tidak disimpan AEROSENSE.</p>}
    </section>
  );
}
