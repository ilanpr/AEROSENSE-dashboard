import { useId } from "react";
import { useIllustrationMotion } from "@/hooks/useIllustrationMotion";

export function LandingTrend() {
  const gradient = useId();
  const { ref, playing } = useIllustrationMotion<HTMLElement>();
  const curve = "M28 164 C48 164 50 126 74 131 S107 178 132 140 S164 64 190 91 S220 145 244 104 S285 62 324 45";
  return <figure ref={ref} className={`landing-trend ${playing ? "is-playing" : ""}`}>
    <svg viewBox="0 0 352 248" role="img" aria-label="Ilustrasi animasi perubahan pembacaan dan garis tren, bukan data pengukuran langsung">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#249bff" stopOpacity=".25" /><stop offset="1" stopColor="#249bff" stopOpacity="0" /></linearGradient></defs>
      <g className="landing-trend-grid">{[48, 96, 144, 192].map(y => <line key={y} x1="28" y1={y} x2="324" y2={y} />)}</g>
      <path d={`${curve} L324 204 H28 Z`} fill={`url(#${gradient})`} />
      <path className="landing-trend-reference" d="M28 174 C109 174 187 134 324 70" />
      <path className="landing-trend-line" d={curve} pathLength="1" />
      <circle className="landing-trend-pulse" cx="324" cy="45" r="10" />
      <circle cx="324" cy="45" r="4.5" fill="#096cf0" stroke="#fff" strokeWidth="2" />
      <text x="28" y="232">Awal periode</text><text x="324" y="232" textAnchor="end">Akhir periode</text>
    </svg>
    <figcaption><span />Ilustrasi tren pembacaan</figcaption>
  </figure>;
}
