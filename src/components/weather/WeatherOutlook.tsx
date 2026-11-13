import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CloudLightning,
  CloudRainWind,
  Droplets,
  Map as MapIcon,
  Sun,
  Thermometer,
  Tornado,
  Umbrella,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import type { WeatherOutlook as Outlook, Hazards, WeatherHour } from "@/types/weather.types";
import "@/styles/weather.css";

// The same 3D weather illustrations as the rest of the site.
const SCENE: Record<string, string> = {
  clear: "sunny",
  partly: "partly-cloudy",
  cloudy: "cloudy",
  fog: "fog",
  drizzle: "rain",
  rain: "rain",
  "heavy-rain": "steady-rain",
  thunder: "storm",
};
const NIGHT: Record<string, string> = {
  clear: "sunny-night",
  partly: "cloudy-night",
  cloudy: "cloudy-night",
  fog: "fog-night",
  drizzle: "rain-night",
  rain: "rain-night",
  "heavy-rain": "rain-night",
  thunder: "storm-night",
};
function WeatherArt({ icon, night = false, size }: { icon: string; night?: boolean; size: number }) {
  const scene = (night ? NIGHT[icon] : SCENE[icon]) || "cloudy";
  return (
    <img
      className="wx-art"
      src={`/assets/environment/${scene}.webp?v=20261107b`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}
const ALERT_ICON: Record<string, LucideIcon> = {
  thunder: CloudLightning,
  heavy_rain: CloudRainWind,
  wind: Wind,
  heat: Thermometer,
  uv: Sun,
};
const num = (v: number | null | undefined) =>
  v == null ? "–" : String(Math.round(v * 10) / 10).replace(".", ",");
const dayName = (date: string, i: number) =>
  i === 0
    ? "Hari ini"
    : i === 1
      ? "Besok"
      : new Date(date + "T12:00:00+07:00").toLocaleDateString("id-ID", {
          weekday: "short",
          timeZone: "Asia/Jakarta",
        });
const uvLabel = (uv: number | null) =>
  uv == null ? "" : uv >= 11 ? "ekstrem" : uv >= 8 ? "sangat tinggi" : uv >= 6 ? "tinggi" : uv >= 3 ? "sedang" : "rendah";

// One short piece of advice for the day; the warnings below carry the details.
function todayTip(d: { rain_chance: number | null; uv: number | null; max: number | null }) {
  const tips = [];
  if ((d.rain_chance ?? 0) >= 50) tips.push("bawa payung atau jas hujan");
  if ((d.uv ?? 0) >= 8) tips.push("pakai topi dan tabir surya saat siang");
  if ((d.max ?? 0) >= 34) tips.push("minum air putih lebih sering");
  if (!tips.length) return "Cuaca cukup bersahabat untuk beraktivitas di luar.";
  const text = tips.length > 1 ? tips.slice(0, -1).join(", ") + ", dan " + tips[tips.length - 1] : tips[0];
  return "Hari ini sebaiknya " + text + ".";
}

/**
 * Forecast only: today, the coming hours, 7 days, warnings, cyclones and earthquakes.
 * Conditions "now" stay in the Hub card above, so the page shows one set of current numbers.
 */
export function WeatherOutlook({
  point,
  place,
  compact = false,
}: {
  point?: { latitude: number; longitude: number };
  place?: string;
  compact?: boolean;
}) {
  const path = point
    ? `/v1/weather?lat=${point.latitude.toFixed(3)}&lng=${point.longitude.toFixed(3)}`
    : null;
  const wx = useLiveData<Outlook>(path, 900000, false);
  const hz = useLiveData<Hazards>(compact ? null : "/v1/hazards", 600000, false);
  if (!point) return null;
  const o = wx.data;
  const today = o?.daily[0];
  // Start at the next full hour; the current hour belongs to the "now" card.
  const hours = (o?.hourly || []).slice(1, compact ? 13 : 25);
  return (
    <section
      id="cuaca"
      className={`disaster-section weather-outlook ${compact ? "is-compact" : ""}`}
      aria-labelledby="wx-title"
    >
      <header className="disaster-heading">
        <div>
          <h2 id="wx-title">Prakiraan cuaca</h2>
          <p>
            {place ? `Sekitar ${place}` : "Sekitar lokasi acuan"} · model Open-Meteo
            {o?.valid_at
              ? ` · ${new Date(o.valid_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`
              : ""}
          </p>
        </div>
        <Link
          className="insight-text-link"
          to={
            compact
              ? "/environment#cuaca"
              : `/aerobot?question=${encodeURIComponent(`Bagaimana prakiraan cuaca dan peluang hujan ${place ? "di sekitar " + place : "di sekitarku"} hari ini dan besok? Apa yang perlu saya siapkan?`)}`
          }
        >
          {compact ? "Prakiraan lengkap" : "Tanya AERO-BOT"} <ArrowUpRight size={15} />
        </Link>
      </header>
      {wx.error && !o && <p className="live-notice">{wx.error}</p>}
      {!o && !wx.error && <div className="wx-skeleton" aria-busy="true" />}
      {o && today && (
        <div className="wx-body">
          <article className={`wx-today tone-${today.icon}`}>
            <WeatherArt icon={today.icon} size={compact ? 116 : 148} />
            <div className="wx-today-copy">
              <span className="wx-eyebrow">Hari ini</span>
              <h3>{today.label}</h3>
              <p className="wx-today-range">
                <strong>{num(today.max)}°</strong> / {num(today.min)}°
              </p>
              <p className="wx-today-tip">{todayTip(today)}</p>
            </div>
            <dl className="wx-today-stats">
              <div>
                <dt>
                  <Umbrella size={15} aria-hidden="true" /> Peluang hujan
                </dt>
                <dd>{num(today.rain_chance ?? 0)}%</dd>
              </div>
              <div>
                <dt>
                  <Droplets size={15} aria-hidden="true" /> Curah hujan
                </dt>
                <dd>{num(today.rain ?? 0)} mm</dd>
              </div>
              <div>
                <dt>
                  <Sun size={15} aria-hidden="true" /> UV maks
                </dt>
                <dd>
                  {num(today.uv)} <small>{uvLabel(today.uv)}</small>
                </dd>
              </div>
              {!compact && (
                <div>
                  <dt>
                    <Wind size={15} aria-hidden="true" /> Hembusan maks
                  </dt>
                  <dd>{num(today.gust)} km/jam</dd>
                </div>
              )}
            </dl>
          </article>
          {o.alerts.length > 0 && (
            <ul className="wx-alerts" aria-label="Peringatan cuaca 24 jam">
              {o.alerts.slice(0, compact ? 2 : 5).map((a) => {
                const Icon = ALERT_ICON[a.type] || CloudLightning;
                return (
                  <li key={a.type} className={`is-${a.level}`}>
                    <span className="wx-alert-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{a.title}</strong>
                      <p>{a.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="wx-panel">
            <h3>{compact ? "12 jam ke depan" : "24 jam ke depan"}</h3>
            <HourChart hours={hours} col={compact ? 88 : 56} />
          </div>
          {!compact && (
            <div className="wx-panel">
              <h3>7 hari ke depan</h3>
              <ol className="wx-days">
                {o.daily.map((d, i) => (
                  <li key={d.date} className={i === 0 ? "is-today" : ""}>
                    <span className="wx-day-name">{dayName(d.date, i)}</span>
                    <WeatherArt icon={d.icon} size={64} />
                    <span className="wx-day-label">{d.label}</span>
                    <span className="wx-day-temp">
                      <strong>{num(d.max)}°</strong> {num(d.min)}°
                    </span>
                    <span className={`wx-chip ${(d.rain_chance ?? 0) >= 50 ? "is-wet" : ""}`}>
                      <Droplets size={12} aria-hidden="true" /> {num(d.rain_chance ?? 0)}%
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {!compact && <HazardList hazards={hz.data} />}
        </div>
      )}
    </section>
  );
}

/** Temperature line with rain-chance bars, one column per hour; scrolls sideways on phones. */
function HourChart({ hours, col }: { hours: WeatherHour[]; col: number }) {
  if (!hours.length) return null;
  const w = hours.length * col,
    top = 26,
    lineH = 64;
  const temps = hours.map((h) => h.temperature ?? 0);
  const lo = Math.min(...temps),
    hi = Math.max(...temps);
  const y = (t: number) => top + (hi === lo ? lineH / 2 : ((hi - t) / (hi - lo)) * lineH);
  const pts = temps.map((t, i) => [i * col + col / 2, y(t)] as const);
  // Smooth curve through the points (cardinal spline).
  const d = pts
    .map(([x, py], i) => {
      if (!i) return `M${x},${py}`;
      const [x0, y0] = pts[i - 1];
      const [xa, ya] = pts[Math.max(0, i - 2)];
      const [xb, yb] = pts[Math.min(pts.length - 1, i + 1)];
      return `C${x0 + (x - xa) / 6},${y0 + (py - ya) / 6} ${x - (xb - x0) / 6},${py - (yb - y0) / 6} ${x},${py}`;
    })
    .join(" ");
  const barTop = top + lineH + 26,
    barH = 44;
  return (
    <div className="wx-chart" role="img" aria-label="Grafik suhu dan peluang hujan per jam">
      <svg width={w} height={barTop + barH + 34} viewBox={`0 0 ${w} ${barTop + barH + 34}`}>
        <defs>
          <linearGradient id="wx-temp-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f6a83b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f6a83b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${pts[pts.length - 1][0]},${top + lineH + 12} L${pts[0][0]},${top + lineH + 12} Z`} fill="url(#wx-temp-fill)" />
        <path d={d} fill="none" stroke="#f08a24" strokeWidth="2.5" strokeLinecap="round" />
        {hours.map((h, i) => {
          const [x, py] = pts[i];
          const chance = h.rain_chance ?? 0;
          const bh = Math.max(3, (chance / 100) * barH);
          return (
            <g key={h.time}>
              <circle cx={x} cy={py} r="3.5" fill="#fff" stroke="#f08a24" strokeWidth="2" />
              <text x={x} y={py - 10} className="wx-t-temp">
                {Math.round(h.temperature ?? 0)}°
              </text>
              <rect
                x={x - 12}
                y={barTop + barH - bh}
                width="24"
                height={bh}
                rx="6"
                className={`wx-bar ${h.code != null && h.code >= 95 ? "is-storm" : chance >= 50 ? "is-wet" : ""}`}
              />
              <text x={x} y={barTop - 6} className={`wx-t-rain ${chance >= 50 ? "is-wet" : ""}`}>
                {chance}%
              </text>
              <text x={x} y={barTop + barH + 22} className="wx-t-hour">
                {h.time.slice(11, 13)}.00
              </text>
            </g>
          );
        })}
      </svg>
      <p className="wx-chart-key">
        <span className="key-temp" /> Suhu <span className="key-rain" /> Peluang hujan{" "}
        <span className="key-storm" /> Potensi petir
      </p>
    </div>
  );
}

function HazardList({ hazards }: { hazards: Hazards | null }) {
  if (!hazards) return null;
  const quakes = [...(hazards.quakes || [])].sort((a, b) => b.magnitude - a.magnitude).slice(0, 3);
  return (
    <div className="wx-panel">
      <h3>Siklon &amp; gempa di sekitar Indonesia</h3>
      <ul className="wx-hazards">
        {hazards.cyclones === null ? (
          <li className="is-muted">
            <Tornado size={18} aria-hidden="true" /> Data siklon sedang tidak tersedia.
          </li>
        ) : hazards.cyclones.length === 0 ? (
          <li className="is-calm">
            <Tornado size={18} aria-hidden="true" /> Tidak ada siklon tropis aktif di sekitar
            Indonesia.
          </li>
        ) : (
          hazards.cyclones.map((c) => (
            <li key={c.id} className={`is-${c.level}`}>
              <Tornado size={18} aria-hidden="true" />
              <div>
                <strong>Siklon tropis {c.name}</strong>
                <p>
                  Status {c.level} · {Math.abs(c.latitude).toFixed(1)}°
                  {c.latitude < 0 ? "LS" : "LU"} {c.longitude.toFixed(1)}°BT
                  {c.severity ? ` · ${c.severity}` : ""}
                </p>
              </div>
            </li>
          ))
        )}
        {quakes.map((q) => (
          <li key={q.id} className={q.magnitude >= 6 ? "is-orange" : "is-quake"}>
            <Waves size={18} aria-hidden="true" />
            <div>
              <strong>
                Gempa M{num(q.magnitude)} · {q.region}
              </strong>
              <p>
                {new Date(q.time).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Jakarta",
                })}{" "}
                WIB · kedalaman {q.depth}
                {q.potential ? ` · ${q.potential}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="wx-foot">
        <Link className="insight-text-link" to="/sensor-map">
          <MapIcon size={15} aria-hidden="true" /> Lihat hujan, awan, dan potensi petir di peta{" "}
          <ArrowUpRight size={15} />
        </Link>
        <small>Siklon dari GDACS, gempa M5+ dari BMKG. Prakiraan adalah model wilayah, bukan sensor AEROSENSE.</small>
      </div>
    </div>
  );
}
