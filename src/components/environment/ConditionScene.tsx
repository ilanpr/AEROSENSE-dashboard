import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { Scene } from "@/lib/environment-presentation";
import { useIllustrationMotion } from "@/hooks/useIllustrationMotion";

export function ConditionScene({
  scene,
  muted = false,
  small = false,
}: {
  scene: Scene;
  muted?: boolean;
  small?: boolean;
}) {
  const { ref: sceneRef, playing } = useIllustrationMotion<HTMLDivElement>(!small);
  return (
    <div
      ref={sceneRef}
      className={`condition-scene scene-${scene} ${muted ? "scene-muted" : ""} ${small ? "scene-small" : ""} ${!playing ? "scene-offscreen" : ""}`}
      aria-hidden="true"
    >
      <span className="scene-halo" />
      {scene !== "sensor" && <span className="scene-ring" />}
      {scene === "sensor" && !small && (
        <>
          <svg className="sensor-backdrop" viewBox="0 0 360 360" fill="none" aria-hidden="true">
            <path className="sensor-air-current" d="M10 152C28 143 47 141 68 146M20 166C34 161 47 160 59 162" />
            <path className="sensor-air-current air-current-two" d="M290 227C307 221 329 222 348 230" />
            <path className="sensor-air-current air-current-three" d="M273 247C292 241 313 244 329 250" />
          </svg>
          <span className="sensor-float-object sensor-orb-one" />
          <span className="sensor-float-object sensor-orb-two" />
          <span className="sensor-float-object sensor-orb-three" />
          <span className="sensor-float-object sensor-orb-four" />
          <span className="sensor-float-object sensor-orb-five" />
        </>
      )}
      <img
        src={`/assets/environment/${scene === "sensor" ? "sensor-node-v3" : scene}.webp`}
        alt=""
        width="360"
        height="360"
        decoding="async"
        loading={small ? "lazy" : "eager"}
      />
      <span className="scene-spark spark-one" />
      <span className="scene-spark spark-two" />
    </div>
  );
}

export function Atmosphere() {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      if (!motion.matches && !paused && visible && !document.hidden) {
        if (!element.getAttribute("src"))
          element.src = "/assets/environment/atmosphere.mp4";
        void element.play().catch(() => {});
      } else element.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      element.pause();
    };
  }, [paused]);
  return (
    <>
      <video
        ref={video}
        className="panel-atmosphere"
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        className="motion-toggle"
        aria-label={paused ? "Putar animasi panel" : "Jeda animasi panel"}
        title={paused ? "Putar animasi" : "Jeda animasi"}
        aria-pressed={paused}
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
      </button>
    </>
  );
}
