import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/services/api";
import { DEMO_MODE } from "@/lib/demo-mode";

export function useChatVoice(userId: string | undefined, onTranscript: (text: string) => void) {
  const [configured, setConfigured] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const audioController = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const acquiring = useRef(false);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  function stopSpeaker() {
    audioController.current?.abort();
    player.current?.pause();
    player.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    setSpeaking(null);
  }
  useEffect(() => {
    ++generation.current;
    const controller = new AbortController();
    setConfigured(false);
    setError("");
    if (userId && !DEMO_MODE) {
      void apiRequest<{ configured: boolean }>("/v1/voice/config", { signal: controller.signal })
        .then(config => { if (!controller.signal.aborted) setConfigured(config.configured); })
        .catch(() => { if (!controller.signal.aborted) setError("Suara belum aktif. Pastikan backend sudah diperbarui dan Gemini dikonfigurasi."); });
    }
    return () => {
      controller.abort();
      cancelSession();
    };
  }, [userId]);
  function cancelSession() {
    ++generation.current;
    clearTimeout(timeout.current);
    releaseMic();
    stopSpeaker();
  }
  function releaseMic() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    mic.current?.getTracks().forEach(track => track.stop());
  }

  async function toggleRecording() {
    if (recorder.current?.state === "recording") { recorder.current.stop(); return; }
    if (acquiring.current || transcribing || !configured || !supported) return;
    acquiring.current = true;
    setError("");
    stopSpeaker();
    const run = generation.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (run !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      mic.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Format mikrofon belum didukung. Gunakan Chrome atau Edge.");
      const capture = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 });
      recorder.current = capture;
      const chunks: BlobPart[] = [];
      capture.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      capture.onerror = () => {
        clearTimeout(timeout.current);
        stream.getTracks().forEach(track => track.stop());
        if (run === generation.current) { setRecording(false); setError("Rekaman terhenti. Periksa mikrofon lalu coba lagi."); }
      };
      capture.onstop = () => {
        clearTimeout(timeout.current);
        stream.getTracks().forEach(track => track.stop());
        if (run !== generation.current) return;
        setRecording(false);
        setTranscribing(true);
        void (async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size > 1000000) throw new Error("Rekaman terlalu besar. Coba pertanyaan lebih singkat.");
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const result = await apiRequest<{ text: string }>("/v1/voice/transcribe", {
              method: "POST", body: JSON.stringify({ mime_type: mimeType, audio_base64: base64 }), signal: AbortSignal.timeout(60000),
            });
            if (run === generation.current) onTranscript(result.text);
          } catch (failure) {
            if (run === generation.current) setError(failure instanceof Error ? failure.message : "Rekaman belum dapat dibaca.");
          } finally { if (run === generation.current) setTranscribing(false); }
        })();
      };
      capture.start();
      setRecording(true);
      timeout.current = setTimeout(() => { if (capture.state === "recording") capture.stop(); }, 20000);
    } catch (failure) {
      mic.current?.getTracks().forEach(track => track.stop());
      if (run === generation.current) setError(failure instanceof DOMException && failure.name === "NotAllowedError"
        ? "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan situs, lalu coba lagi."
        : failure instanceof Error ? failure.message : "Mikrofon belum tersedia.");
    } finally { acquiring.current = false; }
  }

  async function speak(jobId?: string) {
    const id = jobId || "test";
    if (speaking === id) { stopSpeaker(); return; }
    stopSpeaker();
    setError("");
    setSpeaking(id);
    const controller = new AbortController();
    audioController.current = controller;
    try {
      const blob = await apiRequest<Blob>("/v1/voice/speak", {
        method: "POST", body: JSON.stringify(jobId ? { job_id: jobId } : { test: true }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
      }, true, "blob");
      if (controller.signal.aborted) return;
      if (!blob.type.startsWith("audio/wav")) throw new Error("Respons suara belum tersedia. Perbarui backend dan coba lagi.");
      audioUrl.current = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl.current);
      player.current = audio;
      audio.onended = stopSpeaker;
      audio.onerror = () => { stopSpeaker(); setError("Speaker gagal memutar suara. Periksa keluaran audio laptop."); };
      await audio.play();
    } catch (failure) {
      if (!controller.signal.aborted) {
        stopSpeaker();
        setError(failure instanceof DOMException && failure.name === "NotAllowedError"
          ? "Browser menahan pemutaran. Klik Dengarkan lagi untuk memutar melalui speaker."
          : failure instanceof Error ? failure.message : "Suara belum dapat diputar.");
      }
    }
  }
  return { configured, supported, recording, transcribing, speaking, error, toggleRecording, speak, stopSpeaker };
}
