import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/services/api";
import { prepareRobotFaceSpeech, publishRobotFace } from "@/lib/robot-face-bus";
import {
  createHandsFreeEngine,
  type HandsFreeEngine,
  type HandsFreeState,
} from "@/lib/handsfree-engine";

const PREFERENCE_KEY = "aerosense.handsfree";
const PROVIDER_KEY = "aerosense.handsfree.provider";

function readPreference() {
  try {
    return (
      localStorage.getItem(PREFERENCE_KEY) === "on" &&
      localStorage.getItem(PROVIDER_KEY) === "gemini"
    );
  } catch {
    return false;
  }
}
function writePreference(on: boolean) {
  try {
    localStorage.setItem(PREFERENCE_KEY, on ? "on" : "off");
    if (on) localStorage.setItem(PROVIDER_KEY, "gemini");
  } catch {
    /* private mode */
  }
}

const initialState: HandsFreeState = {
  phase: "off",
  level: 0,
  engine: "gemini",
  heard: "",
  notice: "",
  error: "",
  followUp: false,
};

export function useHandsFreeVoice(options: {
  userId: string | undefined;
  available: boolean;
  onQuestion: (text: string) => Promise<boolean>;
}) {
  const { userId, available } = options;
  const [state, setState] = useState<HandsFreeState>(initialState);
  const onQuestion = useRef(options.onQuestion);
  const faceOwner = useRef(userId);
  faceOwner.current = userId;
  onQuestion.current = options.onQuestion;
  const engine = useRef<HandsFreeEngine | null>(null);
  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== "undefined";

  if (!engine.current && typeof window !== "undefined") {
    engine.current = createHandsFreeEngine({
      onState: (next) => setState(next),
      onPlayback: (audio, text, emotion) =>
        publishRobotFace(
          faceOwner.current,
          audio ? { action: "speak", audio, text, emotion } : { action: "stop" },
          !audio,
        ),
      beforePlayback: (audio, text, signal, emotion) =>
        prepareRobotFaceSpeech(faceOwner.current, audio, text, signal, emotion),
      fetchAnnouncement: (text, signal) =>
        apiRequest<Blob>(
          "/v1/voice/speak",
          {
            method: "POST",
            body: JSON.stringify({ template_text: text }),
            signal,
          },
          true,
          "blob",
        ),
      onQuestion: (text) => onQuestion.current(text),
      async transcribe(mimeType, base64, signal) {
        const result = await apiRequest<{ text: string }>("/v1/voice/transcribe", {
          method: "POST",
          body: JSON.stringify({ mime_type: mimeType, audio_base64: base64 }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
        });
        return result.text;
      },
      fetchSpeech(jobId, part, signal) {
        return apiRequest<Blob>(
          "/v1/voice/speak",
          {
            method: "POST",
            body: JSON.stringify({ job_id: jobId, part }),
            signal: AbortSignal.any([signal, AbortSignal.timeout(65000)]),
          },
          true,
          "blob",
        );
      },
    });
  }

  // Stop listening when the account changes or voice becomes unavailable.
  useEffect(() => {
    const current = engine.current;
    if (!current || !userId || !available || !supported) return;
    if (readPreference()) void current.start();
    return () => current.stop();
  }, [userId, available, supported]);

  // Browsers keep audio suspended until the first interaction after a reload.
  useEffect(() => {
    if (state.phase !== "blocked") return;
    const wake = () => void engine.current?.resume();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [state.phase]);

  const controls = useMemo(
    () => ({
      enable() {
        writePreference(true);
        void engine.current?.start();
      },
      disable() {
        writePreference(false);
        engine.current?.stop();
      },
      resume() {
        void engine.current?.resume();
      },
      speakAnswer(jobId: string, text: string, emotion?: string) {
        return engine.current?.speakAnswer(jobId, text, emotion) ?? Promise.resolve();
      },
      announce(text: string) {
        return engine.current?.announce(text) ?? Promise.resolve();
      },
      stopSpeaking() {
        engine.current?.stopSpeaking();
      },
    }),
    [],
  );

  return { ...state, active: state.phase !== "off", supported, controls };
}
