import { useEffect, useRef, useState } from "react";

/** Run decorative motion only while its illustration is visible in the active tab. */
export function useIllustrationMotion<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    let visible = false;
    const sync = () => setPlaying(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [enabled]);
  return { ref, playing: enabled && playing };
}
