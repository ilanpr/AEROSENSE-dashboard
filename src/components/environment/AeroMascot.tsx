type Pose = "calm" | "watch" | "alert" | "welcome";
export function AeroMascot({ pose = "welcome", className = "" }: { pose?: Pose; className?: string }) {
  return <img className={`aero-mascot mascot-${pose} ${className}`} src={pose === "welcome" ? "/assets/aerobot.svg" : `/assets/aerobot/${pose}.png`}
    alt="" aria-hidden="true" width="320" height="320" decoding="async" />;
}
