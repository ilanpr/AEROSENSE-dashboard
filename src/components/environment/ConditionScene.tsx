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
      <span className="scene-ring" />
      <img
        src={`/assets/environment/${scene}.webp`}
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
