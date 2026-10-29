import { useIllustrationMotion } from "@/hooks/useIllustrationMotion";

type Pose = "calm" | "watch" | "alert" | "welcome" | "talk" | "guide" | "success";
export function AeroMascot({ pose = "welcome", className = "" }: { pose?: Pose; className?: string }) {
  const { ref, playing } = useIllustrationMotion<HTMLImageElement>();
  return <img ref={ref} className={`aero-mascot mascot-${pose} ${playing ? "" : "motion-paused"} ${className}`} src={`/assets/aerobot/falcon/${pose}.webp`}
    alt="" aria-hidden="true" width="320" height="320" decoding="async" />;
}
