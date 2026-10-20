import { MonitoringSelect } from "@/components/shared/MonitoringSelect";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUp, Loader2, RefreshCw, Mic, Square, Volume2 } from "lucide-react";
import { chatService } from "@/services/chat.service";
import { useAuth } from "@/hooks/useAuth";
import { useLiveData } from "@/hooks/useLiveData";
import type { LiveNode } from "@/types/live.types";
import { useChatVoice } from "@/hooks/useChatVoice";
import { DEMO_MODE } from "@/lib/demo-mode";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
}
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
  const voice = useChatVoice(userId, setInput);
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
          return;
        }
        if (job.status === "failed") {
          setPending(null);
          throw new Error(
            job.error ||
              "Permintaan gagal diproses. Silakan kirim ulang pertanyaan.",
          );
        }
        if (Date.now() - started > 120000)
          throw new Error(
            "Jawaban masih diproses. Tekan Cek jawaban untuk melanjutkan tanpa mengirim pertanyaan baru.",
          );
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
  }, [pending, userId, pollRun]);
  async function send(text = input) {
    if (!text.trim() || sending.current || pending || !user || voice.recording || voice.transcribing) return;
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
      if (!active.current || owner.current !== sender) return;
      submission.current = null;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: "user", text: text.trim() },
      ]);
      setInput("");
      setPending(job.id);
    } catch (e) {
      if (active.current) {
        setError(e instanceof Error ? e.message : "Pesan belum terkirim.");
        setBusy(false);
      }
    } finally {
      sending.current = false;
    }
  }
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
      <div className="chat-voice-toolbar">
        <button className={`chat-voice-button ${voice.recording ? "is-recording" : ""}`} type="button"
          onClick={() => void voice.toggleRecording()}
          disabled={!user || !voice.configured || !voice.supported || voice.transcribing || busy || !!pending}
          aria-pressed={voice.recording}>
          {voice.recording ? <Square size={16} /> : voice.transcribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
          {voice.recording ? "Selesai rekam" : voice.transcribing ? "Menyalin suara…" : "Rekam pertanyaan"}
        </button>
        <button className="chat-voice-button" type="button" disabled={!user || !voice.configured || voice.recording || voice.transcribing}
          onClick={() => void voice.speak()}>
          <Volume2 size={16} />{voice.speaking === "test" ? "Hentikan tes" : "Tes speaker"}
        </button>
        <span role="status">{voice.recording ? "Merekam · maksimal 20 detik" : voice.transcribing ? "Gemini sedang menyalin rekaman" : "Suara Gemini · mic dan speaker perangkat ini"}</span>
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
      {voice.configured && <p className="chat-note">Rekam, periksa teks, lalu kirim. Rekaman dikirim ke Gemini untuk transkripsi dan tidak disimpan AEROSENSE. Klik Dengarkan pada jawaban untuk memutar suara.</p>}
    </section>
  );
}
